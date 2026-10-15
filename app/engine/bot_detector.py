def analyze(metrika: dict) -> dict:
    patterns=[]
    robot_pct=float(metrika.get("robot_pct",0) or 0)
    if robot_pct > 0: patterns.append({"name":"Роботы по данным Метрики","severity":"high" if robot_pct > 15 else "medium","share":round(robot_pct,1),"action":"Проверьте исключение известных роботов и сегменты источников"})
    short=float(metrika.get("short_bounce_pct",0) or 0)
    if float(metrika.get("avg_session_seconds",999)) < 5 and short > 90: patterns.append({"name":"Короткие сессии и высокий отказ","severity":"high","share":round(short,1),"action":"Сверьте IP, User-Agent и рекламные площадки"})
    night=float(metrika.get("night_traffic_pct",0) or 0)
    if night > 25: patterns.append({"name":"Ночной всплеск трафика","severity":"medium","share":round(night,1),"action":"Проверьте почасовой отчёт и географию визитов"})
    city=float(metrika.get("top_city_share_pct",0) or 0)
    if city > 35: patterns.append({"name":"Концентрация в одном городе","severity":"medium","share":round(city,1),"action":"Сопоставьте географию с целевым регионом"})
    return {"robot_pct":round(robot_pct,1),"estimated_loss":round(float(metrika.get("ad_spend",0))*robot_pct/100,2),"patterns":patterns,"actions":[p["action"] for p in patterns]}