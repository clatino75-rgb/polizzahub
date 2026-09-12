from dotenv import load_dotenv
from pathlib import Path
load_dotenv(Path(__file__).parent / '.env')

import os
import io
import json
import hmac
import base64
import logging
import httpx
from datetime import datetime, timezone, date
from typing import List, Optional, Annotated

from fastapi import FastAPI, APIRouter, Depends, HTTPException, UploadFile, File, Form, Request, BackgroundTasks
from fastapi.responses import Response as FastAPIResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorGridFSBucket
from pydantic import BaseModel, Field, BeforeValidator, ConfigDict
from bson import ObjectId

from auth import build_auth, seed_admin, create_auth_indexes
from extraction import extract_policy_fields, EXTRACT_FIELDS
from pdf_utils import pdf_to_page_images, fill_pdf, image_to_pdf_bytes
from excel_utils import policies_to_xlsx, xlsx_to_policies, template_xlsx, read_excel_preview, parse_xlsx_with_report
from notifications import run_expiry_alerts

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]
fs = AsyncIOMotorGridFSBucket(db, bucket_name="docs")

app = FastAPI(title="PolizzaHub API")
api = APIRouter(prefix="/api")

auth_router, get_current_user = build_auth(db)

PyObjectId = Annotated[str, BeforeValidator(str)]


# ---------- Models ----------
class Policy(BaseModel):
    model_config = ConfigDict(extra="ignore")
    contraente_nome: str = ""
    contraente_cf_piva: str = ""
    contraente_indirizzo: str = ""
    proprietario_nome: str = ""
    proprietario_cf_piva: str = ""
    proprietario_indirizzo: str = ""
    numero_polizza: str = ""
    data_effetto: str = ""
    data_scadenza: str = ""
    frazionamento: str = ""
    premio_netto_annuale: str = ""
    premio_lordo_annuale: str = ""
    premio_netto_semestrale: str = ""
    premio_lordo_semestrale: str = ""
    data_immatricolazione: str = ""
    data_voltura: str = ""
    targa: str = ""
    tipo_polizza: str = ""
    ramo_polizza: str = ""
    compagnia_emissione: str = ""
    agenzia_emissione: str = ""
    anagrafica_id: str = ""
    compagnia_id: str = ""
    collaboratore_id: str = ""
    note: str = ""


class FieldPlacement(BaseModel):
    key: str
    label: str = ""
    page: int = 0
    x: float = 0
    y: float = 0
    font_size: float = 11


class SignatureRequest(BaseModel):
    template_id: str
    policy_id: Optional[str] = None
    signer_name: str = ""
    signer_email: str = ""
    signer_phone: str = ""
    field_values: dict = {}


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def serialize(doc: dict) -> dict:
    if not doc:
        return doc
    doc = dict(doc)
    doc["id"] = str(doc.pop("_id"))
    return doc


REGISTRY_FIELDS = {
    "anagrafiche": ["nome", "cf_piva", "indirizzo", "email", "telefono", "tipo", "note"],
    "compagnie": ["nome", "indirizzo", "email", "telefono", "note"],
    "collaboratori": ["nome", "email", "telefono", "ruolo", "note"],
}


def _sanitize_registry(kind: str, body: dict) -> dict:
    return {k: str(body.get(k, "") or "") for k in REGISTRY_FIELDS[kind]}


