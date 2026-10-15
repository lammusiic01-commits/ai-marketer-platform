from __future__ import annotations

import asyncio
import logging
import mimetypes
import uuid
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_user, project_access
from app.config import APP_URL, ROOT
from app.database import SessionLocal, get_db
from app.models import (
    Conversation,
    ConversationMember,
    Membership,
    Message,
    MessageReaction,
    Project,
    ProjectMember,
    User,
)
from app.security import decode_jwt
from app.services.link_preview import fetch_open_graph

router = APIRouter(prefix="/chats", tags=["chats"])
ws_router = APIRouter()
message_router = APIRouter(prefix="/messages", tags=["chats"])
UPLOAD_DIR = ROOT / "uploads" / "chats"
MAX_UPLOAD_BYTES = 20 * 1024 * 1024
MAX_ATTACHMENTS = 10
ALLOWED_REACTIONS = {
    ":thumbsup:": "👍",
    ":heart:": "❤️",
    ":joy:": "😂",
    ":open_mouth:": "😮",
    ":sob:": "😢",
    ":tada:": "🎉",
    "👍": "👍",
    "❤️": "❤️",
    "😂": "😂",
    "😮": "😮",
    "😢": "😢",
    "🎉": "🎉",
}


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


class DirectChatBody(BaseModel):
    user_id: int


class MessageBody(BaseModel):
    body: str = ""
    attachments: list[dict] = Field(default_factory=list)
    reply_to_id: int | None = None


class EditMessageBody(BaseModel):
    body: str = Field(min_length=1, max_length=10000)


class ReactionBody(BaseModel):
    emoji: str = Field(min_length=1, max_length=32)


class ProjectMemberBody(BaseModel):
    user_id: int
    role: str = "executor"


class ChatConnections:
    def __init__(self):
        self.by_conversation: dict[int, set[WebSocket]] = {}
        self.user_by_socket: dict[int, int] = {}
        self.lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket, user_id: int, conversation_ids: list[int]):
        await websocket.accept()
        async with self.lock:
            self.user_by_socket[id(websocket)] = user_id
            for conversation_id in conversation_ids:
                self.by_conversation.setdefault(conversation_id, set()).add(websocket)

    async def disconnect(self, websocket: WebSocket):
        async with self.lock:
            self.user_by_socket.pop(id(websocket), None)
            for conversation_id in list(self.by_conversation):
                clients = self.by_conversation[conversation_id]
                clients.discard(websocket)
                if not clients:
                    self.by_conversation.pop(conversation_id, None)

    async def revoke(self, conversation_id: int, user_id: int):
        async with self.lock:
            clients = self.by_conversation.get(conversation_id, set())
            for websocket in list(clients):
                if self.user_by_socket.get(id(websocket)) == user_id:
                    clients.discard(websocket)
            if not clients:
                self.by_conversation.pop(conversation_id, None)

    async def broadcast(self, conversation_id: int, payload: dict, exclude_user_id: int | None = None):
        async with self.lock:
            targets = list(self.by_conversation.get(conversation_id, set()))
            users = dict(self.user_by_socket)
        failed = []
        for websocket in targets:
            if exclude_user_id is not None and users.get(id(websocket)) == exclude_user_id:
                continue
            try:
                await websocket.send_json(payload)
            except Exception:
                failed.append(websocket)
        for websocket in failed:
            await self.disconnect(websocket)


connections = ChatConnections()


