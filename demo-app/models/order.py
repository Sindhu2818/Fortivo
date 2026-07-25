from decimal import Decimal

from models.base import Record

STATUSES = ("draft", "sent", "partially_paid", "paid", "overdue", "void")
OPEN_STATUSES = ("sent", "partially_paid", "overdue")


class Order(Record):
    fields = (
        "id",
        "reference",
        "customer_id",
        "status",
        "subtotal",
        "tax",
        "total",
        "amount_paid",
        "currency",
        "issued_on",
        "due_on",
        "created_at",
    )

    @property
    def balance(self):
        return _dec(self.total) - _dec(self.amount_paid)

    @property
    def is_open(self):
        return self.status in OPEN_STATUSES

    @property
    def is_settled(self):
        return self.balance <= Decimal("0")

    def percent_paid(self):
        total = _dec(self.total)
        if total == Decimal("0"):
            return 0
        return int((_dec(self.amount_paid) / total) * 100)

    def next_status(self):
        if self.is_settled:
            return "paid"
        if _dec(self.amount_paid) > Decimal("0"):
            return "partially_paid"
        return self.status


class OrderLine(Record):
    fields = ("id", "order_id", "product_id", "description", "quantity", "unit_price", "line_total")

    def recalculate(self):
        self.line_total = _dec(self.unit_price) * Decimal(str(self.quantity or 0))
        return self.line_total


def _dec(value):
    if value is None:
        return Decimal("0")
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))
