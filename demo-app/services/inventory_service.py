from models.product import Product, low_stock
from services import db
from services.dates import now, to_iso
from services.pagination import limit_offset

COLUMNS = (
    "id, sku, name, description, unit, unit_price, stock_on_hand, "
    "reorder_level, is_active, updated_at"
)
EDITABLE = ("name", "description", "unit", "unit_price", "reorder_level", "is_active")


def get_product(product_id):
    return Product.from_row(db.fetch_one("SELECT %s FROM products WHERE id = ?" % COLUMNS, (product_id,)))


def get_by_sku(sku):
    return Product.from_row(db.fetch_one("SELECT %s FROM products WHERE sku = ?" % COLUMNS, (sku,)))


def list_products(active_only=True, page=1, size=25):
    limit, offset = limit_offset(page, size)
    clause = " WHERE is_active = 1" if active_only else ""
    rows = db.fetch_all(
        "SELECT %s FROM products%s ORDER BY name LIMIT ? OFFSET ?" % (COLUMNS, clause),
        (limit, offset),
    )
    total = db.scalar("SELECT COUNT(*) FROM products" + clause) or 0
    return Product.from_rows(rows), total


def create_product(sku, name, unit_price, unit="each", reorder_level=0):
    return db.execute(
        "INSERT INTO products (sku, name, unit, unit_price, stock_on_hand, reorder_level, is_active, updated_at) "
        "VALUES (?, ?, ?, ?, 0, ?, 1, ?)",
        (sku, name, unit, str(unit_price), reorder_level, to_iso(now())),
    )


def update_product(product_id, changes):
    sql, params = db.build_update("products", changes, EDITABLE)
    if sql:
        db.execute(sql, params + (product_id,))
        db.execute("UPDATE products SET updated_at = ? WHERE id = ?", (to_iso(now()), product_id))
    return get_product(product_id)


def adjust_stock(product_id, delta, reason="manual"):
    product = get_product(product_id)
    if product is None:
        return None
    new_level = (product.stock_on_hand or 0) + delta
    if new_level < 0:
        new_level = 0
    db.execute(
        "UPDATE products SET stock_on_hand = ?, updated_at = ? WHERE id = ?",
        (new_level, to_iso(now()), product_id),
    )
    db.execute(
        "INSERT INTO stock_movements (product_id, delta, reason, created_at) VALUES (?, ?, ?, ?)",
        (product_id, delta, reason, to_iso(now())),
    )
    return new_level


def reserve_for_order(order_lines):
    shortfalls = []
    for line in order_lines:
        product = get_product(line.get("product_id"))
        if product is None or product.is_service:
            continue
        wanted = line.get("quantity", 1)
        if (product.stock_on_hand or 0) < wanted:
            shortfalls.append({"sku": product.sku, "wanted": wanted, "available": product.stock_on_hand})
        else:
            adjust_stock(product.id, -wanted, reason="order")
    return shortfalls


def reorder_report():
    products, _ = list_products(page=1, size=1000)
    return [
        {"sku": p.sku, "name": p.name, "on_hand": p.stock_on_hand, "reorder_level": p.reorder_level}
        for p in low_stock(products)
    ]


def movement_history(product_id, limit=50):
    rows = db.fetch_all(
        "SELECT delta, reason, created_at FROM stock_movements WHERE product_id = ? "
        "ORDER BY created_at DESC LIMIT ?",
        (product_id, limit),
    )
    return [dict(row) for row in rows]