async def _link_entities(owner: str, doc: dict):
    """Auto-associate the policy to an existing (or new) anagrafica/compagnia without
    ever deleting existing records. Existing policies of the same client are preserved."""
    if not doc.get("anagrafica_id"):
        cf = (doc.get("contraente_cf_piva") or "").strip()
        nome = (doc.get("contraente_nome") or "").strip()
        if cf or nome:
            match = None
            for a in await db.anagrafiche.find({"owner_id": owner}).to_list(5000):
                acf = (a.get("cf_piva") or "").strip().lower()
                anome = (a.get("nome") or "").strip().lower()
                if cf and acf and acf == cf.lower():
                    match = a; break
                if (not cf) and nome and anome == nome.lower():
                    match = a; break
            if match:
                doc["anagrafica_id"] = str(match["_id"])
            else:
                na = {"owner_id": owner, "nome": nome, "cf_piva": cf,
                      "indirizzo": doc.get("contraente_indirizzo", ""), "email": "",
                      "telefono": "", "tipo": "Contraente", "note": "", "created_at": now_iso()}
                r = await db.anagrafiche.insert_one(na)
                doc["anagrafica_id"] = str(r.inserted_id)
    if not doc.get("compagnia_id"):
        cn = (doc.get("compagnia_emissione") or "").strip()
        if cn:
            match = None
            for c in await db.compagnie.find({"owner_id": owner}).to_list(5000):
                if (c.get("nome") or "").strip().lower() == cn.lower():
                    match = c; break
            if match:
                doc["compagnia_id"] = str(match["_id"])
            else:
                r = await db.compagnie.insert_one({"owner_id": owner, "nome": cn, "indirizzo": "",
                                                   "email": "", "telefono": "", "note": "", "created_at": now_iso()})
                doc["compagnia_id"] = str(r.inserted_id)
    return doc


# ---------- Registry: anagrafiche / compagnie / collaboratori ----------
@api.get("/registry/{kind}")
async def list_registry(kind: str, search: str = "", user: dict = Depends(get_current_user)):
    if kind not in REGISTRY_FIELDS:
        raise HTTPException(status_code=404, detail="Tipo non valido")
    q = {"owner_id": str(user["_id"])}
    if search:
        rgx = {"$regex": search, "$options": "i"}
        q["$or"] = [{"nome": rgx}, {"cf_piva": rgx}, {"email": rgx}, {"telefono": rgx}]
    docs = await db[kind].find(q).sort("nome", 1).to_list(3000)
    return [serialize(d) for d in docs]


@api.post("/registry/{kind}")
async def create_registry(kind: str, body: dict, user: dict = Depends(get_current_user)):
    if kind not in REGISTRY_FIELDS:
        raise HTTPException(status_code=404, detail="Tipo non valido")
    doc = _sanitize_registry(kind, body)
    doc["owner_id"] = str(user["_id"])
    doc["created_at"] = now_iso()
    res = await db[kind].insert_one(doc)
    saved = await db[kind].find_one({"_id": res.inserted_id})
    return serialize(saved)


@api.put("/registry/{kind}/{item_id}")
async def update_registry(kind: str, item_id: str, body: dict, user: dict = Depends(get_current_user)):
    if kind not in REGISTRY_FIELDS:
        raise HTTPException(status_code=404, detail="Tipo non valido")
    doc = _sanitize_registry(kind, body)
    res = await db[kind].update_one({"_id": ObjectId(item_id), "owner_id": str(user["_id"])}, {"$set": doc})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Elemento non trovato")
    saved = await db[kind].find_one({"_id": ObjectId(item_id)})
    return serialize(saved)


@api.delete("/registry/{kind}/{item_id}")
async def delete_registry(kind: str, item_id: str, user: dict = Depends(get_current_user)):
    if kind not in REGISTRY_FIELDS:
        raise HTTPException(status_code=404, detail="Tipo non valido")
    res = await db[kind].delete_one({"_id": ObjectId(item_id), "owner_id": str(user["_id"])})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Elemento non trovato")
    return {"message": "Eliminato"}


@api.get("/anagrafiche/{item_id}/policies")
async def anagrafica_policies(item_id: str, user: dict = Depends(get_current_user)):
    docs = await db.policies.find({"owner_id": str(user["_id"]), "anagrafica_id": item_id}).sort("created_at", -1).to_list(1000)
    return [serialize(d) for d in docs]


