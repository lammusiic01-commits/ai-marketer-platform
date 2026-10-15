from app.ai.client import OpenRouterClient

async def advise(context: str) -> str:
    return await OpenRouterClient().ask("Ты старший performance-маркетолог. Дай краткий, конкретный совет на русском языке.", context)