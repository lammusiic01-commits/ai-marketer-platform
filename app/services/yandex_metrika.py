import aiohttp
class YandexMetrikaClient:
    base="https://api-metrika.yandex.net/stat/v1/data"
    def __init__(self,encrypted_token,counter_id): self.token=encrypted_token; self.counter_id=counter_id
    async def fetch(self,metrics,dimensions,date1,date2):
        params={"ids":self.counter_id,"metrics":",".join(metrics),"dimensions":",".join(dimensions),"date1":date1,"date2":date2}
        async with aiohttp.ClientSession() as session:
            async with session.get(self.base,params=params,headers={"Authorization":f"OAuth {self.token}"}) as r: r.raise_for_status(); return await r.json()
    async def validate(self): return await self.fetch(["ym:s:visits"],["ym:s:date"],"7daysAgo","today")