async def ensure_project_chat(db: AsyncSession, project: Project, member_ids: set[int] | None = None) -> Conversation:
    conversation = (
        await db.execute(
            select(Conversation).where(
                Conversation.type == "project",
                Conversation.project_id == project.id,
                Conversation.workspace_id == project.workspace_id,
            )
        )
    ).scalar_one_or_none()
    if conversation is None:
        conversation = Conversation(
            workspace_id=project.workspace_id,
            type="project",
            project_id=project.id,
            name=project.name,
        )
        db.add(conversation)
        await db.flush()
    else:
        conversation.name = project.name

    if member_ids is None:
        rows = await db.execute(select(ProjectMember.user_id).where(ProjectMember.project_id == project.id))
        member_ids = set(rows.scalars().all())
    member_ids = set(member_ids)
    member_ids.add(project.created_by)
    existing_rows = await db.execute(
        select(ConversationMember.user_id).where(ConversationMember.conversation_id == conversation.id)
    )
    existing = set(existing_rows.scalars().all())
    for user_id in member_ids - existing:
        db.add(ConversationMember(conversation_id=conversation.id, user_id=user_id, last_read_at=now_utc()))
    return conversation


async def ensure_existing_project_chats() -> None:
    async with SessionLocal() as db:
        projects = (await db.execute(select(Project))).scalars().all()
        for project in projects:
            await ensure_project_chat(db, project)
        await db.commit()


async def _conversation_access(conversation_id: int, user: User, db: AsyncSession) -> tuple[Conversation, ConversationMember]:
    conversation = await db.get(Conversation, conversation_id)
    if conversation is None:
        raise HTTPException(404, "Чат не найден")
    member = (
        await db.execute(
            select(ConversationMember).where(
                ConversationMember.conversation_id == conversation_id,
                ConversationMember.user_id == user.id,
            )
        )
    ).scalar_one_or_none()
    if member is None:
        raise HTTPException(403, "Нет доступа к чату")

    if conversation.type == "direct":
        workspace_member = (
            await db.execute(
                select(Membership.id).where(
                    Membership.workspace_id == conversation.workspace_id,
                    Membership.user_id == user.id,
                )
            )
        ).scalar_one_or_none()
        if not workspace_member or conversation.workspace_id != getattr(user, "active_workspace_id", None):
            raise HTTPException(403, "Нет доступа к чату")
    elif conversation.type == "project" and conversation.project_id is not None:
        workspace_member = (
            await db.execute(
                select(Membership.id).where(
                    Membership.workspace_id == conversation.workspace_id,
                    Membership.user_id == user.id,
                )
            )
        ).scalar_one_or_none()
        project_member = (
            await db.execute(
                select(ProjectMember.id).where(
                    ProjectMember.project_id == conversation.project_id,
                    ProjectMember.user_id == user.id,
                )
            )
        ).scalar_one_or_none()
        if not workspace_member and not project_member:
            raise HTTPException(403, "Нет доступа к чату проекта")
    else:
        raise HTTPException(403, "Недопустимый тип чата")
    return conversation, member


def _safe_attachments(items: list[dict]) -> list[dict]:
    if len(items) > MAX_ATTACHMENTS:
        raise HTTPException(422, "Можно прикрепить не более 10 файлов")
    clean = []
    for item in items:
        kind = str(item.get("type", ""))
        url = str(item.get("url", ""))
        name = str(item.get("name", "Файл"))[:255]
        try:
            size = max(0, min(int(item.get("size", 0)), MAX_UPLOAD_BYTES))
        except (TypeError, ValueError):
            raise HTTPException(422, "Некорректный размер вложения")
        if kind not in {"image", "file", "link"}:
            raise HTTPException(422, "Недопустимый тип вложения")
        if kind == "link":
            parsed = urlparse(url)
            if parsed.scheme not in {"http", "https"} or not parsed.netloc:
                raise HTTPException(422, "Ссылка должна начинаться с http:// или https://")
        elif not url.startswith("/uploads/chats/") or ".." in url or "\\" in url:
            raise HTTPException(422, "Недопустимый адрес вложения")
        record = {"type": kind, "url": url, "name": name, "size": size}
        if item.get("thumbnail_url") and str(item["thumbnail_url"]).startswith("/uploads/chats/") and ".." not in str(item["thumbnail_url"]):
            record["thumbnail_url"] = str(item["thumbnail_url"])
        clean.append(record)
    return clean


