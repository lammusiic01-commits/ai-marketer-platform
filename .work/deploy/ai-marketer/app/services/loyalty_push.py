import aiohttp
async def push(webhook_url: str, message: str, segment: str, project_id: int) -> dict:
    async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=20)) as session:
        async with session.post(webhook_url,json={"message":message,"segment":segment,"project_id":project_id}) as response:
            body=await response.text()
            response.raise_for_status()
            return {"status":response.status,"response":body[:500]}