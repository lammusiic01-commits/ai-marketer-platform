import asyncio
import os
from pathlib import Path

os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///./.work/final-smoke.db"
os.environ["SECRET_KEY"] = "final-smoke-secret"
os.environ["APP_ENV"] = "test"
os.environ["OPENROUTER_API_KEY"] = ""

import httpx
from app.database import engine, init_db
from main import app


async def main():
    smoke_db = Path(".work/final-smoke.db")
    if smoke_db.exists():
        smoke_db.unlink()
    await init_db()
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        def check(condition, label):
            if not condition:
                raise AssertionError(label)
            print(f"PASS {label}")

        r = await c.post("/api/auth/register", json={"email": "qa-owner@gmail.com", "password": "qa-password-123", "name": "QA Owner"})
        if r.status_code != 200:
            print(f"DETAIL register: {r.status_code} {r.text}")
        check(r.status_code == 200, "register owner")
        owner = r.json()
        token = owner["token"]
        headers = {"Authorization": f"Bearer {token}"}

        r = await c.get("/api/auth/me", headers=headers)
        check(r.status_code == 200 and r.json()["email"] == "qa-owner@gmail.com", "auth me")

        r = await c.post("/api/projects", headers=headers, json={"name": "QA Chat Project", "website_url": "https://example.com", "industry": "SaaS", "description": "isolated"})
        check(r.status_code == 200, "create project")
        project = r.json()
        project_id = project["id"]

        r = await c.get(f"/api/chats/project/{project_id}", headers=headers)
        check(r.status_code == 200 and r.json()["type"] == "project", "project chat created")
        chat_id = r.json()["id"]

        r = await c.get("/api/chats", headers=headers)
        check(r.status_code == 200 and any(item["id"] == chat_id for item in r.json()), "list chats")

        r = await c.post(f"/api/chats/{chat_id}/messages", headers=headers, json={"body": "Первое сообщение"})
        check(r.status_code == 200 and r.json()["body"] == "Первое сообщение", "send message")
        message = r.json()
        message_id = message["id"]

        r = await c.get(f"/api/chats/{chat_id}/messages?limit=1", headers=headers)
        check(r.status_code == 200 and len(r.json()) == 1 and r.json()[0]["id"] == message_id, "paginate messages")

        r = await c.post(f"/api/messages/{message_id}/reactions", headers=headers, json={"emoji": "👍"})
        check(r.status_code == 200 and r.json()[0]["count"] == 1, "toggle reaction on")
        r = await c.post(f"/api/messages/{message_id}/reactions", headers=headers, json={"emoji": "👍"})
        check(r.status_code == 200 and r.json() == [], "toggle reaction off")

        r = await c.patch(f"/api/messages/{message_id}", headers=headers, json={"body": "Изменённое сообщение"})
        check(r.status_code == 200 and r.json()["edited_at"], "edit own message")

        r = await c.post(f"/api/chats/{chat_id}/messages", headers=headers, json={"body": "Ответ", "reply_to_id": message_id})
        check(r.status_code == 200 and r.json()["reply"]["id"] == message_id, "reply message")
        reply_id = r.json()["id"]

        r = await c.post(f"/api/chats/{chat_id}/read", headers=headers)
        check(r.status_code == 200 and r.json()["read"] is True, "mark chat read")

        r = await c.delete(f"/api/messages/{reply_id}", headers=headers)
        check(r.status_code == 200 and r.json()["deleted"] is True, "soft delete own message")
        r = await c.get(f"/api/chats/{chat_id}/messages", headers=headers)
        check(r.status_code == 200 and any(item["id"] == reply_id and item["deleted"] for item in r.json()), "deleted message remains tombstone")

        r = await c.post("/api/chats/direct", headers=headers, json={"user_id": owner["user"]["id"]})
        check(r.status_code == 422, "reject self direct chat")
        r = await c.post(f"/api/chats/{chat_id}/messages", headers=headers, json={"body": "", "attachments": []})
        check(r.status_code == 422, "reject empty message")

        print("PASS final isolated chat smoke")
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
