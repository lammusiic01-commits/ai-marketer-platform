from app.engine.site_monitor import ping
class HostingMonitor:
    async def ping(self,url): return await ping(url)
    async def speed_test(self,url): return await ping(url)
    async def check_ssl(self,url): return {"url":url,"https":url.startswith("https://"),"note":"Для полного срока сертификата настройте отдельный мониторинг сертификата."}