# ---------- Policies ----------
@api.get("/policies")
async def list_policies(search: str = "", user: dict = Depends(get_current_user)):
    query = {"owner_id": str(user["_id"])}
    if search:
        rgx = {"$regex": search, "$options": "i"}
        query["$or"] = [{"numero_polizza": rgx}, {"contraente_nome": rgx},
                        {"proprietario_nome": rgx}, {"compagnia_emissione": rgx},
                        {"targa": rgx}, {"ramo_polizza": rgx}]
    docs = await db.policies.find(query).sort("created_at", -1).to_list(1000)
    return [serialize(d) for d in docs]


@api.post("/policies")
async def create_policy(policy: Policy, user: dict = Depends(get_current_user)):
    doc = policy.model_dump()
    doc["owner_id"] = str(user["_id"])
    await _link_entities(str(user["_id"]), doc)
    doc["created_at"] = now_iso()
    doc["updated_at"] = now_iso()
    res = await db.policies.insert_one(doc)
    saved = await db.policies.find_one({"_id": res.inserted_id})
    return serialize(saved)


XLSX_MEDIA = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


@api.get("/policies/export")
async def export_policies(user: dict = Depends(get_current_user)):
    docs = await db.policies.find({"owner_id": str(user["_id"])}).sort("created_at", -1).to_list(5000)
    data = policies_to_xlsx([serialize(d) for d in docs])
    return FastAPIResponse(content=data, media_type=XLSX_MEDIA,
                           headers={"Content-Disposition": "attachment; filename=anagrafiche_polizze.xlsx"})


@api.get("/policies/export-template")
async def export_template(user: dict = Depends(get_current_user)):
    return FastAPIResponse(content=template_xlsx(), media_type=XLSX_MEDIA,
                           headers={"Content-Disposition": "attachment; filename=modello_import_polizze.xlsx"})


@api.post("/policies/import/preview")
async def import_preview(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    content = await file.read()
    try:
        return read_excel_preview(content)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"File Excel non valido: {e}")


@api.post("/policies/import")
async def import_policies(file: UploadFile = File(...), mapping: str = Form(""),
                          user: dict = Depends(get_current_user)):
    content = await file.read()
    mp = None
    if mapping:
        try:
            mp = json.loads(mapping)
        except Exception:
            mp = None
    try:
        report = parse_xlsx_with_report(content, mp)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"File Excel non valido: {e}")
    records = report["policies"]
    if not records and not report["skipped"]:
        raise HTTPException(status_code=400, detail="Nessuna riga valida trovata nel file")
    owner = str(user["_id"])
    inserted = 0
    for rec in records:
        doc = Policy(**rec).model_dump()
        doc["owner_id"] = owner
        doc["created_at"] = now_iso()
        doc["updated_at"] = now_iso()
        await db.policies.insert_one(doc)
        inserted += 1
    skipped_count = len(report["skipped"])
    msg = f"{inserted} anagrafiche importate"
    if skipped_count:
        msg += f", {skipped_count} righe scartate"
    return {"message": msg, "imported": inserted, "total": report["total"],
            "skipped_count": skipped_count, "skipped": report["skipped"][:50]}


@api.get("/policies/{policy_id}")
async def get_policy(policy_id: str, user: dict = Depends(get_current_user)):
    doc = await db.policies.find_one({"_id": ObjectId(policy_id), "owner_id": str(user["_id"])})
    if not doc:
        raise HTTPException(status_code=404, detail="Polizza non trovata")
    return serialize(doc)


@api.put("/policies/{policy_id}")
async def update_policy(policy_id: str, policy: Policy, user: dict = Depends(get_current_user)):
    doc = policy.model_dump()
    await _link_entities(str(user["_id"]), doc)
    doc["updated_at"] = now_iso()
    res = await db.policies.update_one(
        {"_id": ObjectId(policy_id), "owner_id": str(user["_id"])}, {"$set": doc})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Polizza non trovata")
    saved = await db.policies.find_one({"_id": ObjectId(policy_id)})
    return serialize(saved)