async def _serialize_message(db: AsyncSession, message: Message, viewer_id: int) -> dict:
    author = await db.get(User, message.author_id)
    reaction_rows = await db.execute(
        select(MessageReaction.emoji, func.count(MessageReaction.id))
        .where(MessageReaction.message_id == message.id)
        .group_by(MessageReaction.emoji)
    )
    reactions = []
    for emoji, count in reaction_rows.all():
        mine = (
            await db.execute(
                select(MessageReaction.id).where(
                    MessageReaction.message_id == message.id,
                    MessageReaction.user_id == viewer_id,
                    MessageReaction.emoji == emoji,
                )
            )
        ).scalar_one_or_none() is not None
        reactions.append({"emoji": emoji, "count": count, "mine": mine})
    reply = None
    if message.reply_to_id:
        parent = await db.get(Message, message.reply_to_id)
        if parent and not parent.deleted:
            reply_author = await db.get(User, parent.author_id)
            reply = {"id": parent.id, "body": parent.body[:300], "author_name": reply_author.name if reply_author else ""}
    return {
        "id": message.id,
        "conversation_id": message.conversation_id,
        "author_id": message.author_id,
        "author_name": author.name if author else "Удалённый пользователь",
        "author_avatar_url": author.avatar_url if author else None,
        "body": message.body,
        "attachments": message.attachments or [],
        "reply_to_id": message.reply_to_id,
        "reply": reply,
        "edited_at": message.edited_at.isoformat() if message.edited_at else None,
        "created_at": message.created_at.isoformat(),
        "deleted": message.deleted,
        "reactions": reactions,
    }


@router.get("")
async def list_chats(user=Depends(current_user), db: AsyncSession = Depends(get_db)):
    rows = (
        await db.execute(
            select(Conversation, ConversationMember)
            .join(ConversationMember, ConversationMember.conversation_id == Conversation.id)
            .where(ConversationMember.user_id == user.id)
            .order_by(Conversation.created_at.desc())
        )
    ).all()
    result = []
    for conversation, membership in rows:
        # Direct messages are scoped to the currently selected workspace. Project chats may
        # also be available through an explicit ProjectMember record.
        if conversation.type == "direct":
            allowed = (
                conversation.workspace_id == getattr(user, "active_workspace_id", None)
                and (await db.execute(select(Membership.id).where(Membership.workspace_id == conversation.workspace_id, Membership.user_id == user.id))).scalar_one_or_none() is not None
            )
        else:
            workspace_member = (await db.execute(select(Membership.id).where(Membership.workspace_id == conversation.workspace_id, Membership.user_id == user.id))).scalar_one_or_none()
            project_member = (await db.execute(select(ProjectMember.id).where(ProjectMember.project_id == conversation.project_id, ProjectMember.user_id == user.id))).scalar_one_or_none() if conversation.project_id else None
            allowed = bool(workspace_member or project_member)
        if not allowed:
            continue
        last = (
            await db.execute(
                select(Message)
                .where(Message.conversation_id == conversation.id)
                .order_by(Message.created_at.desc(), Message.id.desc())
                .limit(1)
            )
        ).scalar_one_or_none()
        unread = (
            await db.execute(
                select(func.count(Message.id)).where(
                    Message.conversation_id == conversation.id,
                    Message.author_id != user.id,
                    Message.created_at > membership.last_read_at,
                    Message.deleted.is_(False),
                )
            )
        ).scalar_one()
        members = (
            await db.execute(
                select(User.id, User.name, User.avatar_url)
                .join(ConversationMember, ConversationMember.user_id == User.id)
                .where(ConversationMember.conversation_id == conversation.id)
            )
        ).all()
        last_preview = None
        if last:
            author = await db.get(User, last.author_id)
            last_preview = {
                "id": last.id,
                "body": "Сообщение удалено" if last.deleted else last.body,
                "author_id": last.author_id,
                "author_name": author.name if author else "",
                "created_at": last.created_at.isoformat(),
                "has_attachments": bool(last.attachments),
            }
        result.append({
            "id": conversation.id,
            "workspace_id": conversation.workspace_id,
            "type": conversation.type,
            "project_id": conversation.project_id,
            "name": conversation.name,
            "created_at": conversation.created_at.isoformat(),
            "unread_count": int(unread or 0),
            "last_message": last_preview,
            "members": [{"id": row.id, "name": row.name, "avatar_url": row.avatar_url} for row in members],
        })
    result.sort(key=lambda item: item["last_message"]["created_at"] if item["last_message"] else item["created_at"], reverse=True)
    return result


