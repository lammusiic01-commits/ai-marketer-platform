import asyncio, re, aiohttp
from html.parser import HTMLParser
from urllib.parse import urlparse

class PageParser(HTMLParser):
    def __init__(self):
        super().__init__(); self.title=""; self.h1=[]; self.description=""; self.viewport=False; self.og_title=False; self.words=0; self._title=False; self._h1=False; self._text=[]
    def handle_starttag(self, tag, attrs):
        a=dict(attrs)
        if tag=="title": self._title=True
        if tag=="h1": self._h1=True
        if tag=="meta" and a.get("name","" ).lower()=="description": self.description=a.get("content","")
        if tag=="meta" and a.get("name","").lower()=="viewport": self.viewport=True
        if tag=="meta" and a.get("property","").lower()=="og:title": self.og_title=True
    def handle_endtag(self, tag):
        if tag=="title": self._title=False
        if tag=="h1": self._h1=False
    def handle_data(self, data):
        text=data.strip()
        if text:
            if self._title: self.title+=text
            if self._h1: self.h1.append(text)
            self._text.append(text)

def validate_url(url: str):
    parsed=urlparse(url)
    if parsed.scheme not in ("http","https") or not parsed.hostname: raise ValueError("Укажите полный URL, начинающийся с http:// или https://")
    return url

async def analyze(url: str) -> dict:
    validate_url(url)
    timeout=aiohttp.ClientTimeout(total=20, connect=8)
    headers={"User-Agent":"AIMarketerAudit/1.0 (+https://localhost)"}
    async with aiohttp.ClientSession(timeout=timeout, headers=headers) as session:
        async with session.get(url, allow_redirects=True, max_redirects=5) as response:
            body=await response.text(errors="replace"); status=response.status; final_url=str(response.url)
        parser=PageParser(); parser.feed(body)
        words=len(re.findall(r"[\wа-яё-]+", " ".join(parser._text), re.I))
        issues=[]; score=100
        def issue(severity,title,recommendation,penalty):
            nonlocal score
            issues.append({"severity":severity,"title":title,"recommendation":recommendation}); score-=penalty
        if status>=400: issue("critical",f"Страница вернула HTTP {status}","Проверьте доступность URL и ответ сервера",25)
        if not parser.title: issue("high","Не найден title","Добавьте уникальный title длиной 30–60 символов",15)
        elif len(parser.title)>65 or len(parser.title)<25: issue("medium","Длина title вне рекомендуемого диапазона","Сократите или уточните title до 30–60 символов",6)
        if not parser.description: issue("high","Не найден meta description","Добавьте краткое описание страницы до 160 символов",12)
        if not parser.h1: issue("high","Не найден H1","Добавьте один описательный заголовок H1",12)
        elif len(parser.h1)>1: issue("medium",f"На странице {len(parser.h1)} заголовка H1","Оставьте один главный H1",6)
        if not parser.viewport: issue("medium","Нет viewport meta","Добавьте адаптивный meta viewport",5)
        if not parser.og_title: issue("low","Не задан Open Graph title","Добавьте og:title для корректных превью ссылок",3)
        if words<250: issue("medium","Мало индексируемого текста","Раскройте тему полезным текстом и внутренними ссылками",8)
        robots_url=f"{urlparse(final_url).scheme}://{urlparse(final_url).netloc}/robots.txt"
        sitemap_url=f"{urlparse(final_url).scheme}://{urlparse(final_url).netloc}/sitemap.xml"
        async def head_exists(target):
            try:
                async with session.head(target,allow_redirects=True) as r: return r.status<400
            except Exception: return False
        robots,sitemap=await asyncio.gather(head_exists(robots_url),head_exists(sitemap_url))
        if not robots: issue("low","robots.txt не обнаружен","Проверьте robots.txt в корне сайта",3)
        if not sitemap: issue("low","sitemap.xml не обнаружен","Опубликуйте XML-карту сайта",3)
        return {"url":final_url,"http_status":status,"score":max(0,min(100,score)),"title":parser.title,"description":parser.description,"h1":parser.h1,"word_count":words,"robots":robots,"sitemap":sitemap,"issues":issues}