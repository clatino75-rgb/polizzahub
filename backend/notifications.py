"""Email notifications for policy expiry alerts (reuses Emergent managed email)."""
import os
import logging
from datetime import date
from html import escape

import httpx
from bson import ObjectId

logger = logging.getLogger(__name__)

EMAIL_BASE_URL = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip().rstrip("/") or "https://integrations.emergentagent.com"
EMAIL_KEY = os.environ.get("EMERGENT_EMAIL_KEY", "")
EMAIL_FROM_NAME = os.environ.get("EMAIL_FROM_NAME") or "PolizzaHub"


async def send_email(to_email: str, subject: str, html: str) -> bool:
    if not EMAIL_KEY or EMAIL_KEY.startswith("{"):
        logger.warning("Email non configurata; salto invio a %s", to_email)
        return False
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{EMAIL_BASE_URL}/api/v1/email/send",
                headers={"X-Email-Key": EMAIL_KEY},
                json={"to": [to_email], "subject": subject, "html": html, "from_name": EMAIL_FROM_NAME},
            )
        resp.raise_for_status()
        return True
    except Exception as e:
        logger.error(f"Invio email fallito: {e}")
        return False


def _digest_html(name: str, items: list) -> str:
    rows = ""
    for p, dleft in items:
        when = "OGGI" if dleft == 0 else (f"tra {dleft} giorni")
        rows += (
            f"<tr>"
            f"<td style='padding:8px;border-bottom:1px solid #eee'>{escape(p.get('numero_polizza') or '—')}</td>"
            f"<td style='padding:8px;border-bottom:1px solid #eee'>{escape(p.get('contraente_nome') or '—')}</td>"
            f"<td style='padding:8px;border-bottom:1px solid #eee'>{escape(p.get('ramo_polizza') or '—')}</td>"
            f"<td style='padding:8px;border-bottom:1px solid #eee'><b>{escape(p.get('data_scadenza') or '')}</b> ({when})</td>"
            f"</tr>"
        )
    return (
        f"<div style='font-family:Arial,sans-serif;color:#0f172a'>"
        f"<h2 style='color:#0284C7'>Polizze in scadenza</h2>"
        f"<p>Ciao {escape(name)}, le seguenti polizze stanno per scadere. Ricordati di gestirne il rinnovo:</p>"
        f"<table style='border-collapse:collapse;width:100%'>"
        f"<tr style='background:#f1f5f9'>"
        f"<th style='text-align:left;padding:8px'>Numero</th>"
        f"<th style='text-align:left;padding:8px'>Contraente</th>"
        f"<th style='text-align:left;padding:8px'>Ramo</th>"
        f"<th style='text-align:left;padding:8px'>Scadenza</th></tr>"
        f"{rows}</table>"
        f"<p style='font-size:12px;color:#94a3b8;margin-top:16px'>Email automatica inviata da {escape(EMAIL_FROM_NAME)}.</p>"
        f"</div>"
    )


async def run_expiry_alerts(db) -> dict:
    """Scan policies, group per owner, send a digest, and record sent alerts (idempotent)."""
    today = date.today()
    per_owner = {}
    policies = await db.policies.find({"data_scadenza": {"$ne": ""}}).to_list(20000)
    for p in policies:
        try:
            dleft = (date.fromisoformat(p["data_scadenza"]) - today).days
        except Exception:
            continue
        if dleft < 0:
            continue
        bucket = "7" if dleft <= 7 else ("30" if dleft <= 30 else None)
        if not bucket:
            continue
        key = f"{p['_id']}:{p['data_scadenza']}:{bucket}"
        if await db.expiry_alerts_sent.find_one({"key": key}):
            continue
        per_owner.setdefault(p["owner_id"], []).append((p, dleft, key))

    owners_notified = 0
    policies_alerted = 0
    for owner_id, items in per_owner.items():
        try:
            user = await db.users.find_one({"_id": ObjectId(owner_id)})
        except Exception:
            user = None
        if not user or not user.get("email"):
            continue
        items.sort(key=lambda x: x[1])
        html = _digest_html(user.get("name") or "utente", [(p, d) for p, d, _ in items])
        subject = f"{len(items)} polizze in scadenza - {EMAIL_FROM_NAME}"
        ok = await send_email(user["email"], subject, html)
        if not ok:
            continue
        owners_notified += 1
        for p, _, key in items:
            await db.expiry_alerts_sent.insert_one(
                {"key": key, "policy_id": str(p["_id"]), "owner_id": owner_id})
            policies_alerted += 1
    logger.info("Expiry alerts: %s owner notificati, %s polizze", owners_notified, policies_alerted)
    return {"owners_notified": owners_notified, "policies_alerted": policies_alerted}
