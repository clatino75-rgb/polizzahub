# PolizzaHub — PRD

## Problema originale
App italiana per la gestione delle polizze assicurative: estrazione automatica dei dati da PDF/JPEG, gestione anagrafiche (contraente/proprietario, numero polizza, date, frazionamento, premi netto/lordo annuale e semestrale, immatricolazione/voltura RCA, tipo/ramo, compagnia/agenzia), modifica/aggiunta manuale, scadenziario filtrabile per date, compilazione automatica di un PDF caricato con posizionamento visuale dei campi, invio in firma OTP via YouSign, import/export Excel delle anagrafiche.

## Architettura
- Backend: FastAPI + MongoDB (motor). Moduli: server.py, auth.py (JWT), extraction.py (GPT 5.4 vision via EMERGENT_LLM_KEY), pdf_utils.py (PyMuPDF render/fill), excel_utils.py (openpyxl).
- Frontend: React 19 + Tailwind + shadcn/ui, sonner, recharts, lucide-react. Tema chiaro blu/bianco.
- Auth: JWT httpOnly cookie, admin seed, password reset completo.

## Personas
- Agente/broker assicurativo che gestisce un portafoglio polizze e invia documenti in firma.

## Requisiti core (statici)
- CRUD polizze con tutti i campi assicurativi italiani
- Estrazione AI da PDF/JPEG
- Scadenziario con filtro date e stati (scaduta/in scadenza/attiva)
- Editor PDF con posizionamento visuale campi + generazione PDF compilato
- Flusso firma OTP (YouSign) — attualmente MOCK
- Import/Export Excel

## Implementato (2026-09-12)
- Auth JWT completo (login/register/logout/me/refresh/forgot/reset) — admin clatino75@gmail.com
- Polizze CRUD + ricerca
- Estrazione AI GPT 5.4 (verificata: estrae tutti i campi correttamente)
- Scadenziario + Dashboard stats con grafico per ramo
- Modelli PDF: upload, click-to-place campi, salvataggio posizioni, generazione PDF compilato
- Firma YouSign MOCK: crea richiesta, verifica OTP (4+ cifre), stati, download documento
- Import/Export/Template Excel

## Implementato (2026-09-12, iterazione 2)
- Import Excel con mappatura colonne personalizzate + report righe scartate
- Rinnovo Rapido polizza (duplica spostando le date +1 anno)
- Archivio documenti su polizza (GridFS): upload, anteprima in-app, download, elimina
- Estrazione AI: allega automaticamente il documento scansionato alla polizza
- "Aggiungi dati da PDF" dentro la scheda polizza: compila solo i campi vuoti (merge, no overwrite)
- Avvisi email scadenze via cron piattaforma (.emergent/crons.yml, /api/cron/expiry-alerts, digest per proprietario, idempotente)
- YouSign path reale cablato (create/upload/signer OTP SMS/activate + signature_link), attivo appena si inserisce YOUSIGN_API_KEY
- Registry separati: Anagrafiche, Compagnie, Collaboratori (CRUD manuale) via /api/registry/{kind}
- Auto-associazione polizza ad anagrafica esistente (match CF/P.IVA o nome) senza cancellare polizze precedenti; compagnia auto-creata; link anagrafica/compagnia/collaboratore nella scheda polizza
- Testato al 100% (backend + frontend E2E, iterazioni 1-4)

## Backlog / prossimi
- P1: Inserimento reale API key YouSign per firma OTP via SMS
- P2: Storage documenti su object storage esterno per volumi elevati
- P2: Report righe scartate esportabile

## Implementato (2026-09-12, iterazione 3)
- Scheda Cliente: apertura anagrafica con polizze collegate (come contraente o proprietario), premio totale e prossime scadenze (GET /api/anagrafiche/{id}/detail)
- Proprietario separato: campo proprietario_anagrafica_id sulla polizza + select dedicata; auto-creazione anagrafica proprietario distinta (tipo Proprietario)
- Report import Excel riga-per-riga (totali/importate/scartate + elenco righe scartate con motivo)
- Testato al 100% (iterazioni 1-5)
