import json, re
from app.ai.client import OpenRouterClient
async def generate(product: str, audience: str, budget: float) -> dict:
    prompt=f"Сформируй план кампании для продукта: {product}; аудитория: {audience}; бюджет: {budget} руб. Верни JSON с keys headlines (массив), texts (массив), keywords (массив), negatives (массив), structure (массив)."
    raw=await OpenRouterClient().ask("Ты performance-маркетолог для российского бизнеса. Отвечай на русском; не обещай результаты.",prompt)
    if raw=="AI не настроен": return {"error":raw,"headlines":[],"texts":[],"keywords":[],"negatives":[],"structure":["Поиск","Ретаргетинг"]}
    match=re.search(r"\{[\s\S]*\}",raw)
    try: return json.loads(match.group(0)) if match else {"text":raw}
    except json.JSONDecodeError: return {"text":raw}