@api.delete("/policies/{policy_id}")
async def delete_policy(policy_id: str, user: dict = Depends(get_current_user)):
    res = await db.policies.delete_one({"_id": ObjectId(policy_id), "owner_id": str(user["_id"])})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Polizza non trovata")
    return {"message": "Polizza eliminata"}


def _shift_year(iso_date: str, years: int = 1) -> str:
    try:
        d = datetime.fromisoformat(iso_date).date()
        try:
            return d.replace(year=d.year + years).isoformat()
        except ValueError:
            return d.replace(year=d.year + years, day=28).isoformat()
    except Exception:
        return ""


@api.post("/policies/{policy_id}/renew")
async def renew_policy(policy_id: str, user: dict = Depends(get_current_user)):
    pol = await db.policies.find_one({"_id": ObjectId(policy_id), "owner_id": str(user["_id"])})
    if not pol:
        raise HTTPException(status_code=404, detail="Polizza non trovata")
    new = {k: v for k, v in pol.items() if k not in ("_id", "created_at", "updated_at")}
    old_scad = pol.get("data_scadenza", "")
    new_effetto = old_scad or date.today().isoformat()
    new_scad = _shift_year(new_effetto, 1)
    new["data_effetto"] = new_effetto
    new["data_scadenza"] = new_scad or new["data_scadenza"]
    new["owner_id"] = str(user["_id"])
    new["created_at"] = now_iso()
    new["updated_at"] = now_iso()
    res = await db.policies.insert_one(new)
    saved = await db.policies.find_one({"_id": res.inserted_id})
    return serialize(saved)


# ---------- Documents archive (GridFS) ----------
@api.post("/policies/{policy_id}/documents")
async def upload_document(policy_id: str, file: UploadFile = File(...),
                          user: dict = Depends(get_current_user)):
    owner = str(user["_id"])
    pol = await db.policies.find_one({"_id": ObjectId(policy_id), "owner_id": owner})
    if not pol:
        raise HTTPException(status_code=404, detail="Polizza non trovata")
    content = await file.read()
    if len(content) > 30 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File troppo grande (max 30MB)")
    ctype = file.content_type or "application/octet-stream"
    gid = await fs.upload_from_stream(file.filename or "documento", content,
                                      metadata={"content_type": ctype})
    doc = {"policy_id": policy_id, "owner_id": owner, "filename": file.filename or "documento",
           "content_type": ctype, "size": len(content), "gridfs_id": gid, "created_at": now_iso()}
    res = await db.documents.insert_one(doc)
    return {"id": str(res.inserted_id), "filename": doc["filename"], "size": doc["size"],
            "content_type": ctype, "created_at": doc["created_at"]}


@api.get("/policies/{policy_id}/documents")
async def list_documents(policy_id: str, user: dict = Depends(get_current_user)):
    docs = await db.documents.find({"policy_id": policy_id, "owner_id": str(user["_id"])}).sort("created_at", -1).to_list(500)
    return [{"id": str(d["_id"]), "filename": d.get("filename"), "size": d.get("size"),
             "content_type": d.get("content_type"), "created_at": d.get("created_at")} for d in docs]


@api.get("/documents/{doc_id}/download")
async def download_document(doc_id: str, user: dict = Depends(get_current_user)):
    d = await db.documents.find_one({"_id": ObjectId(doc_id), "owner_id": str(user["_id"])})
    if not d:
        raise HTTPException(status_code=404, detail="Documento non trovato")
    stream = await fs.open_download_stream(d["gridfs_id"])
    data = await stream.read()
    return FastAPIResponse(content=data, media_type=d.get("content_type", "application/octet-stream"),
                           headers={"Content-Disposition": f'attachment; filename="{d.get("filename")}"'})