@router.post("/direct")
async def create_or_get_direct(body: DirectChatBody, user=Depends(current_user), db: AsyncSession = Depends(get_db)):
    workspace_id = getattr(user, "active_workspace_id", None)
    creator_member = (
        await db.execute(
            select(Membership.id).where(Membership.workspace_id == workspace_id, Membership.user_id == user.id)
        )
    ).scalar_one_or_none()
    if creator_member is None:
        raise HTTPException(403, "Нет доступа к текущему рабочему пространству")
    if body.user_id == user.id:
        raise HTTPException(422, "Нельзя создать личный чат с самим собой")
    target_member = (
        await db.execute(
            select(Membership.id).where(Membership.workspace_id == workspace_id, Membership.user_id == body.user_id)
        )
    ).scalar_one_or_none()
    if target_member is None:
        raise HTTPException(404, "Участник не найден в текущем рабочем пространстве")
    peer = await db.get(User, body.user_id)
    if peer is None:
        raise HTTPException(404, "Пользователь не найден")
    conversation_ids = (
        select(ConversationMember.conversation_id)
        .join(Conversation, Conversation.id == ConversationMember.conversation_id)
        .where(
            Conversation.type == "direct",
            Conversation.workspace_id == workspace_id,
            ConversationMember.user_id.in_([user.id, body.user_id]),
        )
        .group_by(ConversationMember.conversation_id)
        .having(func.count(func.distinct(ConversationMember.user_id)) == 2)
    )
    conversation = (
        await db.execute(select(Conversation).where(Conversation.id.in_(conversation_ids)).order_by(Conversation.id).limit(1))
    ).scalar_one_or_none()
    if conversation is None:
        conversation = Conversation(workspace_id=workspace_id, type="direct", project_id=None, name=None)
        db.add(conversation)
        await db.flush()
        db.add_all([
            ConversationMember(conversation_id=conversation.id, user_id=user.id, last_read_at=now_utc()),
            ConversationMember(conversation_id=conversation.id, user_id=peer.id, last_read_at=now_utc()),
        ])
        await db.commit()
        await db.refresh(conversation)
    return {"id": conversation.id, "workspace_id": conversation.workspace_id, "type": conversation.type, "name": conversation.name, "members": [{"id": user.id, "name": user.name}, {"id": peer.id, "name": peer.name}]}


@router.get("/project/{project_id}")
async def get_project_chat(project_id: int, user=Depends(current_user), db: AsyncSession = Depends(get_db)):
    project = await project_access(project_id, user, db)
    project_members = await db.execute(select(ProjectMember.user_id).where(ProjectMember.project_id == project_id))
    member_ids = set(project_members.scalars().all())
    member_ids.add(user.id)
    conversation = await ensure_project_chat(db, project, member_ids)
    await db.commit()
    return {"id": conversation.id, "workspace_id": conversation.workspace_id, "type": conversation.type, "project_id": conversation.project_id, "name": conversation.name}


@router.get("/{conversation_id}/messages")
async def get_messages(
    conversation_id: int,
    before: int | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=100),
    user=Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    await _conversation_access(conversation_id, user, db)
    query = select(Message).where(Message.conversation_id == conversation_id)
    if before is not None:
        cursor = await db.get(Message, before)
        if cursor and cursor.conversation_id == conversation_id:
            query = query.where((Message.created_at < cursor.created_at) | ((Message.created_at == cursor.created_at) & (Message.id < cursor.id)))
    rows = (await db.execute(query.order_by(Message.created_at.desc(), Message.id.desc()).limit(limit))).scalars().all()
    rows.reverse()
    return [await _serialize_message(db, row, user.id) for row in rows]


