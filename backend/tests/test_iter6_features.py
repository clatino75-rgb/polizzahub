"""Iteration 6: filters, collaboratore dashboard, storico cliente."""
import os
import pytest
import requests

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or "").rstrip("/")
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
def collaboratore(session):
    r = session.post(f"{API}/registry/collaboratori", json={"nome": "TEST Collab I6", "email": "test_i6_collab@example.com"}, timeout=15)
    assert r.status_code == 200, r.text
    cid = r.json()["id"]
    yield cid
    session.delete(f"{API}/registry/collaboratori/{cid}", timeout=15)


@pytest.fixture(scope="module")
def compagnia(session):
    r = session.post(f"{API}/registry/compagnie", json={"nome": "TEST Cia I6"}, timeout=15)
    assert r.status_code == 200, r.text
    cid = r.json()["id"]
    yield cid
    session.delete(f"{API}/registry/compagnie/{cid}", timeout=15)


def _make_policy(session, num, contraente, ramo, collab_id=None, comp_id=None, scadenza="2027-01-01", premio="300"):
    payload = {
        "numero_polizza": num, "contraente_nome": contraente,
        "ramo_polizza": ramo, "data_effetto": "2026-01-01",
        "data_scadenza": scadenza, "premio_lordo_annuale": str(premio),
        "compagnia_emissione": "TEST Cia I6",
    }
    if collab_id:
        payload["collaboratore_id"] = collab_id
    if comp_id:
        payload["compagnia_id"] = comp_id
    r = session.post(f"{API}/policies", json=payload, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["id"]


class TestFilters:
    def test_rami_endpoint(self, session):
        r = session.get(f"{API}/policies/rami", timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_filter_by_collaboratore_ramo_compagnia(self, session, collaboratore, compagnia):
        p1 = _make_policy(session, "TEST-I6-F1", "TEST Filter A", "RCA", collab_id=collaboratore, comp_id=compagnia)
        p2 = _make_policy(session, "TEST-I6-F2", "TEST Filter B", "Casa", comp_id=compagnia)
        try:
            # filter by collaboratore
            r = session.get(f"{API}/policies", params={"collaboratore_id": collaboratore}, timeout=15)
            ids = [p["id"] for p in r.json()]
            assert p1 in ids and p2 not in ids
            # filter by ramo
            r = session.get(f"{API}/policies", params={"ramo": "RCA"}, timeout=15)
            ids = [p["id"] for p in r.json()]
            assert p1 in ids and p2 not in ids
            # filter by compagnia_id
            r = session.get(f"{API}/policies", params={"compagnia_id": compagnia}, timeout=15)
            ids = [p["id"] for p in r.json()]
            assert p1 in ids and p2 in ids
            # combined AND
            r = session.get(f"{API}/policies", params={"compagnia_id": compagnia, "ramo": "Casa"}, timeout=15)
            ids = [p["id"] for p in r.json()]
            assert p2 in ids and p1 not in ids
        finally:
            session.delete(f"{API}/policies/{p1}", timeout=15)
            session.delete(f"{API}/policies/{p2}", timeout=15)


class TestCollaboratoreDetail:
    def test_detail_stats(self, session, collaboratore):
        p1 = _make_policy(session, "TEST-I6-C1", "TEST Coll Client", "RCA", collab_id=collaboratore, premio=300)
        try:
            r = session.get(f"{API}/collaboratori/{collaboratore}/detail", timeout=15)
            assert r.status_code == 200, r.text
            data = r.json()
            assert "collaboratore" in data
            assert "policies" in data and "stats" in data
            assert data["stats"]["count"] >= 1
            assert float(data["stats"]["premio_totale"]) >= 300
            assert any(p["id"] == p1 for p in data["policies"])
        finally:
            session.delete(f"{API}/policies/{p1}", timeout=15)


class TestStoricoCliente:
    def test_expired_stats(self, session):
        p = _make_policy(session, "TEST-I6-S1", "TEST Storico I6", "RCA",
                         scadenza="2020-01-01", premio=250)
        try:
            # find auto-created anagrafica
            r = session.get(f"{API}/registry/anagrafiche", params={"search": "TEST Storico I6"}, timeout=15)
            assert r.status_code == 200
            arr = r.json()
            assert len(arr) >= 1
            aid = arr[0]["id"]
            det = session.get(f"{API}/registry/anagrafiche/{aid}/detail", timeout=15).json() if False else session.get(f"{API}/anagrafiche/{aid}/detail", timeout=15).json()
            expired = det["stats"].get("expired", [])
            expired_count = len(expired) if isinstance(expired, list) else int(expired)
            assert expired_count >= 1, f"expected expired>=1, got {expired}"
            # policy is expired -> present in policies list
            assert any(pp["id"] == p for pp in det["policies"])
        finally:
            session.delete(f"{API}/policies/{p}", timeout=15)
