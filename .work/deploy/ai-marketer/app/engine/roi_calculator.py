def calculate_roi(budget: float, clicks: int, conversions: int, average_check: float, ltv: float, margin_pct: float) -> dict:
    revenue = conversions * average_check
    cac = budget / conversions if conversions else 0
    romi = (revenue - budget) / budget * 100 if budget else 0
    return {"cac": round(cac, 2), "romi": round(romi, 1), "ltv_cac": round(ltv / cac, 2) if cac else 0, "profit": round(revenue * margin_pct / 100 - budget, 2), "revenue": round(revenue, 2), "click_to_conversion_pct": round(conversions / clicks * 100, 2) if clicks else 0}