@router.post("/{conversation_id}/messages")
async def send_message(conversation_id: int, body: MessageBody, user=Depends(current_user), db: AsyncSession = Depends(get_db)):
    await _conversation_access(conversation_id, user, db)
    text = body.body.strip()
    attachments = _safe_attachments(body.attachments or [])
    if not text and not attachments:
        raise HTTPException(422, "Добавьте текст или вложение")
    if len(text) > 10000:
        raise HTTPException(422, "Сообщение не может быть длиннее 10 000 символов")
    if body.reply_to_id is not None:
        parent = await db.get(Message, body.reply_to_id)
        if not parent or parent.conversation_id != conversation_id or parent.deleted:
            raise HTTPException(404, "Сообщение для ответа не найдено")
    message = Message(
        conversation_id=conversation_id,
        author_id=user.id,
        body=text,
        attachments=attachments,
        reply_to_id=body.reply_to_id,
        created_at=now_utc(),
        deleted=False,
    )
    db.add(message)
    await db.commit()
    await db.refresh(message)
    payload = await _serialize_message(db, message, user.id)
    await connections.broadcast(conversation_id, {"type": "new_message", "conversation_id": conversation_id, "message": payload}, exclude_user_id=user.id)
    return payload


@message_router.patch("/{message_id}")
async def edit_message(message_id: int, body: EditMessageBody, user=Depends(current_user), db: AsyncSession = Depends(get_db)):
    message = await db.get(Message, message_id)
    if not message:
        raise HTTPException(404, "Сообщение не найдено")
    conversation, _ = await _conversation_access(message.conversation_id, user, db)
    text = body.body.strip()
    if message.author_id != user.id:
        raise HTTPException(403, "Редактировать можно только свои сообщения")
    if message.deleted:
        raise HTTPException(409, "Удалённое сообщение нельзя изменить")
    if not text and not message.attachments:
        raise HTTPException(422, "Сообщение не может быть пустым")
    message.body = text
    message.edited_at = now_utc()
    await db.commit()
    await db.refresh(message)
    payload = await _serialize_message(db, message, user.id)
    await connections.broadcast(conversation.id, {"type": "message_edited", "message": payload}, exclude_user_id=user.id)
    return payload


@message_router.delete("/{message_id}")
async def delete_message(message_id: int, user=Depends(current_user), db: AsyncSession = Depends(get_db)):
    message = await db.get(Message, message_id)
    if not message:
        raise HTTPException(404, "Сообщение не найдено")
    conversation, _ = await _conversation_access(message.conversation_id, user, db)
    if message.author_id != user.id:
        raise HTTPException(403, "Удалить можно только свои сообщения")
    message.deleted = True
    message.body = ""
    message.attachments = []
    await db.commit()
    await connections.broadcast(conversation.id, {"type": "message_deleted", "conversation_id": conversation.id, "message_id": message_id}, exclude_user_id=user.id)
    return {"deleted": True, "message_id": message_id}


@message_router.post("/{message_id}/reactions")
async def add_reaction(message_id: int, body: ReactionBody, user=Depends(current_user), db: AsyncSession = Depends(get_db)):
    emoji = body.emoji.strip()
    if emoji not in ALLOWED_REACTIONS:
        raise HTTPException(422, "Недопустимая реакция")
    message = await db.get(Message, message_id)
    if not message or message.deleted:
        raise HTTPException(404, "Сообщение не найдено")
    conversation, _ = await _conversation_access(message.conversation_id, user, db)
    existing = (
        await db.execute(
            select(MessageReaction).where(
                MessageReaction.message_id == message_id,
                MessageReaction.user_id == user.id,
                MessageReaction.emoji == emoji,
            )
        )
    ).scalar_one_or_none()
    if existing:
        await db.delete(existing)
    else:
        db.add(MessageReaction(message_id=message_id, user_id=user.id, emoji=emoji, created_at=now_utc()))
    await db.commit()
    payload = await _serialize_message(db, message, user.id)
    await connections.broadcast(conversation.id, {"type": "message_edited", "message": payload}, exclude_user_id=user.id)
    return payload["reactions"]


