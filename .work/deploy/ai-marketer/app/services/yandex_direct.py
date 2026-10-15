import aiohttp
class YandexDirectClient:
    base="https://api.direct.yandex.com/json/v5/"
    def __init__(self,encrypted_token): self.token=encrypted_token
    async def request(self,service,method,params):
        headers={"Authorization":f"Bearer {self.token}","Accept-Language":"ru","Content-Type":"application/json"}
        async with aiohttp.ClientSession() as session:
            async with session.post(self.base+service,json={"method":method,"params":params},headers=headers) as r: r.raise_for_status(); return await r.json()
    async def validate_token(self): return await self.request("campaigns","get",{"SelectionCriteria":{},"FieldNames":["Id"]})
    async def campaigns(self): return await self.request("campaigns","get",{"SelectionCriteria":{},"FieldNames":["Id","Name","State"]})
    async def create_campaign(self,data): return await self.request("campaigns","add",data)
    async def update_bid(self,kw_id,bid): return await self.request("bids","set",{"Bids":[{"KeywordId":kw_id,"SearchBid":bid}]})
    async def stats(self,d1,d2): return {"date_from":d1,"date_to":d2,"note":"Передайте кампании для выгрузки статистики."}