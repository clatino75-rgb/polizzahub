"""AI extraction of insurance policy fields from PDF/JPEG using OpenAI gpt-5.4 via Emergent LLM key."""
import os
import io
import json
import base64
import uuid
import logging

import pymupdf
from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent

logger = logging.getLogger(__name__)

EXTRACT_FIELDS = [
    "contraente_nome", "contraente_cf_piva", "contraente_indirizzo",
    "proprietario_nome", "proprietario_cf_piva", "proprietario_indirizzo",
    "numero_polizza", "data_effetto", "data_scadenza", "frazionamento",
    "premio_netto_annuale", "premio_lordo_annuale",
    "premio_netto_semestrale", "premio_lordo_semestrale",
    "data_immatricolazione", "data_voltura", "targa",
    "tipo_polizza", "ramo_polizza", "compagnia_emissione", "agenzia_emissione",
    "scatola_nera",
]

SYSTEM_MSG = (
    "Sei un assistente esperto nell'estrazione di dati da documenti assicurativi italiani. "
    "Ricevi le pagine di una polizza o documentazione come immagini. "
    "Estrai con precisione i campi richiesti. Restituisci SOLO un oggetto JSON valido, "
    "senza testo aggiuntivo, senza markdown. Le date devono essere in formato YYYY-MM-DD. "
    "Gli importi come numeri con punto decimale senza simboli di valuta (es. 1234.56). "
    "Il frazionamento deve essere uno tra: Annuale, Semestrale, Trimestrale, Mensile. "
    "Estrai anche l'elenco delle garanzie (coperture) come array 'garanzie': ogni voce con "
    "'nome', 'premio_netto' e 'premio_lordo' (numeri con punto decimale, senza simboli). "
    "Indica 'scatola_nera' con 'Sì' oppure 'No' in base alla presenza di box/scatola nera/"
    "dispositivo satellitare nella polizza. "
    "Se un campo non e presente nel documento, usa stringa vuota."
)


def _images_from_upload(file_bytes: bytes, filename: str):
    """Return list of base64 PNG strings (no data URI prefix). Converts PDF pages to images."""
    name = (filename or "").lower()
    images = []
    if name.endswith(".pdf"):
        doc = pymupdf.open(stream=file_bytes, filetype="pdf")
        for i, page in enumerate(doc):
            if i >= 6:
                break
            pix = page.get_pixmap(dpi=150)
            images.append(base64.b64encode(pix.tobytes("png")).decode())
        doc.close()
    else:
        # raster image: normalize to PNG via pymupdf
        try:
            doc = pymupdf.open(stream=file_bytes, filetype=None)
            pix = doc[0].get_pixmap(dpi=150) if doc.page_count else None
            if pix is not None:
                images.append(base64.b64encode(pix.tobytes("png")).decode())
            doc.close()
        except Exception:
            images.append(base64.b64encode(file_bytes).decode())
    return images


async def extract_policy_fields(file_bytes: bytes, filename: str) -> dict:
    api_key = os.environ.get("EMERGENT_LLM_KEY", "")
    if not api_key:
        raise RuntimeError("EMERGENT_LLM_KEY non configurata")
    images = _images_from_upload(file_bytes, filename)
    if not images:
        raise RuntimeError("Impossibile leggere il documento")

    chat = LlmChat(
        api_key=api_key,
        session_id=f"extract-{uuid.uuid4()}",
        system_message=SYSTEM_MSG,
    ).with_model("openai", "gpt-5.4")

    prompt = (
        "Estrai i seguenti campi da questa polizza assicurativa e restituisci un JSON con queste chiavi esatte:\n"
        + ", ".join(EXTRACT_FIELDS)
        + "\n\nRegole: date in YYYY-MM-DD, importi numerici, campi mancanti = \"\". "
        "data_immatricolazione, data_voltura e targa solo se e una polizza RCA/auto. "
        "Includi inoltre 'garanzie' come array di oggetti {nome, premio_netto, premio_lordo} "
        "e 'scatola_nera' con valore 'Sì' o 'No'."
    )
    image_contents = [ImageContent(image_base64=img) for img in images]
    msg = UserMessage(text=prompt, file_contents=image_contents)
    response = await chat.send_message(msg)

    text = response.strip()
    if text.startswith("```"):
        text = text.split("```", 2)[1]
        if text.lstrip().lower().startswith("json"):
            text = text.lstrip()[4:]
    text = text.strip().strip("`").strip()
    start, end = text.find("{"), text.rfind("}")
    if start != -1 and end != -1:
        text = text[start:end + 1]
    try:
        data = json.loads(text)
    except Exception as e:
        logger.error(f"JSON parse error: {e} | raw: {response[:400]}")
        raise RuntimeError("Estrazione non riuscita: risposta non valida")

    result = {k: (str(data.get(k, "")) if data.get(k) is not None else "") for k in EXTRACT_FIELDS}
    sn = result.get("scatola_nera", "").strip().lower()
    if sn in ("si", "sì", "s", "true", "presente", "yes"):
        result["scatola_nera"] = "Sì"
    elif sn in ("no", "n", "false", "assente"):
        result["scatola_nera"] = "No"
    else:
        result["scatola_nera"] = ""
    gar = data.get("garanzie")
    garanzie = []
    if isinstance(gar, list):
        for g in gar:
            if isinstance(g, dict):
                nome = str(g.get("nome", "") or "").strip()
                if not nome:
                    continue
                garanzie.append({
                    "nome": nome,
                    "premio_netto": str(g.get("premio_netto", "") or ""),
                    "premio_lordo": str(g.get("premio_lordo", "") or ""),
                })
    result["garanzie"] = garanzie
    return result
