"""PolizzaHub backend tests - auth, policies CRUD, scadenziario, dashboard, extract, templates, signatures, excel."""
import io
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL") or "https://contract-flow-39.preview.emergentagent.com"
BASE_URL = BASE_URL.rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "clatino75@gmail.com"
ADMIN_PASSWORD = "Polizze2026!"


@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    data = r.json()
    assert data["email"] == ADMIN_EMAIL
    return s


@pytest.fixture(scope="session")
def created_ids():
    return {"policies": [], "templates": [], "signatures": []}


# ---------- Auth ----------
class TestAuth:
    def test_unauth_policies_returns_401(self):
        r = requests.get(f"{API}/policies", timeout=15)
        assert r.status_code == 401

    def test_login_and_me(self, session):
        r = session.get(f"{API}/auth/me", timeout=15)
        assert r.status_code == 200
        assert r.json()["email"] == ADMIN_EMAIL

    def test_login_wrong_password(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong"}, timeout=15)
        assert r.status_code in (401, 429)

    def test_register_new_user(self):
        s = requests.Session()
        email = f"testuser_{os.urandom(4).hex()}@example.com"
        r = s.post(f"{API}/auth/register", json={"email": email, "password": "Test1234!", "name": "TEST User"}, timeout=15)
        assert r.status_code == 200
        assert r.json()["email"] == email
        # session set
        me = s.get(f"{API}/auth/me", timeout=15)
        assert me.status_code == 200


# ---------- Policies CRUD ----------
class TestPolicies:
    def test_create_and_get(self, session, created_ids):
        payload = {"numero_polizza": "TEST-001", "contraente_nome": "TEST Mario",
                   "compagnia_emissione": "TEST Compagnia", "ramo_polizza": "RCA",
                   "data_scadenza": "2026-12-31", "premio_lordo_annuale": "1200,50",
                   "targa": "AB123CD"}
        r = session.post(f"{API}/policies", json=payload, timeout=15)
        assert r.status_code == 200
        p = r.json()
        assert p["numero_polizza"] == "TEST-001"
        assert "id" in p and "_id" not in p
        created_ids["policies"].append(p["id"])

        g = session.get(f"{API}/policies/{p['id']}", timeout=15)
        assert g.status_code == 200
        assert g.json()["contraente_nome"] == "TEST Mario"

    def test_list_and_search(self, session):
        r = session.get(f"{API}/policies", timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)
        r2 = session.get(f"{API}/policies", params={"search": "TEST-001"}, timeout=15)
        assert r2.status_code == 200
        assert any(x["numero_polizza"] == "TEST-001" for x in r2.json())

    def test_update(self, session, created_ids):
        pid = created_ids["policies"][0]
        r = session.put(f"{API}/policies/{pid}",
                        json={"numero_polizza": "TEST-001", "contraente_nome": "TEST Updated",
                              "ramo_polizza": "RCA"}, timeout=15)
        assert r.status_code == 200
        g = session.get(f"{API}/policies/{pid}", timeout=15)
        assert g.json()["contraente_nome"] == "TEST Updated"

    def test_scadenziario(self, session):
        r = session.get(f"{API}/scadenziario", params={"date_from": "2020-01-01", "date_to": "2030-12-31"}, timeout=15)
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        for it in items:
            assert it["status"] in ("scaduta", "in_scadenza", "attiva")

    def test_dashboard(self, session):
        r = session.get(f"{API}/dashboard/stats", timeout=15)
        assert r.status_code == 200
        d = r.json()
        for k in ("total_policies", "in_scadenza", "premio_totale", "ramo_distribution", "upcoming"):
            assert k in d


# ---------- Excel ----------
class TestExcel:
    def test_export_template(self, session):
        r = session.get(f"{API}/policies/export-template", timeout=20)
        assert r.status_code == 200
        assert "spreadsheetml" in r.headers.get("content-type", "")
        assert len(r.content) > 100

    def test_export(self, session):
        r = session.get(f"{API}/policies/export", timeout=20)
        assert r.status_code == 200
        assert len(r.content) > 100

    def test_import(self, session):
        # Get template, then re-upload
        tpl = session.get(f"{API}/policies/export-template", timeout=20).content
        # add a row via openpyxl
        from openpyxl import load_workbook
        wb = load_workbook(io.BytesIO(tpl))
        ws = wb.active
        headers = [c.value for c in ws[1]]
        row = ["" for _ in headers]
        mapping = {"Numero Polizza": "TEST-IMPORT-001", "Contraente": "TEST Imported", "Ramo Polizza": "RCA"}
        for label, val in mapping.items():
            if label in headers:
                row[headers.index(label)] = val
        ws.append(row)
        buf = io.BytesIO()
        wb.save(buf)
        buf.seek(0)
        r = session.post(f"{API}/policies/import",
                         files={"file": ("import.xlsx", buf.getvalue(),
                                         "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
                         timeout=30)
        assert r.status_code == 200, r.text
        assert r.json()["imported"] >= 1


# ---------- Templates ----------
def make_sample_pdf() -> bytes:
    import pymupdf as fitz
    doc = fitz.open()
    page = doc.new_page(width=595, height=842)
    page.insert_text((72, 72), "Contratto polizza TEST", fontsize=14)
    page.insert_text((72, 120), "Contraente: ______________", fontsize=11)
    page.insert_text((72, 150), "Numero polizza: __________", fontsize=11)
    b = doc.tobytes()
    doc.close()
    return b


class TestTemplates:
    def test_create_template_and_fields_and_generate(self, session, created_ids):
        pdf = make_sample_pdf()
        r = session.post(f"{API}/templates",
                         data={"name": "TEST Template"},
                         files={"file": ("t.pdf", pdf, "application/pdf")},
                         timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        tid = data["id"]
        created_ids["templates"].append(tid)
        assert "pages" in data and len(data["pages"]) >= 1
        assert "page_meta" in data

        # save fields
        fields = [{"key": "contraente_nome", "label": "Contraente", "page": 0, "x": 200, "y": 120, "font_size": 11},
                  {"key": "numero_polizza", "label": "Numero", "page": 0, "x": 200, "y": 150, "font_size": 11}]
        r2 = session.put(f"{API}/templates/{tid}/fields", json=fields, timeout=15)
        assert r2.status_code == 200

        # generate with a policy id
        pid = created_ids["policies"][0] if created_ids["policies"] else None
        body = {"policy_id": pid, "field_values": {"contraente_nome": "Override Name"}}
        r3 = session.post(f"{API}/templates/{tid}/generate", json=body, timeout=30)
        assert r3.status_code == 200, r3.text
        assert r3.headers.get("content-type", "").startswith("application/pdf")
        assert r3.content[:4] == b"%PDF"


# ---------- Signatures MOCK ----------
class TestSignatures:
    def test_signature_flow(self, session, created_ids):
        tid = created_ids["templates"][0]
        pid = created_ids["policies"][0] if created_ids["policies"] else None
        body = {"template_id": tid, "policy_id": pid, "signer_name": "TEST Signer",
                "signer_email": "signer@test.com", "signer_phone": "+391234567890", "field_values": {}}
        r = session.post(f"{API}/signatures", json=body, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["status"] == "inviato"
        sig_id = d["id"]
        created_ids["signatures"].append(sig_id)

        # list
        lst = session.get(f"{API}/signatures", timeout=15)
        assert lst.status_code == 200
        assert any(s["id"] == sig_id for s in lst.json())

        # get document
        doc = session.get(f"{API}/signatures/{sig_id}/document", timeout=15)
        assert doc.status_code == 200
        assert doc.content[:4] == b"%PDF"

        # verify OTP invalid
        bad = session.post(f"{API}/signatures/{sig_id}/verify-otp", json={"otp": "12"}, timeout=15)
        assert bad.status_code == 400

        # valid OTP
        ok = session.post(f"{API}/signatures/{sig_id}/verify-otp", json={"otp": "1234"}, timeout=15)
        assert ok.status_code == 200
        assert ok.json()["status"] == "firmato"


# ---------- Extract (AI) ----------
class TestExtract:
    def test_extract_fields_list(self, session):
        r = session.get(f"{API}/extract/fields", timeout=15)
        assert r.status_code == 200
        assert "fields" in r.json()

    def test_extract_pdf(self, session):
        import pymupdf as fitz
        doc = fitz.open()
        page = doc.new_page(width=595, height=842)
        text = ("POLIZZA RC AUTO\n"
                "Contraente: Mario Rossi\n"
                "CF: RSSMRA80A01H501U\n"
                "Numero polizza: 123456789\n"
                "Data effetto: 01/01/2025\n"
                "Data scadenza: 01/01/2026\n"
                "Frazionamento: annuale\n"
                "Premio lordo annuale: 850,00\n"
                "Compagnia: Generali\n"
                "Ramo: RCA\n"
                "Targa: AB123CD\n")
        page.insert_text((72, 72), text, fontsize=11)
        pdf_bytes = doc.tobytes()
        doc.close()
        r = session.post(f"{API}/extract",
                         files={"file": ("policy.pdf", pdf_bytes, "application/pdf")},
                         timeout=120)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "fields" in data
        # at least some fields extracted
        f = data["fields"]
        assert isinstance(f, dict)


# ---------- Cleanup ----------
class TestZCleanup:
    def test_delete_signatures(self, session, created_ids):
        for sid in created_ids["signatures"]:
            r = session.delete(f"{API}/signatures/{sid}", timeout=15)
            assert r.status_code == 200

    def test_delete_templates(self, session, created_ids):
        for tid in created_ids["templates"]:
            r = session.delete(f"{API}/templates/{tid}", timeout=15)
            assert r.status_code == 200

    def test_delete_policies(self, session, created_ids):
        # delete created + imported TEST_ prefixed
        for pid in created_ids["policies"]:
            session.delete(f"{API}/policies/{pid}", timeout=15)
        # cleanup imported
        lst = session.get(f"{API}/policies", params={"search": "TEST-IMPORT"}, timeout=15).json()
        for p in lst:
            session.delete(f"{API}/policies/{p['id']}", timeout=15)