@message_router.delete("/{message_id}/reactions/{emoji}")
async def remove_reaction(message_id: int, emoji: str, user=Depends(current_user), db: AsyncSession = Depends(get_db)):
    message = await db.get(Message, message_id)
    if not message:
        raise HTTPException(404, "Сообщение не найдено")
    conversation, _ = await _conversation_access(message.conversation_id, user, db)
    reaction = (
        await db.execute(
            select(MessageReaction).where(
                MessageReaction.message_id == message_id,
                MessageReaction.user_id == user.id,
                MessageReaction.emoji == emoji,
            )
        )
    ).scalar_one_or_none()
    if reaction:
        await db.delete(reaction)
        await db.commit()
    payload = await _serialize_message(db, message, user.id)
    await connections.broadcast(conversation.id, {"type": "message_edited", "message": payload}, exclude_user_id=user.id)
    return payload["reactions"]


@router.post("/{conversation_id}/read")
async def mark_read(conversation_id: int, user=Depends(current_user), db: AsyncSession = Depends(get_db)):
    _, member = await _conversation_access(conversation_id, user, db)
    member.last_read_at = now_utc()
    await db.commit()
    return {"read": True, "conversation_id": conversation_id, "last_read_at": member.last_read_at.isoformat()}

@router.get("/link-preview")
async def get_link_preview(url: str = Query(min_length=8, max_length=2048), user=Depends(current_user)):
    try:
        return await fetch_open_graph(url)
    except ValueError as error:
        raise HTTPException(422, str(error))


@router.post("/upload")
async def upload_chat_file(file: UploadFile = File(...), user=Depends(current_user), db: AsyncSession = Depends(get_db)):
    workspace_id = getattr(user, "active_workspace_id", None)
    member = (await db.execute(select(Membership.id).where(Membership.workspace_id == workspace_id, Membership.user_id == user.id))).scalar_one_or_none()
    if not member:
        raise HTTPException(403, "Нет доступа к рабочему пространству")
    raw = await file.read(MAX_UPLOAD_BYTES + 1)
    if not raw:
        raise HTTPException(422, "Файл пуст")
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "Максимальный размер файла — 20 МБ")
    content_type = (file.content_type or mimetypes.guess_type(file.filename or "")[0] or "").lower()
    original_name = Path(file.filename or "file").name[:255]
    file_id = uuid.uuid4().hex
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

    if content_type.startswith("image/"):
        try:
            from PIL import Image, ImageOps
            from io import BytesIO
            image = Image.open(BytesIO(raw))
            image = ImageOps.exif_transpose(image)
            image.load()
            if image.width * image.height > 40_000_000:
                raise HTTPException(413, "Изображение слишком большое")
            if image.mode not in ("RGB", "RGBA"):
                image = image.convert("RGBA" if "transparency" in image.info else "RGB")
            image.thumbnail((2400, 2400))
            original_path = UPLOAD_DIR / f"{file_id}.webp"
            image.save(original_path, "WEBP", quality=88, method=6)
            thumb = image.copy()
            thumb.thumbnail((400, 400))
            thumbnail_path = UPLOAD_DIR / f"{file_id}_thumb.webp"
            thumb.save(thumbnail_path, "WEBP", quality=80, method=5)
            result = {"url": f"/uploads/chats/{file_id}.webp", "thumbnail_url": f"/uploads/chats/{file_id}_thumb.webp", "type": "image", "name": original_name, "size": len(raw)}
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(415, "Не удалось распознать изображение")
    elif content_type == "application/pdf" and raw.startswith(b"%PDF-"):
        (UPLOAD_DIR / f"{file_id}.pdf").write_bytes(raw)
        result = {"url": f"/uploads/chats/{file_id}.pdf", "type": "file", "name": original_name, "size": len(raw)}
    elif content_type.startswith("text/") and b"\x00" not in raw:
        try:
            raw.decode("utf-8")
        except UnicodeDecodeError:
            raise HTTPException(415, "Текстовый файл должен быть в UTF-8")
        (UPLOAD_DIR / f"{file_id}.txt").write_bytes(raw)
        result = {"url": f"/uploads/chats/{file_id}.txt", "type": "file", "name": original_name, "size": len(raw)}
    else:
        raise HTTPException(415, "Разрешены изображения, PDF и текстовые файлы")
    return result


