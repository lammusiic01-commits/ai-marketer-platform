from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models import User, Workspace, Membership, Project, ProjectMember
from app.security import decode_jwt

bearer=HTTPBearer(auto_error=False)
async def current_user(credentials: HTTPAuthorizationCredentials|None=Depends(bearer), db:AsyncSession=Depends(get_db)):
    if not credentials: raise HTTPException(401,"Требуется авторизация")
    try: claims=decode_jwt(credentials.credentials); uid=int(claims["sub"])
    except Exception: raise HTTPException(401,"Сессия недействительна")
    user=await db.get(User,uid)
    if not user: raise HTTPException(401,"Пользователь не найден")
    user.active_workspace_id=int(claims.get("workspace_id",0))
    return user
async def project_access(project_id:int,user:User,db:AsyncSession,edit=False):
    project=await db.get(Project,project_id)
    if not project: raise HTTPException(404,"Проект не найден")
    member=(await db.execute(select(Membership).where(Membership.workspace_id==project.workspace_id,Membership.user_id==user.id))).scalar_one_or_none()
    pm=(await db.execute(select(ProjectMember).where(ProjectMember.project_id==project_id,ProjectMember.user_id==user.id))).scalar_one_or_none()
    if not member and not pm: raise HTTPException(403,"Нет доступа к проекту")
    if edit and ((member and member.role=="viewer") or (pm and pm.role=="observer")): raise HTTPException(403,"Недостаточно прав")
    return project