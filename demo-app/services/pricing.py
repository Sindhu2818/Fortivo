from decimal import Decimal, ROUND_HALF_UP

from config import Config

CENT = Decimal("0.01")
SYMBOLS = {"INR": "₹", "USD": "$", "EUR": "€", "GBP": "£"}


def to_money(value):
    if value is None:
        return Decimal("0.00")
    return Decimal(str(value)).quantize(CENT, rounding=ROUND_HALF_UP)


def line_total(unit_price, quantity, discount_percent=0):
    gross = to_money(unit_price) * Decimal(str(quantity))
    if discount_percent:
        gross = gross * (Decimal("1") - Decimal(str(discount_percent)) / Decimal("100"))
    return to_money(gross)


def subtotal(lines):
    total = Decimal("0.00")
    for line in lines:
        total += line_total(line.get("unit_price"), line.get("quantity", 1), line.get("discount_percent", 0))
    return to_money(total)


def tax_for(amount, rate=None):
    rate = Decimal(str(rate if rate is not None else Config.TAX_RATE))
    return to_money(to_money(amount) * rate)


def totals_for(lines, rate=None):
    net = subtotal(lines)
    tax = tax_for(net, rate)
    return {"subtotal": net, "tax": tax, "total": to_money(net + tax)}


def late_fee(balance, days_overdue, percent_per_month=Decimal("1.5")):
    if days_overdue <= 0:
        return Decimal("0.00")
    months = Decimal(str(days_overdue)) / Decimal("30")
    return to_money(to_money(balance) * (Decimal(str(percent_per_month)) / Decimal("100")) * months)


def format_money(amount, currency=None):
    currency = currency or Config.CURRENCY
    return "%s%s" % (SYMBOLS.get(currency, currency + " "), to_money(amount))


def split_evenly(amount, parts):
    if parts <= 0:
        return []
    each = to_money(to_money(amount) / Decimal(str(parts)))
    shares = [each] * parts
    shares[-1] = to_money(to_money(amount) - each * (parts - 1))
    return shares
