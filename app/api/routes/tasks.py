from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models import Task, Project
from app.api.deps import current_user, project_access

router=APIRouter(tags=["tasks"])
class TaskBody(BaseModel): title:str; description:str=""; status:str="backlog"; priority:str="normal"; assignee_id:int|None=None; due_date:str|None=None; checklist:list=[]; labels:list=[]
class StatusBody(BaseModel): status:str
class AssigneeBody(BaseModel): assignee_id:int|None=None
VALID={"backlog","in_progress","review","done"}
def serialize(t): return {"id":t.id,"project_id":t.project_id,"title":t.title,"description":t.description,"status":t.status,"priority":t.priority,"assignee_id":t.assignee_id,"due_date":t.due_date,"checklist":t.checklist or [],"labels":t.labels or [],"created_at":t.created_at.isoformat()}
@router.get("/projects/{project_id}/tasks")
async def list_tasks(project_id:int,user=Depends(current_user),db:AsyncSession=Depends(get_db)):
    await project_access(project_id,user,db)
    return [serialize(t) for t in (await db.execute(select(Task).where(Task.project_id==project_id).order_by(Task.created_at.desc()))).scalars().all()]
@router.get("/tasks")
async def global_tasks(user=Depends(current_user),db:AsyncSession=Depends(get_db)):
    rows=(await db.execute(select(Task).join(Project,Project.id==Task.project_id).where(Project.workspace_id==user.active_workspace_id))).scalars().all()
    return [serialize(t) for t in rows]
@router.post("/projects/{project_id}/tasks")
async def create_task(project_id:int,body:TaskBody,user=Depends(current_user),db:AsyncSession=Depends(get_db)):
    await project_access(project_id,user,db,True)
    if body.status not in VALID: raise HTTPException(422,"Недопустимый статус задачи")
    t=Task(project_id=project_id,created_by=user.id,**body.model_dump()); db.add(t); await db.commit(); await db.refresh(t); return serialize(t)
@router.patch("/tasks/{task_id}")
async def update_task(task_id:int,body:TaskBody,user=Depends(current_user),db:AsyncSession=Depends(get_db)):
    t=await db.get(Task,task_id)
    if not t: raise HTTPException(404,"Задача не найдена")
    await project_access(t.project_id,user,db,True)
    for k,v in body.model_dump(exclude_unset=True).items(): setattr(t,k,v)
    await db.commit(); return serialize(t)
@router.patch("/tasks/{task_id}/status")
async def set_status(task_id:int,body:StatusBody,user=Depends(current_user),db:AsyncSession=Depends(get_db)):
    if body.status not in VALID: raise HTTPException(422,"Недопустимый статус")
    t=await db.get(Task,task_id)
    if not t: raise HTTPException(404,"Задача не найдена")
    await project_access(t.project_id,user,db,True); t.status=body.status; await db.commit(); return serialize(t)
@router.patch("/tasks/{task_id}/assignee")
async def set_assignee(task_id:int,body:AssigneeBody,user=Depends(current_user),db:AsyncSession=Depends(get_db)):
    t=await db.get(Task,task_id)
    if not t: raise HTTPException(404,"Задача не найдена")
    await project_access(t.project_id,user,db,True); t.assignee_id=body.assignee_id; await db.commit(); return serialize(t)
@router.delete("/tasks/{task_id}")
async def delete_task(task_id:int,user=Depends(current_user),db:AsyncSession=Depends(get_db)):
    t=await db.get(Task,task_id)
    if not t: raise HTTPException(404,"Задача не найдена")
    await project_access(t.project_id,user,db,True); await db.delete(t); await db.commit(); return {"deleted":True}