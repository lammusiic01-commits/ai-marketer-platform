from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models import User, Workspace, Membership, Invitation
from app.security import hash_password, verify_password, create_jwt
from app.api.deps import current_user

router=APIRouter(prefix="/auth",tags=["auth"])
class RegisterBody(BaseModel): email:EmailStr; password:str; name:str
class LoginBody(BaseModel): email:EmailStr; password:str
class ProfileBody(BaseModel): name:str
class AcceptInviteBody(BaseModel): token:str

def user_data(u): return {"id":u.id,"email":u.email,"name":u.name,"avatar_url":u.avatar_url,"email_verified":u.email_verified}
@router.post("/register")
async def register(body:RegisterBody,db:AsyncSession=Depends(get_db)):
    if len(body.password)<8: raise HTTPException(422,"Пароль должен содержать не менее 8 символов")
    if (await db.execute(select(User).where(User.email==body.email.lower()))).scalar_one_or_none(): raise HTTPException(409,"Этот email уже зарегистрирован")
    user=User(email=body.email.lower(),name=body.name.strip()[:120],hashed_password=hash_password(body.password))
    db.add(user); await db.flush()
    workspace=Workspace(name="Моя команда",owner_id=user.id); db.add(workspace); await db.flush()
    db.add(Membership(workspace_id=workspace.id,user_id=user.id,role="owner")); await db.commit(); await db.refresh(user); await db.refresh(workspace)
    return {"token":create_jwt(user.id,workspace.id),"user":user_data(user),"workspace":{"id":workspace.id,"name":workspace.name}}
@router.post("/login")
async def login(body:LoginBody,db:AsyncSession=Depends(get_db)):
    user=(await db.execute(select(User).where(User.email==body.email.lower()))).scalar_one_or_none()
    if not user or not verify_password(body.password,user.hashed_password): raise HTTPException(401,"Неверный email или пароль")
    ws=(await db.execute(select(Workspace).join(Membership,Membership.workspace_id==Workspace.id).where(Membership.user_id==user.id))).scalars().first()
    if not ws: raise HTTPException(403,"Для аккаунта не найдено рабочее пространство")
    return {"token":create_jwt(user.id,ws.id),"user":user_data(user),"workspace":{"id":ws.id,"name":ws.name}}
@router.get("/me")
async def me(user=Depends(current_user)): return user_data(user)
@router.patch("/me")
async def update_me(body:ProfileBody,user=Depends(current_user),db:AsyncSession=Depends(get_db)):
    user.name=body.name.strip()[:120]; await db.commit(); return user_data(user)
@router.post("/accept-invite")
async def accept_invite(body:AcceptInviteBody,user=Depends(current_user),db:AsyncSession=Depends(get_db)):
    invitation=(await db.execute(select(Invitation).where(Invitation.token==body.token,Invitation.accepted==False))).scalar_one_or_none()
    if not invitation: raise HTTPException(404,"Приглашение не найдено или уже использовано")
    if invitation.email.lower()!=user.email.lower(): raise HTTPException(403,"Войдите под email, на который отправлено приглашение")
    from datetime import datetime, timezone
    expiry=invitation.expires_at
    if expiry.tzinfo is None: expiry=expiry.replace(tzinfo=timezone.utc)
    if expiry < datetime.now(timezone.utc): raise HTTPException(410,"Срок приглашения истёк")
    existing=(await db.execute(select(Membership).where(Membership.workspace_id==invitation.workspace_id,Membership.user_id==user.id))).scalar_one_or_none()
    if not existing: db.add(Membership(workspace_id=invitation.workspace_id,user_id=user.id,role=invitation.role))
    invitation.accepted=True; await db.commit(); workspace=await db.get(Workspace,invitation.workspace_id)
    return {"token":create_jwt(user.id,workspace.id),"user":user_data(user),"workspace":{"id":workspace.id,"name":workspace.name}}