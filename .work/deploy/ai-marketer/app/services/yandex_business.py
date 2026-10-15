class YandexBusinessClient:
    def __init__(self,token="",company_id=""): self.token=token; self.company_id=company_id
    async def validate(self): return bool(self.token and self.company_id)
    async def company_info(self): return {"company_id":self.company_id,"connected":await self.validate()}
    async def reviews(self): return []
    async def photos_count(self): return 0