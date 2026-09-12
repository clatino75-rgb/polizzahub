"""JWT email/password authentication (register, login, logout, me, refresh, password reset)."""
import os
import logging
import hashlib
import secrets
from datetime import datetime, timezone, timedelta
from html import escape
from urllib.parse import urlparse

import bcrypt
import jwt
import httpx
from bson import ObjectId
from fastapi import APIRouter, Request, Response, HTTPException, Depends, BackgroundTasks
from pydantic import BaseModel, EmailStr

logger = logging.getLogger(__name__)

JWT_ALGORITHM = "HS256"
LOCKOUT_MAX_ATTEMPTS = 5
LOCKOUT_MINUTES = 15
RESET_MAX_REQUESTS = 5
RESET_WINDOW_MINUTES = 15

EMAIL_BASE_URL = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip().rstrip("/") or "https://integrations.emergentagent.com"
EMAIL_KEY = os.environ.get("EMERGENT_EMAIL_KEY", "")
EMAIL_FROM_NAME = os.environ.get("EMAIL_FROM_NAME") or "PolizzaHub"


def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(user_id: str, email: str, token_version: int = 0) -> str:
    payload = {"sub": user_id, "email": email, "ver": token_version,
               "exp": datetime.now(timezone.utc) + timedelta(minutes=15), "type": "access"}
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: str, token_version: int = 0) -> str:
    payload = {"sub": user_id, "ver": token_version,
               "exp": datetime.now(timezone.utc) + timedelta(days=7), "type": "refresh"}
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def set_auth_cookies(response: Response, access: str, refresh: str):
    response.set_cookie("access_token", access, httponly=True, secure=True, samesite="none", max_age=900, path="/")
    response.set_cookie("refresh_token", refresh, httponly=True, secure=True, samesite="none", max_age=604800, path="/")


async def send_password_reset_email(to_email: str, token: str) -> bool:
    base = os.environ.get("FRONTEND_URL", "").rstrip("/")
    link = f"{base}/reset-password?token={token}"
    if not EMAIL_KEY or EMAIL_KEY.startswith("{") or not base.startswith("https://"):
        if urlparse(base).hostname in ("localhost", "127.0.0.1", "::1"):
            logger.warning("Email not configured; password reset link: %s", link)
        else:
            logger.error("Password reset email not configured (EMERGENT_EMAIL_KEY / FRONTEND_URL)")
        return False
    brand = escape(EMAIL_FROM_NAME)
    html = (
        f'<table role="presentation" width="100%"><tr><td style="padding:24px;font-family:Arial,sans-serif">'
        f'<p>Abbiamo ricevuto una richiesta di reimpostazione della password di {brand}.</p>'
        f'<p><a href="{escape(link)}">Reimposta la password</a></p>'
        f'<p>Il link scade tra 1 ora e puo essere usato una sola volta. Se non hai fatto questa richiesta, '
        f'ignora questa email.</p>'
        f'<p style="font-size:12px;color:#888">Inviato da {brand}.</p>'
        f'</td></tr></table>'
    )
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{EMAIL_BASE_URL}/api/v1/email/send",
                headers={"X-Email-Key": EMAIL_KEY},
                json={"to": [to_email], "subject": f"Reimposta la password di {EMAIL_FROM_NAME}",
                      "html": html, "from_name": EMAIL_FROM_NAME},
            )
        resp.raise_for_status()
        return True
    except Exception as e:
        logger.error(f"Password reset email failed: {e}")
        return False


class RegisterBody(BaseModel):
    email: EmailStr
    password: str
    name: str = ""


class LoginBody(BaseModel):
    email: EmailStr
    password: str


class ForgotBody(BaseModel):
    email: EmailStr


class ResetBody(BaseModel):
    token: str
    password: str


def _clean_user(user: dict) -> dict:
    user["_id"] = str(user["_id"])
    user.pop("password_hash", None)
    return {"id": user["_id"], "email": user["email"], "name": user.get("name", ""), "role": user.get("role", "user")}


