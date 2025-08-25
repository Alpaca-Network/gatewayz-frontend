import os
import json
import pytest
from fastapi.testclient import TestClient

os.environ['VERCEL_API_KEY'] = 'test-vercel-key'
from gateway.app import app, init_db, get_user  # noqa: E402
from gateway.db import DB_PATH


@pytest.fixture(autouse=True)
def setup_db(tmp_path):
    os.environ['GATEWAY_DB'] = str(tmp_path / 'test.db')
    init_db()
    yield
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)


def test_create_and_use_key():
    client = TestClient(app)
    resp = client.post('/admin/create_user', json={'credits': 10})
    assert resp.status_code == 200
    data = resp.json()
    key = data['api_key']
    # Add credits
    client.post('/admin/add_credits', json={'api_key': key, 'credits': 5})
    user = get_user(key)
    assert user['credits'] == 15


def test_proxy_deducts_credits(monkeypatch):
    client = TestClient(app)
    resp = client.post('/admin/create_user', json={'credits': 100})
    key = resp.json()['api_key']

    class MockResponse:
        status_code = 200
        def json(self):
            return {"usage": {"total_tokens": 10}, "choices": []}

    async def mock_post(*args, **kwargs):
        return MockResponse()

    monkeypatch.setattr('httpx.AsyncClient.post', mock_post)
    headers = {"Authorization": f"Bearer {key}"}
    client.post('/v1/chat/completions', json={"model": "gpt-3", "messages": []}, headers=headers)
    user = get_user(key)
    assert user['credits'] == 90

