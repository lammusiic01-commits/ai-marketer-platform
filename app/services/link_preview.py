from __future__ import annotations

import asyncio
import ipaddress
import socket
from html.parser import HTMLParser
from urllib.parse import urljoin, urlparse

import aiohttp

MAX_HTML_BYTES = 512 * 1024
MAX_REDIRECTS = 3


class _MetadataParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.values: dict[str, str] = {}
        self._in_title = False
        self._title: list[str] = []

    def handle_starttag(self, tag: str, attrs):
        values = {key.lower(): (value or "") for key, value in attrs}
        if tag.lower() == "title":
            self._in_title = True
        if tag.lower() == "meta":
            key = (values.get("property") or values.get("name") or "").lower().strip()
            content = values.get("content", "").strip()
            if key and content:
                self.values.setdefault(key, content)

    def handle_endtag(self, tag: str):
        if tag.lower() == "title":
            self._in_title = False

    def handle_data(self, data: str):
        if self._in_title and data.strip():
            self._title.append(data.strip())

    @property
    def title(self) -> str:
        return " ".join(self._title).strip()


async def _resolve_public(host: str, port: int) -> tuple[str, int]:
    try:
        literal = ipaddress.ip_address(host)
        candidates = [(literal, socket.AF_INET6 if literal.version == 6 else socket.AF_INET)]
    except ValueError:
        loop = asyncio.get_running_loop()
        try:
            records = await loop.getaddrinfo(host, port, type=socket.SOCK_STREAM)
        except OSError as error:
            raise ValueError("Не удалось разрешить адрес ссылки") from error
        candidates = []
        for family, _, _, _, sockaddr in records:
            try:
                candidates.append((ipaddress.ip_address(sockaddr[0]), family))
            except ValueError:
                continue

    for address, family in candidates:
        if address.is_global and not address.is_multicast:
            return str(address), family
    raise ValueError("Ссылки на локальные и приватные адреса запрещены")


class _PinnedResolver(aiohttp.abc.AbstractResolver):
    def __init__(self, address: str, family: int):
        self.address = address
        self.family = family

    async def resolve(self, host: str, port: int = 0, family: int = socket.AF_INET):
        return [{"hostname": host, "host": self.address, "port": port, "family": self.family, "proto": 0, "flags": 0}]

    async def close(self):
        return None


def _validate_url(url: str) -> tuple[str, int]:
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError("Нужна публичная ссылка http:// или https://")
    try:
        port = parsed.port or (443 if parsed.scheme == "https" else 80)
    except ValueError as error:
        raise ValueError("Некорректный порт ссылки") from error
    if port not in {80, 443}:
        raise ValueError("Для preview разрешены только стандартные HTTP/HTTPS порты")
    return parsed.hostname, port


async def fetch_open_graph(url: str) -> dict[str, str | None]:
    current = url
    timeout = aiohttp.ClientTimeout(total=7, connect=3, sock_read=4)
    headers = {"User-Agent": "AI-Marketer-Platform-LinkPreview/1.0", "Accept": "text/html,application/xhtml+xml"}

    for redirect_count in range(MAX_REDIRECTS + 1):
        host, port = _validate_url(current)
        address, family = await _resolve_public(host, port)
        resolver = _PinnedResolver(address, family)
        connector = aiohttp.TCPConnector(resolver=resolver, use_dns_cache=False, limit=1)
        try:
            async with aiohttp.ClientSession(timeout=timeout, headers=headers, connector=connector) as session:
                async with session.get(current, allow_redirects=False) as response:
                    if response.status in {301, 302, 303, 307, 308}:
                        location = response.headers.get("Location")
                        if not location or redirect_count >= MAX_REDIRECTS:
                            break
                        current = urljoin(current, location)
                        continue
                    if response.status != 200 or "text/html" not in response.headers.get("Content-Type", "").lower():
                        return {"url": current, "title": host, "description": None, "image": None, "site_name": host}
                    raw = await response.content.read(MAX_HTML_BYTES + 1)
                    if len(raw) > MAX_HTML_BYTES:
                        raw = raw[:MAX_HTML_BYTES]
                    encoding = response.charset or "utf-8"
                    html = raw.decode(encoding, errors="replace")
                    final_url = str(response.url)
        except (aiohttp.ClientError, asyncio.TimeoutError, OSError):
            return {"url": current, "title": host, "description": None, "image": None, "site_name": host}

        parser = _MetadataParser()
        parser.feed(html)
        values = parser.values
        title = values.get("og:title") or values.get("twitter:title") or parser.title or host
        description = values.get("og:description") or values.get("description") or values.get("twitter:description")
        image = values.get("og:image") or values.get("twitter:image")
        site_name = values.get("og:site_name") or urlparse(final_url).hostname or host
        image_url = urljoin(final_url, image) if image else None
        if image_url and urlparse(image_url).scheme not in {"http", "https"}:
            image_url = None
        return {
            "url": final_url,
            "title": title[:180],
            "description": description[:320] if description else None,
            "image": image_url,
            "site_name": site_name[:120],
        }

    raise ValueError("Слишком много перенаправлений")
