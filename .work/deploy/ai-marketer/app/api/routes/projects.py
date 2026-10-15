from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models import Project, Membership, ProjectMember, Conversation, ConversationMember, User
from app.api.deps import current_user, project_access
from app.api.routes.chats import ensure_project_chat, connections

router=APIRouter(prefix="/projects",tags=["projects"])
class ProjectBody(BaseModel): name:str; website_url:str=""; industry:str=""; description:str=""; archived:bool=False
class ProjectMemberBody(BaseModel): user_id:int; role:str="executor"
@router.get("")
async def list_projects(user=Depends(current_user),db:AsyncSession=Depends(get_db)):
    rows=(await db.execute(select(Project).join(Membership,Membership.workspace_id==Project.workspace_id).where(Membership.user_id==user.id))).scalars().all()
    counts={}
    if rows:
        result=await db.execute(select(ProjectMember.project_id,func.count(ProjectMember.id)).where(ProjectMember.project_id.in_([p.id for p in rows])).group_by(ProjectMember.project_id))
        counts=dict(result.all())
    return [{**serialize(p),"member_count":counts.get(p.id,0)} for p in rows]
def serialize(p): return {"id":p.id,"workspace_id":p.workspace_id,"name":p.name,"website_url":p.website_url,"industry":p.industry,"description":p.description,"archived":p.archived,"created_at":p.created_at.isoformat()}
@router.post("")
async def create_project(body:ProjectBody,user=Depends(current_user),db:AsyncSession=Depends(get_db)):
    wid=user.active_workspace_id
    membership=(await db.execute(select(Membership).where(Membership.workspace_id==wid,Membership.user_id==user.id))).scalar_one_or_none()
    if not membership or membership.role not in ("owner","admin","manager"): raise HTTPException(403,"Недостаточно прав")
    p=Project(workspace_id=wid,name=body.name.strip(),website_url=body.website_url,industry=body.industry,description=body.description,created_by=user.id,archived=body.archived); db.add(p); await db.flush(); await ensure_project_chat(db,p,{user.id}); await db.commit(); await db.refresh(p); return serialize(p)
@router.get("/{project_id}")
async def get_project(project_id:int,user=Depends(current_user),db:AsyncSession=Depends(get_db)):
    return serialize(await project_access(project_id,user,db))
@router.patch("/{project_id}")
async def update_project(project_id:int,body:ProjectBody,user=Depends(current_user),db:AsyncSession=Depends(get_db)):
    p=await project_access(project_id,user,db,True)
    previous_name=p.name
    for key,value in body.model_dump(exclude_unset=True).items(): setattr(p,key,value)
    if p.name != previous_name: await ensure_project_chat(db,p)
    await db.commit(); return serialize(p)
@router.delete("/{project_id}")
async def delete_project(project_id:int,user=Depends(current_user),db:AsyncSession=Depends(get_db)):
    p=await project_access(project_id,user,db,True); p.archived=True; await db.commit(); return {"archived":True}
