import secrets
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, HttpUrl
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models import Project, Campaign, Integration, Hypothesis, Report, Notification
from app.api.deps import current_user, project_access
from app.engine.roi_calculator import calculate_roi
from app.engine.seo_analyzer import analyze as seo_analyze
from app.engine.bot_detector import analyze as bot_analyze
from app.engine.geo_analyzer import analyze as geo_analyze
from app.engine.competitor_analyzer import analyze_urls
from app.engine.campaign_generator import generate as campaign_generate
from app.engine.copywriter import write_copy
from app.engine.hypothesis_engine import generate as generate_hypotheses
from app.ai.advisor import advise

router=APIRouter(tags=["marketing"])
class SeoBody(BaseModel): url:str
class RoiBody(BaseModel): budget:float=0; clicks:int=0; conversions:int=0; average_check:float=0; ltv:float=0; margin_pct:float=0
class CampaignBody(BaseModel): product:str; audience:str; budget:float=0
class BriefBody(BaseModel): brief:str
class CompetitorBody(BaseModel): urls:list[str]
class BotBody(BaseModel): metrika_data:dict={}
class LoyaltyBody(BaseModel): message:str; segment:str

def require_project_id(project_id,user,db,edit=False): return project_access(project_id,user,db,edit)
@router.post("/projects/{project_id}/seo/analyze")
async def seo(project_id:int,body:SeoBody,user=Depends(current_user),db:AsyncSession=Depends(get_db)):
    p=await project_access(project_id,user,db,True)
    try: result=await seo_analyze(body.url)
    except Exception as exc: raise HTTPException(400,str(exc))
    return result
@router.post("/projects/{project_id}/seo/autofix")
async def seo_autofix(project_id:int,user=Depends(current_user),db:AsyncSession=Depends(get_db)):
    await project_access(project_id,user,db,True)
    return {"applied":False,"message":"Автоправки безопасно формируются как рекомендации. Для изменения сайта нужен доступ к его CMS или репозиторию."}
@router.get("/projects/{project_id}/seo/history")
async def seo_history(project_id:int,user=Depends(current_user),db:AsyncSession=Depends(get_db)):
    await project_access(project_id,user,db); return []
@router.post("/projects/{project_id}/roi/calculate")
async def roi(project_id:int,body:RoiBody,user=Depends(current_user),db:AsyncSession=Depends(get_db)):
    await project_access(project_id,user,db); return calculate_roi(**body.model_dump())
@router.get("/projects/{project_id}/roi/history")
async def roi_history(project_id:int,user=Depends(current_user),db:AsyncSession=Depends(get_db)):
    await project_access(project_id,user,db); return []
@router.post("/projects/{project_id}/bot-shield/analyze")
async def bot_shield(project_id:int,body:BotBody,user=Depends(current_user),db:AsyncSession=Depends(get_db)):
    await project_access(project_id,user,db); return bot_analyze(body.metrika_data)
@router.get("/projects/{project_id}/bot-shield/latest")
async def bot_latest(project_id:int,user=Depends(current_user),db:AsyncSession=Depends(get_db)):
    await project_access(project_id,user,db); return {"available":False,"message":"Запустите анализ на данных Яндекс.Метрики."}
@router.post("/projects/{project_id}/geo/analyze")
async def geo(project_id:int,user=Depends(current_user),db:AsyncSession=Depends(get_db)):
    p=await project_access(project_id,user,db); return geo_analyze({"name":p.name,"website_url":p.website_url})
@router.get("/projects/{project_id}/geo/latest")
async def geo_latest(project_id:int,user=Depends(current_user),db:AsyncSession=Depends(get_db)):
    await project_access(project_id,user,db); return geo_analyze({})
@router.post("/projects/{project_id}/competitors/analyze")
async def competitors(project_id:int,body:CompetitorBody,user=Depends(current_user),db:AsyncSession=Depends(get_db)):
    await project_access(project_id,user,db,True)
    if len(body.urls)>1000: raise HTTPException(422,"Максимум 1000 URL за запуск")
    return await analyze_urls(body.urls)
@router.get("/projects/{project_id}/competitors/latest")
async def competitors_latest(project_id:int,user=Depends(current_user),db=Depends(get_db)):
    await project_access(project_id,user,db); return {"competitors":[],"total":0}
@router.post("/projects/{project_id}/campaigns/generate")
async def campaign(project_id:int,body:CampaignBody,user=Depends(current_user),db:AsyncSession=Depends(get_db)):
    p=await project_access(project_id,user,db,True); data=await campaign_generate(body.product,body.audience,body.budget)
    row=Campaign(project_id=project_id,created_by=user.id,title=f"Кампания · {body.product[:80]}",product=body.product,audience=body.audience,data=data,status="draft"); db.add(row); await db.commit()
    data.update({"id":row.id,"title":row.title,"status":row.status}); return data
