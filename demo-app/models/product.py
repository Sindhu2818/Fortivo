from decimal import Decimal

from models.base import Record

UNITS = ("each", "hour", "day", "licence", "gb")


class Product(Record):
    fields = (
        "id",
        "sku",
        "name",
        "description",
        "unit",
        "unit_price",
        "stock_on_hand",
        "reorder_level",
        "is_active",
        "updated_at",
    )

    @property
    def needs_reorder(self):
        return (self.stock_on_hand or 0) <= (self.reorder_level or 0)

    @property
    def is_service(self):
        return self.unit in ("hour", "day", "licence")

    def price_for(self, quantity):
        return Decimal(str(self.unit_price or 0)) * Decimal(str(quantity))

    def label(self):
        return "%s (%s)" % (self.name, self.sku)


def group_by_unit(products):
    grouped = {}
    for product in products:
        grouped.setdefault(product.unit or "each", []).append(product)
    return grouped


def low_stock(products):
    return sorted(
        [p for p in products if p.needs_reorder and p.is_active],
        key=lambda p: p.stock_on_hand or 0,
    )
