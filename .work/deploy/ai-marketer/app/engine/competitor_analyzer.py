import asyncio
from app.engine.seo_analyzer import analyze

async def analyze_urls(urls: list[str], limit: int = 1000) -> dict:
    values=list(dict.fromkeys(u.strip() for u in urls if u.strip()))[:max(1,min(limit,1000))]
    semaphore=asyncio.Semaphore(50)
    async def one(url):
        async with semaphore:
            try:
                result=await analyze(url)
                return {"url":url,"seo_score":result["score"],"title":result["title"],"word_count":result["word_count"],"http_status":result["http_status"],"issues":len(result["issues"])}
            except Exception as exc: return {"url":url,"error":str(exc)}
    rows=await asyncio.gather(*(one(url) for url in values))
    ok=[r for r in rows if "error" not in r]
    return {"total":len(rows),"analyzed":len(ok),"competitors":rows,"summary":f"Проверено {len(ok)} из {len(rows)} доменов; медианный on-page score — {sorted([r['seo_score'] for r in ok])[len(ok)//2] if ok else 0}."}