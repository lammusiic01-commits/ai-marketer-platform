import asyncio, time, aiohttp
from urllib.parse import urlparse
async def ping(url: str) -> dict:
    parsed=urlparse(url)
    if parsed.scheme not in ("http","https") or not parsed.hostname: raise ValueError("Укажите URL с http:// или https://")
    started=time.perf_counter()
    try:
        async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=15)) as session:
            async with session.get(url,allow_redirects=True) as response:
                await response.read()
                return {"url":str(response.url),"status":response.status,"response_ms":round((time.perf_counter()-started)*1000),"online":response.status<500}
    except (aiohttp.ClientError,asyncio.TimeoutError) as exc:
        return {"url":url,"status":0,"response_ms":round((time.perf_counter()-started)*1000),"online":False,"error":str(exc)}