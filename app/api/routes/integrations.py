from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models import Integration
from app.security import encrypt
from app.api.deps import current_user, project_access

router=APIRouter(tags=["integrations"])
class IntegrationBody(BaseModel): credentials:dict={}; meta:dict={}
@router.get("/projects/{project_id}/integrations")
async def list_integrations(project_id:int,user=Depends(current_user),db:AsyncSession=Depends(get_db)):
    await project_access(project_id,user,db)
    rows=(await db.execute(select(Integration).where(Integration.project_id==project_id))).scalars().all()
    return [{"id":r.id,"type":r.type,"meta":r.meta,"active":r.active,"created_at":r.created_at.isoformat()} for r in rows]
@router.post("/projects/{project_id}/integrations/{kind}")
async def connect(project_id:int,kind:str,body:IntegrationBody,user=Depends(current_user),db:AsyncSession=Depends(get_db)):
    await project_access(project_id,user,db,True)
    if kind not in {"direct","metrika","business","hosting","loyalty"}: raise HTTPException(422,"Неизвестная интеграция")
    row=Integration(project_id=project_id,type=kind,encrypted_credentials=encrypt(str(body.credentials)),meta=body.meta,active=True); db.add(row); await db.commit(); await db.refresh(row)
    return {"id":row.id,"type":row.type,"meta":row.meta,"active":row.active}
@router.delete("/integrations/{integration_id}")
async def disconnect(integration_id:int,user=Depends(current_user),db:AsyncSession=Depends(get_db)):
    row=await db.get(Integration,integration_id)
    if not row: raise HTTPException(404,"Интеграция не найдена")
    await project_access(row.project_id,user,db,True); await db.delete(row); await db.commit(); return {"disconnected":True}

@router.get("/services/projects/{project_id}")
async def list_services(project_id:int,user=Depends(current_user),db:AsyncSession=Depends(get_db)):
    return await list_integrations(project_id,user,db)

@router.post("/services/projects/{project_id}/{kind}")
async def connect_service(project_id:int,kind:str,body:IntegrationBody,user=Depends(current_user),db:AsyncSession=Depends(get_db)):
    return await connect(project_id,kind,body,user,db)

@router.delete("/services/integrations/{integration_id}")
async def disconnect_service(integration_id:int,user=Depends(current_user),db:AsyncSession=Depends(get_db)):
    return await disconnect(integration_id,user,db)
