import secrets
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models import Workspace, Membership, User, Project, ProjectMember, Task, Invitation
from app.api.deps import current_user
from app.security import create_jwt
from app.email_service import send_invitation
from app.config import APP_URL

router=APIRouter(prefix="/workspaces",tags=["workspaces"])
class WorkspaceBody(BaseModel): name:str
class InviteBody(BaseModel): email:EmailStr; role:str="specialist"
@router.get("")
async def list_workspaces(user=Depends(current_user),db:AsyncSession=Depends(get_db)):
    rows=(await db.execute(select(Workspace,Membership.role).join(Membership,Membership.workspace_id==Workspace.id).where(Membership.user_id==user.id))).all()
    return [{"id":w.id,"name":w.name,"role":role,"plan":w.plan} for w,role in rows]
@router.post("")
async def create_workspace(body:WorkspaceBody,user=Depends(current_user),db:AsyncSession=Depends(get_db)):
    name=body.name.strip()
    if not name or len(name)>160: raise HTTPException(422,"Название должно содержать от 1 до 160 символов")
    ws=Workspace(name=name,owner_id=user.id); db.add(ws); await db.flush(); db.add(Membership(workspace_id=ws.id,user_id=user.id,role="owner")); await db.commit(); return {"id":ws.id,"name":ws.name,"role":"owner"}

@router.patch("/{workspace_id}")
async def rename_workspace(workspace_id:int,body:WorkspaceBody,user=Depends(current_user),db:AsyncSession=Depends(get_db)):
    membership=await _membership(workspace_id,user.id,db)
    if membership.role not in ("owner","admin"): raise HTTPException(403,"Только владелец или администратор может переименовать workspace")
    name=body.name.strip()
    if not name or len(name)>160: raise HTTPException(422,"Название должно содержать от 1 до 160 символов")
    workspace=await db.get(Workspace,workspace_id)
    workspace.name=name; await db.commit()
    return {"id":workspace.id,"name":workspace.name,"role":membership.role}

@router.post("/{workspace_id}/switch")
async def switch_workspace(workspace_id:int,user=Depends(current_user),db:AsyncSession=Depends(get_db)):
    m=(await db.execute(select(Membership).where(Membership.workspace_id==workspace_id,Membership.user_id==user.id))).scalar_one_or_none()
    if not m: raise HTTPException(403,"Нет доступа к workspace")
    ws=await db.get(Workspace,workspace_id); return {"token":create_jwt(user.id,workspace_id),"workspace":{"id":ws.id,"name":ws.name}}
@router.get("/{workspace_id}/members")
async def list_members(workspace_id:int,user=Depends(current_user),db:AsyncSession=Depends(get_db)):
    await _membership(workspace_id,user.id,db)
    rows=(await db.execute(select(User,Membership).join(Membership,Membership.user_id==User.id).where(Membership.workspace_id==workspace_id))).all()
    member_ids=[user_row.id for user_row,_membership_row in rows]
    counts={}
    if member_ids:
        count_rows=await db.execute(select(ProjectMember.user_id,func.count(ProjectMember.id)).join(Project,Project.id==ProjectMember.project_id).where(Project.workspace_id==workspace_id,ProjectMember.user_id.in_(member_ids)).group_by(ProjectMember.user_id))
        counts=dict(count_rows.all())
    return [{"id":u.id,"name":u.name,"email":u.email,"role":m.role,"created_at":m.created_at.isoformat(),"projects_count":counts.get(u.id,0)} for u,m in rows]
async def _membership(wid,uid,db):
    m=(await db.execute(select(Membership).where(Membership.workspace_id==wid,Membership.user_id==uid))).scalar_one_or_none()
    if not m: raise HTTPException(403,"Нет доступа к workspace")
    return m
@router.post("/{workspace_id}/invite")
async def invite(workspace_id:int,body:InviteBody,user=Depends(current_user),db:AsyncSession=Depends(get_db)):
    m=await _membership(workspace_id,user.id,db)
    if m.role not in ("owner","admin","manager"): raise HTTPException(403,"Недостаточно прав для приглашения")
    if body.role not in ("admin","manager","specialist","viewer"): raise HTTPException(422,"Недопустимая роль")
    token=secrets.token_urlsafe(32); row=Invitation(workspace_id=workspace_id,email=body.email.lower(),token=token,role=body.role,invited_by=user.id,expires_at=datetime.now(timezone.utc)+timedelta(days=7)); db.add(row); await db.commit()
    ws=await db.get(Workspace,workspace_id); link=await send_invitation(body.email,token,ws.name)
    return {"id":row.id,"email":row.email,"role":row.role,"token":token,"url":link,"accepted":False}

@router.get("/{workspace_id}/invitations")
async def list_invitations(workspace_id:int,user=Depends(current_user),db:AsyncSession=Depends(get_db)):
    membership=await _membership(workspace_id,user.id,db)
    if membership.role not in ("owner","admin","manager"): raise HTTPException(403,"Недостаточно прав")
    rows=(await db.execute(select(Invitation).where(Invitation.workspace_id==workspace_id,Invitation.accepted.is_(False),Invitation.expires_at>datetime.now(timezone.utc)).order_by(Invitation.created_at.desc()))).scalars().all()
    return [{"id":row.id,"email":row.email,"role":row.role,"token":row.token,"url":f"{APP_URL}/invite/{row.token}","expires_at":row.expires_at.isoformat()} for row in rows]

@router.delete("/{workspace_id}/invitations/{invitation_id}")
async def revoke_invitation(workspace_id:int,invitation_id:int,user=Depends(current_user),db:AsyncSession=Depends(get_db)):
    membership=await _membership(workspace_id,user.id,db)
    if membership.role not in ("owner","admin","manager"): raise HTTPException(403,"Недостаточно прав")
    invitation=await db.get(Invitation,invitation_id)
    if not invitation or invitation.workspace_id!=workspace_id: raise HTTPException(404,"Приглашение не найдено")
    await db.delete(invitation); await db.commit(); return {"revoked":True}

@router.patch("/{workspace_id}/members/{user_id}")
async def update_member(workspace_id:int,user_id:int,body:InviteBody,user=Depends(current_user),db:AsyncSession=Depends(get_db)):
    m=await _membership(workspace_id,user.id,db)
    if m.role not in ("owner","admin"): raise HTTPException(403,"Недостаточно прав")
    if body.role not in ("admin","manager","specialist","viewer"): raise HTTPException(422,"Недопустимая роль")
    target=(await db.execute(select(Membership).where(Membership.workspace_id==workspace_id,Membership.user_id==user_id))).scalar_one_or_none()
    if not target: raise HTTPException(404,"Участник не найден")
    if target.role=="owner": raise HTTPException(422,"Роль владельца нельзя изменить")
    target.role=body.role; await db.commit(); return {"id":user_id,"role":target.role}
@router.delete("/{workspace_id}/members/{user_id}")
async def remove_member(workspace_id:int,user_id:int,user=Depends(current_user),db:AsyncSession=Depends(get_db)):
    m=await _membership(workspace_id,user.id,db)
    if m.role not in ("owner","admin") and user.id!=user_id: raise HTTPException(403,"Недостаточно прав")
    target=(await db.execute(select(Membership).where(Membership.workspace_id==workspace_id,Membership.user_id==user_id))).scalar_one_or_none()
    if target and target.role=="owner": raise HTTPException(422,"Владельца нельзя удалить из workspace")
    if target: await db.delete(target); await db.commit()
    return {"removed":True}
