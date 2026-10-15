from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_user, project_access
from app.api.routes.chats import connections, ensure_project_chat
from app.database import get_db
from app.models import Conversation, ConversationMember, Membership, ProjectMember, User

router = APIRouter(prefix="/projects", tags=["project-members"])


class ProjectMemberBody(BaseModel):
    user_id: int
    role: str = "executor"


async def _require_manager(project_id: int, project_workspace_id: int, user: User, db: AsyncSession):
    workspace_role = (
        await db.execute(
            select(Membership.role).where(
                Membership.workspace_id == project_workspace_id,
                Membership.user_id == user.id,
            )
        )
    ).scalar_one_or_none()
    project_role = (
        await db.execute(
            select(ProjectMember.role).where(
                ProjectMember.project_id == project_id,
                ProjectMember.user_id == user.id,
            )
        )
    ).scalar_one_or_none()
    if workspace_role not in {"owner", "admin", "manager"} and project_role != "lead":
        raise HTTPException(403, "Недостаточно прав для управления участниками проекта")


@router.get("/{project_id}/members")
async def list_project_members(project_id: int, user=Depends(current_user), db: AsyncSession = Depends(get_db)):
    project = await project_access(project_id, user, db)
    rows = (
        await db.execute(
            select(User, ProjectMember)
            .join(ProjectMember, ProjectMember.user_id == User.id)
            .where(ProjectMember.project_id == project.id)
            .order_by(User.name)
        )
    ).all()
    return [
        {"id": member.id, "name": member.name, "email": member.email, "role": membership.role, "created_at": membership.created_at.isoformat()}
        for member, membership in rows
    ]


@router.post("/{project_id}/members")
async def add_project_member(project_id: int, body: ProjectMemberBody, user=Depends(current_user), db: AsyncSession = Depends(get_db)):
    project = await project_access(project_id, user, db, edit=True)
    await _require_manager(project_id, project.workspace_id, user, db)
    if body.role not in {"lead", "executor", "observer"}:
        raise HTTPException(422, "Недопустимая роль проекта")
    target = await db.get(User, body.user_id)
    if not target:
        raise HTTPException(404, "Пользователь не найден")
    target_membership = (
        await db.execute(
            select(Membership.id).where(
                Membership.workspace_id == project.workspace_id,
                Membership.user_id == body.user_id,
            )
        )
    ).scalar_one_or_none()
    if not target_membership:
        raise HTTPException(404, "Пользователь не входит в рабочее пространство проекта")

    membership = (
        await db.execute(
            select(ProjectMember).where(
                ProjectMember.project_id == project_id,
                ProjectMember.user_id == body.user_id,
            )
        )
    ).scalar_one_or_none()
    if membership:
        membership.role = body.role
    else:
        membership = ProjectMember(project_id=project_id, user_id=body.user_id, role=body.role)
        db.add(membership)
    await db.flush()
    conversation = await ensure_project_chat(db, project)
    await db.commit()
    return {"id": body.user_id, "role": body.role, "conversation_id": conversation.id}


@router.delete("/{project_id}/members/{user_id}")
async def remove_project_member(project_id: int, user_id: int, user=Depends(current_user), db: AsyncSession = Depends(get_db)):
    project = await project_access(project_id, user, db, edit=True)
    await _require_manager(project_id, project.workspace_id, user, db)
    if user_id == project.created_by:
        raise HTTPException(422, "Создателя проекта нельзя удалить из его чата")
    membership = (
        await db.execute(
            select(ProjectMember).where(
                ProjectMember.project_id == project_id,
                ProjectMember.user_id == user_id,
            )
        )
    ).scalar_one_or_none()
    if not membership:
        raise HTTPException(404, "Участник проекта не найден")

    await db.delete(membership)
    await db.flush()
    conversation = await ensure_project_chat(db, project)
    chat_membership = (
        await db.execute(
            select(ConversationMember).where(
                ConversationMember.conversation_id == conversation.id,
                ConversationMember.user_id == user_id,
            )
        )
    ).scalar_one_or_none()
    if chat_membership:
        await db.delete(chat_membership)
    await db.commit()
    await connections.revoke(conversation.id, user_id)
    return {"removed": True, "user_id": user_id, "conversation_id": conversation.id}
