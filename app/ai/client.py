import aiohttp
from app.config import APP_URL, OPENROUTER_API_KEY, OPENROUTER_MODEL

MODEL = OPENROUTER_MODEL

class OpenRouterClient:
    async def ask(self, system: str, user: str, temperature: float = 0.4, max_tokens: int = 2000) -> str:
        if not OPENROUTER_API_KEY:
            return "AI не настроен"
        payload = {"model": MODEL, "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}], "temperature": temperature, "max_tokens": max_tokens}
        headers = {"Authorization": f"Bearer {OPENROUTER_API_KEY}", "HTTP-Referer": APP_URL, "X-Title": "AI Marketer"}
        timeout = aiohttp.ClientTimeout(total=45)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.post("https://openrouter.ai/api/v1/chat/completions", json=payload, headers=headers) as response:
                response.raise_for_status()
                data = await response.json()
                return data["choices"][0]["message"]["content"]
