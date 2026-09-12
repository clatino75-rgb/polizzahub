"""Tests for new features: rinnovo rapido, excel mapping import, documents archive."""
import io
import json
import os
import pytest
import requests
from openpyxl import Workbook

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or "https://contract-flow-39.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
ADMIN_EMAIL = "clatino75@gmail.com"
ADMIN_PASSWORD = "Polizze2026!"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    assert r.status_code == 200, r.text
    return s


@pytest.fixture(scope="module")
def policy_id(session):
    payload = {"numero_polizza": "TEST-NEW-001", "contraente_nome": "TEST Renew",
               "ramo_polizza": "RCA", "data_effetto": "2025-05-01",
               "data_scadenza": "2026-05-01", "compagnia_emissione": "TEST"}
    r = session.post(f"{API}/policies", json=payload, timeout=15)
    assert r.status_code == 200
    pid = r.json()["id"]
    yield pid
    # cleanup
    session.delete(f"{API}/policies/{pid}", timeout=15)


# ---------- Renew ----------
class TestRenew:
    def test_renew_shifts_year(self, session, policy_id):
        r = session.post(f"{API}/policies/{policy_id}/renew", timeout=15)
        assert r.status_code == 200, r.text
        newp = r.json()
        assert newp["id"] != policy_id
        assert newp["data_effetto"] == "2026-05-01"
        assert newp["data_scadenza"] == "2027-05-01"
        assert newp["numero_polizza"] == "TEST-NEW-001"
        # cleanup
        session.delete(f"{API}/policies/{newp['id']}", timeout=15)

    def test_renew_unauth(self):
        r = requests.post(f"{API}/policies/xxx/renew", timeout=15)
        assert r.status_code == 401

    def test_renew_not_found(self, session):
        # valid objectid format but missing
        r = session.post(f"{API}/policies/507f1f77bcf86cd799439011/renew", timeout=15)
        assert r.status_code == 404


# ---------- Import Preview + Mapping ----------
class TestImportMapping:
    def test_preview_standard(self, session):
        # Get standard export template
        tpl = session.get(f"{API}/policies/export-template", timeout=20).content
        r = session.post(f"{API}/policies/import/preview",
                         files={"file": ("t.xlsx", tpl, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
                         timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "headers" in data and "sample" in data and "auto_map" in data and "field_options" in data
        assert len(data["headers"]) == 22
        assert len(data["field_options"]) == 22
        # Auto map should recognize standard labels
        assert data["auto_map"].get("Numero Polizza") == "numero_polizza"
        assert data["auto_map"].get("Contraente") == "contraente_nome"

    def test_preview_custom_headers(self, session):
        wb = Workbook()
        ws = wb.active
        ws.append(["Nr Polizza Custom", "Cliente", "Compagnia"])
        ws.append(["TEST-CUSTOM-1", "TEST Cliente A", "TEST Cia"])
        buf = io.BytesIO(); wb.save(buf); buf.seek(0)
        r = session.post(f"{API}/policies/import/preview",
                         files={"file": ("c.xlsx", buf.getvalue(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
                         timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert data["headers"] == ["Nr Polizza Custom", "Cliente", "Compagnia"]
        # None auto-matched for these custom labels (except maybe Compagnia? "Compagnia" is not exact label "Compagnia Emissione")
        assert data["auto_map"].get("Nr Polizza Custom", "") == ""
        assert data["auto_map"].get("Cliente", "") == ""

    def test_import_with_mapping(self, session):
        wb = Workbook()
        ws = wb.active
        ws.append(["Nr Polizza Custom", "Cliente", "Ramo"])
        ws.append(["TEST-MAPPED-1", "TEST Mapped Cliente", "RCA"])
        buf = io.BytesIO(); wb.save(buf); buf.seek(0)
        mapping = {"Nr Polizza Custom": "numero_polizza", "Cliente": "contraente_nome", "Ramo": "ramo_polizza"}
        r = session.post(f"{API}/policies/import",
                         files={"file": ("c.xlsx", buf.getvalue(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
                         data={"mapping": json.dumps(mapping)},
                         timeout=30)
        assert r.status_code == 200, r.text
        assert r.json()["imported"] == 1

        # verify persisted
        lst = session.get(f"{API}/policies", params={"search": "TEST-MAPPED-1"}, timeout=15).json()
        assert len(lst) >= 1
        assert lst[0]["contraente_nome"] == "TEST Mapped Cliente"
        # cleanup
        for p in lst:
            session.delete(f"{API}/policies/{p['id']}", timeout=15)


# ---------- Documents Archive ----------
class TestDocuments:
    def test_full_flow(self, session, policy_id):
        # upload
        pdf_bytes = b"%PDF-1.4\n%TEST\n%%EOF"
        r = session.post(f"{API}/policies/{policy_id}/documents",
                         files={"file": ("scan.pdf", pdf_bytes, "application/pdf")},
                         timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["filename"] == "scan.pdf"
        assert d["size"] == len(pdf_bytes)
        did = d["id"]

        # list
        lst = session.get(f"{API}/policies/{policy_id}/documents", timeout=15)
        assert lst.status_code == 200
        assert any(x["id"] == did for x in lst.json())

        # download
        dl = session.get(f"{API}/documents/{did}/download", timeout=15)
        assert dl.status_code == 200
        assert dl.content == pdf_bytes
        assert "attachment" in dl.headers.get("content-disposition", "")

        # delete
        rm = session.delete(f"{API}/documents/{did}", timeout=15)
        assert rm.status_code == 200

        # ensure gone
        dl2 = session.get(f"{API}/documents/{did}/download", timeout=15)
        assert dl2.status_code == 404

    def test_upload_unauth(self):
        r = requests.post(f"{API}/policies/xxx/documents", timeout=15)
        assert r.status_code == 401
