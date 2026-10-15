from app.ai.client import OpenRouterClient
async def write_copy(brief: str) -> str:
    return await OpenRouterClient().ask("Ты русскоязычный маркетинговый редактор. Создай конкретный вариант текста без неподтверждённых фактов.",brief)