@api.get("/documents/{doc_id}/view")
async def view_document(doc_id: str, user: dict = Depends(get_current_user)):
    d = await db.documents.find_one({"_id": ObjectId(doc_id), "owner_id": str(user["_id"])})
    if not d:
        raise HTTPException(status_code=404, detail="Documento non trovato")
    stream = await fs.open_download_stream(d["gridfs_id"])
    data = await stream.read()
    return FastAPIResponse(content=data, media_type=d.get("content_type", "application/octet-stream"),
                           headers={"Content-Disposition": f'inline; filename="{d.get("filename")}"'})


@api.delete("/documents/{doc_id}")
async def delete_document(doc_id: str, user: dict = Depends(get_current_user)):
    d = await db.documents.find_one({"_id": ObjectId(doc_id), "owner_id": str(user["_id"])})
    if not d:
        raise HTTPException(status_code=404, detail="Documento non trovato")
    try:
        await fs.delete(d["gridfs_id"])
    except Exception:
        pass
    await db.documents.delete_one({"_id": d["_id"]})
    return {"message": "Documento eliminato"}


# ---------- Scadenziario ----------
@api.get("/scadenziario")
async def scadenziario(date_from: str = "", date_to: str = "", user: dict = Depends(get_current_user)):
    docs = await db.policies.find({"owner_id": str(user["_id"]),
                                   "data_scadenza": {"$ne": ""}}).to_list(2000)
    today = date.today().isoformat()
    result = []
    for d in docs:
        scad = d.get("data_scadenza", "")
        if not scad:
            continue
        if date_from and scad < date_from:
            continue
        if date_to and scad > date_to:
            continue
        status = "attiva"
        if scad < today:
            status = "scaduta"
        else:
            try:
                delta = (datetime.fromisoformat(scad).date() - date.today()).days
                if delta <= 30:
                    status = "in_scadenza"
            except Exception:
                pass
        item = serialize(d)
        item["status"] = status
        result.append(item)
    result.sort(key=lambda x: x.get("data_scadenza", ""))
    return result


# ---------- Dashboard ----------
@api.get("/dashboard/stats")
async def dashboard_stats(user: dict = Depends(get_current_user)):
    owner = str(user["_id"])
    docs = await db.policies.find({"owner_id": owner}).to_list(5000)
    today = date.today()
    total = len(docs)
    in_scadenza = 0
    premio_totale = 0.0
    ramo_count = {}
    upcoming = []
    for d in docs:
        ramo = d.get("ramo_polizza") or "Altro"
        ramo_count[ramo] = ramo_count.get(ramo, 0) + 1
        try:
            premio_totale += float(str(d.get("premio_lordo_annuale") or 0).replace(",", "."))
        except Exception:
            pass
        scad = d.get("data_scadenza", "")
        if scad:
            try:
                delta = (datetime.fromisoformat(scad).date() - today).days
                if 0 <= delta <= 30:
                    in_scadenza += 1
                if delta >= -30:
                    upcoming.append(serialize(d))
            except Exception:
                pass
    upcoming.sort(key=lambda x: x.get("data_scadenza", ""))
    pending = await db.signatures.count_documents({"owner_id": owner, "status": {"$in": ["bozza", "inviato"]}})
    return {
        "total_policies": total,
        "in_scadenza": in_scadenza,
        "premio_totale": round(premio_totale, 2),
        "pending_signatures": pending,
        "ramo_distribution": [{"ramo": k, "count": v} for k, v in ramo_count.items()],
        "upcoming": upcoming[:8],
    }


