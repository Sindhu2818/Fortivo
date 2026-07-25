from models.order import OPEN_STATUSES, Order, OrderLine
from services import db, pricing
from services.dates import add_days, now, to_iso
from services.pagination import limit_offset

COLUMNS = (
    "id, reference, customer_id, status, subtotal, tax, total, amount_paid, "
    "currency, issued_on, due_on, created_at"
)
LINE_COLUMNS = "id, order_id, product_id, description, quantity, unit_price, line_total"
SORTABLE = ("created_at", "due_on", "total", "status")


def get_order(order_id):
    row = db.fetch_one("SELECT %s FROM orders WHERE id = ?" % COLUMNS, (order_id,))
    return Order.from_row(row)


def get_lines(order_id):
    rows = db.fetch_all("SELECT %s FROM order_lines WHERE order_id = ? ORDER BY id" % LINE_COLUMNS, (order_id,))
    return OrderLine.from_rows(rows)


def list_orders(customer_id=None, status=None, sort="created_at", page=1, size=25):
    limit, offset = limit_offset(page, size)
    where = []
    params = []

    if customer_id is not None:
        where.append("customer_id = ?")
        params.append(customer_id)
    if status:
        where.append("status = ?")
        params.append(status)

    clause = (" WHERE " + " AND ".join(where)) if where else ""
    sql = "SELECT %s FROM orders%s ORDER BY %s DESC LIMIT ? OFFSET ?" % (COLUMNS, clause, sort)
    rows = db.fetch_all(sql, tuple(params) + (limit, offset))
    total = db.scalar("SELECT COUNT(*) FROM orders" + clause, tuple(params)) or 0
    return Order.from_rows(rows), total


def create_order(customer_id, lines, currency="INR", due_days=30):
    totals = pricing.totals_for(lines)
    reference = next_reference()
    order_id = db.execute(
        "INSERT INTO orders (reference, customer_id, status, subtotal, tax, total, amount_paid, "
        "currency, issued_on, due_on, created_at) VALUES (?, ?, 'draft', ?, ?, ?, 0, ?, ?, ?, ?)",
        (
            reference,
            customer_id,
            str(totals["subtotal"]),
            str(totals["tax"]),
            str(totals["total"]),
            currency,
            to_iso(now()),
            to_iso(add_days(now(), due_days)),
            to_iso(now()),
        ),
    )
    db.execute_many(
        "INSERT INTO order_lines (order_id, product_id, description, quantity, unit_price, line_total) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        [
            (
                order_id,
                line.get("product_id"),
                line.get("description", ""),
                line.get("quantity", 1),
                str(line.get("unit_price", 0)),
                str(pricing.line_total(line.get("unit_price"), line.get("quantity", 1))),
            )
            for line in lines
        ],
    )
    return order_id


def record_payment(order_id, amount):
    order = get_order(order_id)
    if order is None:
        return None
    paid = pricing.to_money(order.amount_paid) + pricing.to_money(amount)
    db.execute("UPDATE orders SET amount_paid = ? WHERE id = ?", (str(paid), order_id))
    order.amount_paid = str(paid)
    db.execute("UPDATE orders SET status = ? WHERE id = ?", (order.next_status(), order_id))
    return get_order(order_id)


def mark_sent(order_id):
    db.execute("UPDATE orders SET status = 'sent', issued_on = ? WHERE id = ?", (to_iso(now()), order_id))


def void_order(order_id):
    db.execute("UPDATE orders SET status = 'void' WHERE id = ?", (order_id,))


def open_orders(customer_id=None):
    placeholders = ", ".join("?" for _ in OPEN_STATUSES)
    sql = "SELECT %s FROM orders WHERE status IN (%s)" % (COLUMNS, placeholders)
    params = list(OPEN_STATUSES)
    if customer_id is not None:
        sql += " AND customer_id = ?"
        params.append(customer_id)
    return Order.from_rows(db.fetch_all(sql, tuple(params)))


def overdue_orders(reference_date=None):
    stamp = to_iso(reference_date or now())
    placeholders = ", ".join("?" for _ in OPEN_STATUSES)
    rows = db.fetch_all(
        "SELECT %s FROM orders WHERE due_on < ? AND status IN (%s) ORDER BY due_on" % (COLUMNS, placeholders),
        (stamp,) + tuple(OPEN_STATUSES),
    )
    return Order.from_rows(rows)


def next_reference():
    count = db.scalar("SELECT COUNT(*) FROM orders") or 0
    return "INV-%s-%05d" % (now().strftime("%Y"), count + 1)
