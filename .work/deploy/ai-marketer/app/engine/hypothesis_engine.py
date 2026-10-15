def generate(project_name: str, bot_pct: float = 0, conversions: int = 0) -> list[dict]:
    items=[]
    if bot_pct>15: items.append({"code":"BOT-01","title":"Исключить площадки с аномальным трафиком","description":"Сверить источники коротких сессий и добавить подтверждённые площадки в исключения.","impact_pct":12,"priority":"high","duration":"3 дня"})
    if conversions>10: items.append({"code":"BID-01","title":"Проверить переход на автостратегию","description":"Сравнить целевой CPA на достаточном объёме конверсий и ограничить недельный бюджет.","impact_pct":9,"priority":"normal","duration":"2 недели"})
    items.append({"code":"RET-01","title":"Запустить ретаргетинг на посетителей каталога","description":f"Создать сегмент вовлечённых посетителей проекта «{project_name}» и протестировать отдельное сообщение.","impact_pct":8,"priority":"normal","duration":"10 дней"})
    return items