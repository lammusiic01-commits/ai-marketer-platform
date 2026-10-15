from fastapi import APIRouter
from app.api.routes.auth import router as auth_router
from app.api.routes.workspaces import router as workspace_router
from app.api.routes.projects import router as project_router
from app.api.routes.tasks import router as task_router
from app.api.routes.marketing import router as marketing_router
from app.api.routes.integrations import router as integration_router
from app.api.routes.dashboard import router as dashboard_router
from app.api.routes.chats import router as chat_router, message_router
from app.api.routes.project_members import router as project_member_router

router=APIRouter(prefix="/api")
router.include_router(auth_router)
router.include_router(workspace_router)
router.include_router(project_router)
router.include_router(project_member_router)
router.include_router(task_router)
router.include_router(marketing_router)
router.include_router(integration_router)
router.include_router(chat_router)
router.include_router(message_router)
router.include_router(dashboard_router)