# ---------- AI Extraction ----------
@api.post("/extract")
async def extract(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    content = await file.read()
    if len(content) > 15 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File troppo grande (max 15MB)")
    try:
        data = await extract_policy_fields(content, file.filename)
    except Exception as e:
        logger.error(f"Extraction error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    return {"fields": data, "filename": file.filename}


@api.get("/extract/fields")
async def extract_field_list(user: dict = Depends(get_current_user)):
    return {"fields": EXTRACT_FIELDS}


# ---------- PDF Templates ----------
@api.post("/templates")
async def create_template(name: str = Form(...), file: UploadFile = File(...),
                          user: dict = Depends(get_current_user)):
    content = await file.read()
    fn = (file.filename or "").lower()
    if fn.endswith((".jpg", ".jpeg", ".png")):
        content = image_to_pdf_bytes(content)
    try:
        pages = pdf_to_page_images(content)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"PDF non valido: {e}")
    doc = {
        "owner_id": str(user["_id"]),
        "name": name,
        "pdf_b64": base64.b64encode(content).decode(),
        "page_meta": [{"page": p["page"], "width": p["width"], "height": p["height"]} for p in pages],
        "fields": [],
        "created_at": now_iso(),
    }
    res = await db.templates.insert_one(doc)
    return {"id": str(res.inserted_id), "name": name,
            "pages": pages, "page_meta": doc["page_meta"], "fields": []}


@api.get("/templates")
async def list_templates(user: dict = Depends(get_current_user)):
    docs = await db.templates.find({"owner_id": str(user["_id"])}).sort("created_at", -1).to_list(500)
    return [{"id": str(d["_id"]), "name": d["name"], "fields": d.get("fields", []),
             "page_count": len(d.get("page_meta", [])), "created_at": d.get("created_at")} for d in docs]


@api.get("/templates/{template_id}")
async def get_template(template_id: str, user: dict = Depends(get_current_user)):
    d = await db.templates.find_one({"_id": ObjectId(template_id), "owner_id": str(user["_id"])})
    if not d:
        raise HTTPException(status_code=404, detail="Modello non trovato")
    pages = pdf_to_page_images(base64.b64decode(d["pdf_b64"]))
    return {"id": str(d["_id"]), "name": d["name"], "pages": pages,
            "page_meta": d.get("page_meta", []), "fields": d.get("fields", [])}


@api.put("/templates/{template_id}/fields")
async def save_template_fields(template_id: str, fields: List[FieldPlacement],
                               user: dict = Depends(get_current_user)):
    res = await db.templates.update_one(
        {"_id": ObjectId(template_id), "owner_id": str(user["_id"])},
        {"$set": {"fields": [f.model_dump() for f in fields]}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Modello non trovato")
    return {"message": "Campi salvati", "fields": [f.model_dump() for f in fields]}


@api.delete("/templates/{template_id}")
async def delete_template(template_id: str, user: dict = Depends(get_current_user)):
    res = await db.templates.delete_one({"_id": ObjectId(template_id), "owner_id": str(user["_id"])})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Modello non trovato")
    return {"message": "Modello eliminato"}


async def _build_filled_pdf(template_id: str, owner_id: str, policy_id: Optional[str], overrides: dict) -> bytes:
    d = await db.templates.find_one({"_id": ObjectId(template_id), "owner_id": owner_id})
    if not d:
        raise HTTPException(status_code=404, detail="Modello non trovato")
    values = {}
    if policy_id:
        pol = await db.policies.find_one({"_id": ObjectId(policy_id), "owner_id": owner_id})
        if pol:
            values = {k: str(v) for k, v in pol.items() if isinstance(v, str)}
    values.update({k: str(v) for k, v in (overrides or {}).items()})
    placements = []
    for f in d.get("fields", []):
        placements.append({
            "page": f.get("page", 0), "x": f.get("x", 0), "y": f.get("y", 0),
            "font_size": f.get("font_size", 11),
            "value": values.get(f.get("key"), ""),
        })
    return fill_pdf(base64.b64decode(d["pdf_b64"]), placements)


class GenerateBody(BaseModel):
    policy_id: Optional[str] = None
    field_values: dict = {}


@api.post("/templates/{template_id}/generate")
async def generate_pdf(template_id: str, body: GenerateBody, user: dict = Depends(get_current_user)):
    pdf_bytes = await _build_filled_pdf(template_id, str(user["_id"]), body.policy_id, body.field_values)
    return FastAPIResponse(content=pdf_bytes, media_type="application/pdf",
                           headers={"Content-Disposition": "attachment; filename=documento_compilato.pdf"})


# ---------- YouSign (MOCKED) ----------
@api.post("/signatures")
async def create_signature(body: SignatureRequest, user: dict = Depends(get_current_user)):
    owner = str(user["_id"])
    pdf_bytes = await _build_filled_pdf(body.template_id, owner, body.policy_id, body.field_values)
    yousign_key = os.environ.get("YOUSIGN_API_KEY", "")

    if yousign_key:
        base = os.environ.get("YOUSIGN_BASE_URL", "https://api-sandbox.yousign.app/v3").rstrip("/")
        headers = {"Authorization": f"Bearer {yousign_key}"}
        names = (body.signer_name or "Firmatario").split(" ", 1)
        first, last = names[0], (names[1] if len(names) > 1 else "-")
        try:
            async with httpx.AsyncClient(timeout=60) as c:
                r = await c.post(f"{base}/signature_requests", headers=headers,
                                 json={"name": "Firma polizza", "delivery_mode": "none", "timezone": "Europe/Rome"})
                r.raise_for_status()
                rid = r.json()["id"]
                dr = await c.post(f"{base}/signature_requests/{rid}/documents", headers=headers,
                                  files={"file": ("documento.pdf", pdf_bytes, "application/pdf")},
                                  data={"nature": "signable_document", "parse_anchors": "false"})
                dr.raise_for_status()
                did = dr.json()["id"]
                sr = await c.post(f"{base}/signature_requests/{rid}/signers", headers=headers,
                                  json={"info": {"first_name": first, "last_name": last,
                                                 "email": body.signer_email or "test@example.com",
                                                 "phone_number": body.signer_phone, "locale": "it"},
                                        "signature_level": "electronic_signature",
                                        "signature_authentication_mode": "otp_sms",
                                        "fields": [{"type": "signature", "document_id": did,
                                                    "page": 1, "x": 400, "y": 650, "width": 180, "height": 37}]})
                sr.raise_for_status()
                sid_ys = sr.json()["id"]
                ar = await c.post(f"{base}/signature_requests/{rid}/activate", headers=headers)
                ar.raise_for_status()
                act = ar.json()
        except httpx.HTTPError as e:
            raise HTTPException(status_code=502, detail=f"Errore YouSign: {e}")
        signer_obj = next((x for x in act.get("signers", []) if x.get("id") == sid_ys), {})
        link = signer_obj.get("signature_link")
        doc = {"owner_id": owner, "template_id": body.template_id, "policy_id": body.policy_id,
               "signer_name": body.signer_name, "signer_email": body.signer_email, "signer_phone": body.signer_phone,
               "pdf_b64": base64.b64encode(pdf_bytes).decode(), "status": "inviato", "provider": "yousign",
               "yousign_request_id": rid, "signature_link": link, "otp_verified": False,
               "created_at": now_iso(), "events": [{"at": now_iso(), "label": "Inviata a YouSign per firma OTP SMS"}]}
        res = await db.signatures.insert_one(doc)
        return {"id": str(res.inserted_id), "status": "inviato", "provider": "yousign",
                "signature_link": link, "message": "Inviata a YouSign per firma OTP via SMS"}

    doc = {
        "owner_id": owner,
        "template_id": body.template_id,
        "policy_id": body.policy_id,
        "signer_name": body.signer_name,
        "signer_email": body.signer_email,
        "signer_phone": body.signer_phone,
        "pdf_b64": base64.b64encode(pdf_bytes).decode(),
        "status": "inviato",
        "provider": "mock",
        "signature_link": None,
        "otp_verified": False,
        "created_at": now_iso(),
        "events": [{"at": now_iso(), "label": "Richiesta creata e inviata per firma OTP"}],
    }
    res = await db.signatures.insert_one(doc)
    return {"id": str(res.inserted_id), "status": doc["status"], "provider": "mock",
            "signature_link": None, "message": "Richiesta di firma inviata (simulazione OTP)"}


@api.get("/signatures")
async def list_signatures(user: dict = Depends(get_current_user)):
    docs = await db.signatures.find({"owner_id": str(user["_id"])}).sort("created_at", -1).to_list(500)
    out = []
    for d in docs:
        out.append({"id": str(d["_id"]), "signer_name": d.get("signer_name"),
                    "signer_email": d.get("signer_email"), "signer_phone": d.get("signer_phone"),
                    "status": d.get("status"), "provider": d.get("provider"),
                    "signature_link": d.get("signature_link"),
                    "otp_verified": d.get("otp_verified", False),
                    "created_at": d.get("created_at"), "events": d.get("events", [])})
    return out


@api.get("/signatures/{sig_id}/document")
async def get_signature_document(sig_id: str, user: dict = Depends(get_current_user)):
    d = await db.signatures.find_one({"_id": ObjectId(sig_id), "owner_id": str(user["_id"])})
    if not d:
        raise HTTPException(status_code=404, detail="Richiesta non trovata")
    return FastAPIResponse(content=base64.b64decode(d["pdf_b64"]), media_type="application/pdf",
                           headers={"Content-Disposition": "inline; filename=documento_firma.pdf"})


class OtpBody(BaseModel):
    otp: str = ""


@api.post("/signatures/{sig_id}/verify-otp")
async def verify_otp(sig_id: str, body: OtpBody, user: dict = Depends(get_current_user)):
    d = await db.signatures.find_one({"_id": ObjectId(sig_id), "owner_id": str(user["_id"])})
    if not d:
        raise HTTPException(status_code=404, detail="Richiesta non trovata")
    # MOCK: accept any 4+ digit code
    if not body.otp or len(body.otp) < 4:
        raise HTTPException(status_code=400, detail="Codice OTP non valido")
    events = d.get("events", [])
    events.append({"at": now_iso(), "label": f"OTP verificato ({body.otp}) - documento firmato"})
    await db.signatures.update_one({"_id": d["_id"]},
                                   {"$set": {"status": "firmato", "otp_verified": True, "events": events}})
    return {"status": "firmato", "message": "Firma completata con successo (simulazione)"}


@api.delete("/signatures/{sig_id}")
async def delete_signature(sig_id: str, user: dict = Depends(get_current_user)):
    res = await db.signatures.delete_one({"_id": ObjectId(sig_id), "owner_id": str(user["_id"])})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Richiesta non trovata")
    return {"message": "Eliminata"}


# ---------- Cron: avvisi scadenze ----------
@api.post("/cron/expiry-alerts")
async def cron_expiry_alerts(request: Request, background_tasks: BackgroundTasks):
    # Cron endpoints must ack 2xx immediately; enqueue/background the actual work.
    secret = os.environ.get("WEBHOOK_CRON_SECRET", "")
    auth = request.headers.get("Authorization", "")
    token = auth[7:] if auth.startswith("Bearer ") else ""
    if not secret or not token or not hmac.compare_digest(token, secret):
        raise HTTPException(status_code=401, detail="Non autorizzato")
    run_id = request.headers.get("X-Webhook-Id", "")
    if run_id:
        if await db.cron_runs.find_one({"_id": run_id}):
            return {"status": "duplicate"}
        try:
            await db.cron_runs.insert_one({"_id": run_id, "at": now_iso()})
        except Exception:
            return {"status": "duplicate"}
    background_tasks.add_task(run_expiry_alerts, db)
    return {"status": "accepted"}


@api.get("/")
async def root():
    return {"message": "PolizzaHub API"}


app.include_router(auth_router)
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get('CORS_ORIGINS', 'http://localhost:3000').split(','),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    await create_auth_indexes(db)
    await seed_admin(db)
    await db.expiry_alerts_sent.create_index("key", unique=True)
    await db.cron_runs.create_index("at", expireAfterSeconds=604800)
    logger.info("PolizzaHub startup complete")


@app.on_event("shutdown")
async def shutdown():
    client.close()