@ws_router.websocket("/ws/chats")
async def chat_websocket(websocket: WebSocket, token: str = Query(default="")):
    if not token:
        await websocket.close(code=4401)
        return
    try:
        claims = decode_jwt(token)
        user_id = int(claims["sub"])
        workspace_id = int(claims.get("workspace_id", 0))
    except Exception:
        await websocket.close(code=4401)
        return

    async with SessionLocal() as db:
        user = await db.get(User, user_id)
        if not user:
            await websocket.close(code=4401)
            return
        rows = (
            await db.execute(
                select(ConversationMember.conversation_id, Conversation.type, Conversation.project_id, Conversation.workspace_id)
                .join(Conversation, Conversation.id == ConversationMember.conversation_id)
                .where(ConversationMember.user_id == user_id)
            )
        ).all()
        project_ids = set((await db.execute(select(ProjectMember.project_id).where(ProjectMember.user_id == user_id))).scalars().all())
        allowed_ids = []
        for conversation_id, conversation_type, project_id, conversation_workspace_id in rows:
            if conversation_type == "direct":
                if conversation_workspace_id == workspace_id and (await db.execute(select(Membership.id).where(Membership.workspace_id == workspace_id, Membership.user_id == user_id))).scalar_one_or_none():
                    allowed_ids.append(conversation_id)
            elif conversation_type == "project" and (project_id in project_ids or (await db.execute(select(Membership.id).where(Membership.workspace_id == conversation_workspace_id, Membership.user_id == user_id))).scalar_one_or_none()):
                allowed_ids.append(conversation_id)

    await connections.connect(websocket, user_id, allowed_ids)
    try:
        while True:
            event = await websocket.receive_json()
            if not isinstance(event, dict) or event.get("type") != "typing":
                continue
            try:
                conversation_id = int(event.get("conversation_id"))
            except (TypeError, ValueError):
                continue
            if conversation_id in allowed_ids:
                async with SessionLocal() as db:
                    active_member = (
                        await db.execute(
                            select(ConversationMember.id).where(
                                ConversationMember.conversation_id == conversation_id,
                                ConversationMember.user_id == user_id,
                            )
                        )
                    ).scalar_one_or_none()
                    conversation = await db.get(Conversation, conversation_id)
                    if active_member and conversation and conversation.type == "direct":
                        active_member = (
                            await db.execute(
                                select(Membership.id).where(
                                    Membership.workspace_id == workspace_id,
                                    Membership.user_id == user_id,
                                )
                            )
                        ).scalar_one_or_none()
                    if active_member and conversation and conversation.type == "project":
                        project_member = (
                            await db.execute(
                                select(ProjectMember.id).where(
                                    ProjectMember.project_id == conversation.project_id,
                                    ProjectMember.user_id == user_id,
                                )
                            )
                        ).scalar_one_or_none()
                        workspace_member = (
                            await db.execute(
                                select(Membership.id).where(
                                    Membership.workspace_id == conversation.workspace_id,
                                    Membership.user_id == user_id,
                                )
                            )
                        ).scalar_one_or_none()
                        active_member = project_member or workspace_member
                if active_member:
                    await connections.broadcast(
                        conversation_id,
                        {"type": "typing", "conversation_id": conversation_id, "user_id": user_id},
                        exclude_user_id=user_id,
                    )
    except WebSocketDisconnect as disconnect_event:
        logging.getLogger(__name__).debug("Chat WebSocket closed with code %s", disconnect_event.code)
    finally:
        await connections.disconnect(websocket)