@router.get("/projects/{project_id}/campaigns")
async def campaigns(project_id:int,user=Depends(current_user),db:AsyncSession=Depends(get_db)):
    await project_access(project_id,user,db); rows=(await db.execute(select(Campaign).where(Campaign.project_id==project_id).order_by(Campaign.created_at.desc()))).scalars().all()
    return [{"id":c.id,"title":c.title,"product":c.product,"audience":c.audience,"status":c.status,"data":c.data,"created_at":c.created_at.isoformat()} for c in rows]
@router.post("/campaigns/{campaign_id}/push-to-direct")
async def push_direct(campaign_id:int,user=Depends(current_user),db:AsyncSession=Depends(get_db)):
    row=await db.get(Campaign,campaign_id)
    if not row: raise HTTPException(404,"Кампания не найдена")
    await project_access(row.project_id,user,db,True)
    return {"sent":False,"message":"Сначала подключите Яндекс.Директ в разделе интеграций; отправка требует подтверждения в кабинете Директа."}
@router.post("/projects/{project_id}/copywriting/generate")
async def copywriting(project_id:int,body:BriefBody,user=Depends(current_user),db:AsyncSession=Depends(get_db)):
    await project_access(project_id,user,db,True)
    if len(body.brief.strip())<10: raise HTTPException(422,"Добавьте контекст в бриф (минимум 10 символов)")
    return {"text":await write_copy(body.brief)}
@router.post("/projects/{project_id}/hypotheses/generate")
async def hypotheses(project_id:int,user=Depends(current_user),db:AsyncSession=Depends(get_db)):
    p=await project_access(project_id,user,db,True); items=generate_hypotheses(p.name)
    for item in items: db.add(Hypothesis(project_id=project_id,created_by=user.id,code=item["code"],title=item["title"],description=item["description"],impact_pct=item["impact_pct"],priority=item["priority"],data=item))
    await db.commit(); return items
@router.get("/projects/{project_id}/hypotheses")
async def list_hypotheses(project_id:int,user=Depends(current_user),db:AsyncSession=Depends(get_db)):
    await project_access(project_id,user,db); rows=(await db.execute(select(Hypothesis).where(Hypothesis.project_id==project_id))).scalars().all()
    return [{"id":h.id,"code":h.code,"title":h.title,"description":h.description,"impact_pct":h.impact_pct,"priority":h.priority,"status":h.status} for h in rows]
@router.get("/projects/{project_id}/reports")
async def reports(project_id:int,user=Depends(current_user),db:AsyncSession=Depends(get_db)):
    await project_access(project_id,user,db); rows=(await db.execute(select(Report).where(Report.project_id==project_id))).scalars().all()
    return [{"id":r.id,"type":r.type,"data":r.data,"ai_summary":r.ai_summary,"created_at":r.created_at.isoformat()} for r in rows]
@router.post("/projects/{project_id}/reports/generate")
async def report(project_id:int,user=Depends(current_user),db:AsyncSession=Depends(get_db)):
    p=await project_access(project_id,user,db,True); summary=await advise(f"Подготовь недельный отчёт по проекту {p.name}. URL: {p.website_url or 'не указан'}.")
    row=Report(project_id=project_id,type="weekly",data={"project":p.name},ai_summary=summary); db.add(row); await db.commit(); return {"id":row.id,"type":row.type,"ai_summary":summary}
@router.post("/projects/{project_id}/loyalty/push")
async def loyalty(project_id:int,body:LoyaltyBody,user=Depends(current_user),db:AsyncSession=Depends(get_db)):
    await project_access(project_id,user,db,True); return {"sent":False,"message":"Подключите webhook лояльности в интеграциях, чтобы отправить сообщение."}
@router.get("/notifications")
async def notifications(user=Depends(current_user),db:AsyncSession=Depends(get_db)):
    rows=(await db.execute(select(Notification).where(Notification.user_id==user.id).order_by(Notification.created_at.desc()))).scalars().all()
    return [{"id":n.id,"title":n.title,"body":n.body,"read":n.read,"created_at":n.created_at.isoformat()} for n in rows]

@router.patch("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id:int,user=Depends(current_user),db:AsyncSession=Depends(get_db)):
    row=await db.get(Notification,notification_id)
    if not row or row.user_id!=user.id: raise HTTPException(404,"Уведомление не найдено")
    row.read=True; await db.commit(); return {"id":row.id,"read":True}

@router.post("/notifications/mark-all-read")
async def mark_all_notifications_read(user=Depends(current_user),db:AsyncSession=Depends(get_db)):
    rows=(await db.execute(select(Notification).where(Notification.user_id==user.id,Notification.read.is_(False)))).scalars().all()
    for row in rows: row.read=True
    await db.commit(); return {"updated":len(rows)}
