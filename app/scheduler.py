import asyncio
import logging
from datetime import datetime, timedelta, timezone
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy import func, select
from app.database import SessionLocal
from app.models import Project, Workspace, Notification, Report, Task
from app.engine.site_monitor import ping
from app.engine.seo_analyzer import analyze as analyze_seo
from app.ai.advisor import advise
from app.config import OPENROUTER_API_KEY

logger = logging.getLogger("ai_marketer.scheduler")
scheduler = AsyncIOScheduler(timezone="Europe/Moscow")

async def monitor_sites():
    async with SessionLocal() as db:
        projects = (await db.execute(select(Project).where(Project.website_url != "", Project.archived.is_(False)))).scalars().all()
        semaphore = asyncio.Semaphore(8)
        async def check(project):
            async with semaphore:
                try:
                    return project, await ping(project.website_url)
                except Exception as exc:
                    logger.warning("Не удалось проверить сайт проекта %s: %s", project.id, exc)
                    return project, {"online": False, "status": 0, "error": str(exc)}
        results = await asyncio.gather(*(check(project) for project in projects))
        cutoff = datetime.now(timezone.utc) - timedelta(hours=6)
        for project, result in results:
            if result.get("online"):
                logger.info("Сайт проекта %s доступен: HTTP %s, %s мс", project.id, result.get("status"), result.get("response_ms"))
                continue
            existing = (await db.execute(select(Notification.id).where(Notification.project_id==project.id, Notification.title=="Мониторинг: сайт недоступен", Notification.created_at>=cutoff).limit(1))).first()
            if existing:
                continue
            workspace = await db.get(Workspace, project.workspace_id)
            if workspace:
                db.add(Notification(user_id=workspace.owner_id, workspace_id=workspace.id, project_id=project.id, type="alert", title="Мониторинг: сайт недоступен", body=f"{project.name}: {result.get('error') or 'HTTP ' + str(result.get('status', 0))}"))
        await db.commit()

async def run_daily_seo_audits():
    async with SessionLocal() as db:
        projects = (await db.execute(select(Project).where(Project.website_url!="", Project.archived.is_(False)))).scalars().all()
        for project in projects:
            try:
                result = await analyze_seo(project.website_url)
                db.add(Report(project_id=project.id, type="seo_daily", data={"score":result["score"],"url":result["url"],"issues":result["issues"],"http_status":result["http_status"]}, ai_summary=f"Автоматический SEO-аудит: {result['score']}/100, замечаний: {len(result['issues'])}."))
            except Exception as exc:
                logger.warning("Ежедневный SEO-аудит проекта %s завершился ошибкой: %s", project.id, exc)
        await db.commit()

async def run_weekly_reports():
    async with SessionLocal() as db:
        projects = (await db.execute(select(Project).where(Project.archived.is_(False)))).scalars().all()
        for project in projects:
            task_rows = (await db.execute(select(Task.status,func.count(Task.id)).where(Task.project_id==project.id).group_by(Task.status))).all()
            tasks_by_status = {status:count for status,count in task_rows}
            open_tasks = sum(count for status,count in task_rows if status!="done")
            context = f"Проект: {project.name}. Открытых задач: {open_tasks}. Статусы задач: {tasks_by_status}. URL сайта: {project.website_url or 'не указан'}."
            if OPENROUTER_API_KEY:
                try:
                    summary = await advise(f"Подготовь недельный маркетинговый отчёт на русском. Используй только предоставленные данные; не выдумывай метрики.", context)
                except Exception as exc:
                    logger.warning("AI-отчёт проекта %s недоступен: %s", project.id, exc)
                    summary = f"Еженедельная сводка. Открытых задач: {open_tasks}. Статусы: {tasks_by_status}. AI-резюме временно недоступно."
            else:
                summary = f"Еженедельная сводка. Открытых задач: {open_tasks}. Статусы: {tasks_by_status}. Для AI-резюме добавьте OPENROUTER_API_KEY в .env."
            db.add(Report(project_id=project.id,type="weekly",data={"project":project.name,"tasks_by_status":tasks_by_status},ai_summary=summary))
        await db.commit()


def start_scheduler():
    if scheduler.running:
        return
    scheduler.add_job(monitor_sites,"interval",hours=1,id="monitor-sites-hourly",replace_existing=True,max_instances=1,coalesce=True)
    scheduler.add_job(monitor_sites,"date",run_date=datetime.now(timezone.utc)+timedelta(seconds=30),id="monitor-sites-startup",replace_existing=True)
    scheduler.add_job(run_daily_seo_audits,CronTrigger(hour=7,minute=0,timezone="Europe/Moscow"),id="seo-audits-daily",replace_existing=True,max_instances=1,coalesce=True)
    scheduler.add_job(run_weekly_reports,CronTrigger(day_of_week="mon",hour=9,minute=0,timezone="Europe/Moscow"),id="reports-weekly",replace_existing=True,max_instances=1,coalesce=True)
    scheduler.start()
    logger.info("Запущено расписание: мониторинг сайтов ежечасно, SEO ежедневно в 07:00, отчёты по понедельникам в 09:00 (Europe/Moscow).")

def stop_scheduler():
    if scheduler.running:
        scheduler.shutdown(wait=False)
