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
- Testato al 100% (19/19 backend, flussi frontend E2E)

## Backlog / prossimi
- P1: Collegamento reale YouSign (API key OTP) — attualmente MOCK
- P2: Compilazione campi Excel personalizzati in import (mapping colonne extra)
- P2: Storage PDF via GridFS/object storage per file grandi
- P2: Notifiche email automatiche per scadenze imminenti
