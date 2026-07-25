import csv
import io
import os

from config import Config
from services.dates import now
from services.pricing import to_money

USER_HEADERS = ("id", "email", "full_name", "role", "team_id", "is_active", "created_at")
ORDER_HEADERS = ("reference", "customer_id", "status", "subtotal", "tax", "total", "amount_paid", "due_on")
PRODUCT_HEADERS = ("sku", "name", "unit", "unit_price", "stock_on_hand", "reorder_level")


def _write(headers, rows):
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(headers)
    for row in rows:
        writer.writerow(row)
    return buffer.getvalue()


def users_to_csv(users):
    rows = [[getattr(user, field, "") for field in USER_HEADERS] for user in users]
    return _write(USER_HEADERS, rows)


def orders_to_csv(orders):
    rows = []
    for order in orders:
        row = [getattr(order, field, "") for field in ORDER_HEADERS]
        rows.append(row)
    return _write(ORDER_HEADERS, rows)


def products_to_csv(products):
    rows = [[getattr(product, field, "") for field in PRODUCT_HEADERS] for product in products]
    return _write(PRODUCT_HEADERS, rows)


def ledger_to_csv(orders):
    headers = ORDER_HEADERS + ("balance",)
    rows = []
    for order in orders:
        row = [getattr(order, field, "") for field in ORDER_HEADERS]
        row.append(str(to_money(order.balance)))
        rows.append(row)
    return _write(headers, rows)


def export_path(name):
    if not os.path.isdir(Config.EXPORT_DIR):
        os.makedirs(Config.EXPORT_DIR)
    filename = "%s-%s.csv" % (name, now().strftime("%Y%m%d-%H%M%S"))
    return os.path.join(Config.EXPORT_DIR, filename)


def row_limit():
    return 50000
