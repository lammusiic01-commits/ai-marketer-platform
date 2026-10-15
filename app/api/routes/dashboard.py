from datetime import date, datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models import Project, Membership, Task
from app.api.deps import current_user, project_access

router=APIRouter(tags=["dashboard"])
@router.get("/workspaces/{workspace_id}/dashboard")
async def workspace_dashboard(workspace_id:int,user=Depends(current_user),db:AsyncSession=Depends(get_db)):
    membership=(await db.execute(select(Membership.id).where(Membership.workspace_id==workspace_id,Membership.user_id==user.id))).scalar_one_or_none()
    if membership is None: raise HTTPException(status_code=403,detail="Нет доступа к workspace")
    projects=(await db.execute(select(Project).where(Project.workspace_id==workspace_id,Project.archived==False))).scalars().all()
    ids=[p.id for p in projects]
    tasks=(await db.execute(select(Task).where(Task.project_id.in_(ids)))).scalars().all() if ids else []
    open_tasks=[t for t in tasks if t.status!="done"]
    today=date.today().isoformat()
    due_today=sorted((t for t in open_tasks if t.due_date and t.due_date[:10]==today),key=lambda t:(t.due_date or "",t.id))
    cutoff=datetime.now(timezone.utc)-timedelta(days=7)
    completed_week=0
    for task in tasks:
        updated=task.updated_at
        if task.status=="done" and updated:
            if updated.tzinfo is None: updated=updated.replace(tzinfo=timezone.utc)
            completed_week+=updated>=cutoff
    return {"active_projects":len(projects),"open_tasks":len(open_tasks),"urgent_tasks":sum(t.priority=="urgent" for t in open_tasks),"completed_week":completed_week,"projects":[{"id":p.id,"name":p.name,"website_url":p.website_url,"industry":p.industry} for p in projects],"tasks":[{"id":t.id,"title":t.title,"project_id":t.project_id,"priority":t.priority,"status":t.status,"due_date":t.due_date} for t in due_today[:8]]}
@router.get("/projects/{project_id}/dashboard")
async def project_dashboard(project_id:int,user=Depends(current_user),db:AsyncSession=Depends(get_db)):
    await project_access(project_id,user,db)
    tasks=(await db.execute(select(Task).where(Task.project_id==project_id))).scalars().all()
    open_tasks=[t for t in tasks if t.status!="done"]
    return {"traffic":None,"spend":None,"conversions":None,"bot_pct":None,"metrics_note":"Внешние источники пока не синхронизированы; вместо фиктивных значений показатели скрыты.","tasks":[{"id":t.id,"title":t.title,"status":t.status,"priority":t.priority,"due_date":t.due_date} for t in open_tasks],"activity":[]}