def build_auth(db):
    router = APIRouter(prefix="/api/auth", tags=["auth"])

    async def get_current_user(request: Request) -> dict:
        token = request.cookies.get("access_token")
        if not token:
            auth_header = request.headers.get("Authorization", "")
            if auth_header.startswith("Bearer "):
                token = auth_header[7:]
        if not token:
            raise HTTPException(status_code=401, detail="Non autenticato")
        try:
            payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
            if payload.get("type") != "access":
                raise HTTPException(status_code=401, detail="Tipo token non valido")
            user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
            if not user:
                raise HTTPException(status_code=401, detail="Utente non trovato")
            if payload.get("ver", 0) != user.get("token_version", 0):
                raise HTTPException(status_code=401, detail="Sessione scaduta")
            return user
        except jwt.ExpiredSignatureError:
            raise HTTPException(status_code=401, detail="Token scaduto")
        except jwt.InvalidTokenError:
            raise HTTPException(status_code=401, detail="Token non valido")

    async def _check_lockout(identifier: str):
        now = datetime.now(timezone.utc)
        rec = await db.login_attempts.find_one({"identifier": identifier})
        if rec and rec.get("count", 0) >= LOCKOUT_MAX_ATTEMPTS:
            locked_until = rec.get("locked_until")
            if locked_until and locked_until.replace(tzinfo=timezone.utc) > now:
                raise HTTPException(status_code=429, detail="Troppi tentativi. Riprova tra 15 minuti.")

    @router.post("/register")
    async def register(body: RegisterBody, response: Response):
        email = body.email.lower()
        if await db.users.find_one({"email": email}):
            raise HTTPException(status_code=400, detail="Email gia registrata")
        doc = {"email": email, "password_hash": hash_password(body.password),
               "name": body.name or email.split("@")[0], "role": "user",
               "token_version": 0, "created_at": datetime.now(timezone.utc)}
        res = await db.users.insert_one(doc)
        uid = str(res.inserted_id)
        set_auth_cookies(response, create_access_token(uid, email, 0), create_refresh_token(uid, 0))
        doc["_id"] = res.inserted_id
        return _clean_user(doc)

    @router.post("/login")
    async def login(body: LoginBody, request: Request, response: Response):
        email = body.email.lower()
        ip = request.client.host if request.client else "unknown"
        identifier = f"{ip}:{email}"
        await _check_lockout(identifier)
        user = await db.users.find_one({"email": email})
        if not user or not verify_password(body.password, user["password_hash"]):
            now = datetime.now(timezone.utc)
            await db.login_attempts.update_one(
                {"identifier": identifier},
                {"$inc": {"count": 1}, "$set": {"email": email, "locked_until": now + timedelta(minutes=LOCKOUT_MINUTES)}},
                upsert=True)
            raise HTTPException(status_code=401, detail="Credenziali non valide")
        await db.login_attempts.delete_many({"identifier": identifier})
        uid = str(user["_id"])
        ver = user.get("token_version", 0)
        set_auth_cookies(response, create_access_token(uid, email, ver), create_refresh_token(uid, ver))
        return _clean_user(user)

    @router.post("/logout")
    async def logout(response: Response, user: dict = Depends(get_current_user)):
        response.delete_cookie("access_token", path="/")
        response.delete_cookie("refresh_token", path="/")
        return {"message": "Disconnesso"}

    @router.get("/me")
    async def me(user: dict = Depends(get_current_user)):
        return _clean_user(user)

    @router.post("/refresh")
    async def refresh(request: Request, response: Response):
        token = request.cookies.get("refresh_token")
        if not token:
            raise HTTPException(status_code=401, detail="Nessun refresh token")
        try:
            payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
            if payload.get("type") != "refresh":
                raise HTTPException(status_code=401, detail="Tipo token non valido")
            user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
            if not user or payload.get("ver", 0) != user.get("token_version", 0):
                raise HTTPException(status_code=401, detail="Sessione scaduta")
            uid = str(user["_id"])
            ver = user.get("token_version", 0)
            set_auth_cookies(response, create_access_token(uid, user["email"], ver), create_refresh_token(uid, ver))
            return _clean_user(user)
        except jwt.InvalidTokenError:
            raise HTTPException(status_code=401, detail="Token non valido")

    GENERIC = {"message": "Se l'email e registrata, riceverai un link di reimpostazione."}

    @router.post("/forgot-password")
    async def forgot_password(body: ForgotBody, background_tasks: BackgroundTasks):
        email = body.email.lower()
        now = datetime.now(timezone.utc)
        await db.password_reset_requests.insert_one({"email": email, "created_at": now})
        window_start = now - timedelta(minutes=RESET_WINDOW_MINUTES)
        recent = await db.password_reset_requests.count_documents({"email": email, "created_at": {"$gte": window_start}})
        app_recent = await db.password_reset_requests.count_documents({"created_at": {"$gte": now - timedelta(minutes=10)}})
        if recent > RESET_MAX_REQUESTS or app_recent > 10:
            return GENERIC
        user = await db.users.find_one({"email": email})
        if not user:
            return GENERIC
        raw = secrets.token_urlsafe(32)
        token_hash = hashlib.sha256(raw.encode()).hexdigest()
        await db.password_reset_tokens.insert_one({
            "token_hash": token_hash, "user_id": str(user["_id"]), "email": user["email"],
            "expires_at": now + timedelta(hours=1), "used": False})
        background_tasks.add_task(send_password_reset_email, user["email"], raw)
        return GENERIC

    @router.post("/reset-password")
    async def reset_password(body: ResetBody):
        now = datetime.now(timezone.utc)
        h = hashlib.sha256(body.token.encode()).hexdigest()
        rec = await db.password_reset_tokens.find_one_and_update(
            {"token_hash": h, "used": False, "expires_at": {"$gt": now}},
            {"$set": {"used": True}})
        if not rec:
            raise HTTPException(status_code=400, detail="Link non valido o scaduto")
        await db.users.update_one(
            {"_id": ObjectId(rec["user_id"])},
            {"$set": {"password_hash": hash_password(body.password)}, "$inc": {"token_version": 1}})
        await db.password_reset_tokens.delete_many({"user_id": rec["user_id"], "used": False})
        await db.login_attempts.delete_many({"email": rec["email"]})
        return {"message": "Password reimpostata con successo"}

    return router, get_current_user


async def seed_admin(db):
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@example.com").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        await db.users.insert_one({"email": admin_email, "password_hash": hash_password(admin_password),
                                   "name": "Admin", "role": "admin", "token_version": 0,
                                   "created_at": datetime.now(timezone.utc)})
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_password)}})


async def create_auth_indexes(db):
    await db.users.create_index("email", unique=True)
    await db.password_reset_tokens.create_index("expires_at", expireAfterSeconds=0)
    await db.password_reset_tokens.create_index("token_hash", unique=True)
    await db.login_attempts.create_index("email")
    await db.login_attempts.create_index("identifier")
    await db.password_reset_requests.create_index("email")
    await db.password_reset_requests.create_index("created_at", expireAfterSeconds=900)
