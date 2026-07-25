from models.user import User, normalize_email
from services import db
from services.dates import now, to_iso
from services.pagination import limit_offset

COLUMNS = "id, email, full_name, role, team_id, is_active, created_at, last_login_at"
EDITABLE = ("email", "full_name", "role", "team_id", "is_active")


def get_user(user_id):
    row = db.fetch_one("SELECT %s FROM users WHERE id = ?" % COLUMNS, (user_id,))
    return User.from_row(row)


def get_by_email(email):
    row = db.fetch_one("SELECT %s FROM users WHERE email = ?" % COLUMNS, (normalize_email(email),))
    return User.from_row(row)


def list_users(team_id=None, page=1, size=25, include_inactive=False):
    limit, offset = limit_offset(page, size)
    where = []
    params = []

    if team_id is not None:
        where.append("team_id = ?")
        params.append(team_id)
    if not include_inactive:
        where.append("is_active = 1")

    clause = (" WHERE " + " AND ".join(where)) if where else ""
    rows = db.fetch_all(
        "SELECT %s FROM users%s ORDER BY created_at DESC LIMIT ? OFFSET ?" % (COLUMNS, clause),
        tuple(params) + (limit, offset),
    )
    total = db.scalar("SELECT COUNT(*) FROM users" + clause, tuple(params)) or 0
    return User.from_rows(rows), total


def create_user(email, full_name, role, team_id, password_hash):
    return db.execute(
        "INSERT INTO users (email, full_name, role, team_id, password_hash, is_active, created_at) "
        "VALUES (?, ?, ?, ?, ?, 1, ?)",
        (normalize_email(email), full_name, role, team_id, password_hash, to_iso(now())),
    )


def update_user(user_id, changes):
    sql, params = db.build_update("users", changes, EDITABLE)
    if sql:
        db.execute(sql, params + (user_id,))
    return get_user(user_id)


def deactivate_user(user_id):
    db.execute("UPDATE users SET is_active = 0 WHERE id = ?", (user_id,))


def touch_login(user_id):
    db.execute("UPDATE users SET last_login_at = ? WHERE id = ?", (to_iso(now()), user_id))


def team_members(team_id):
    rows = db.fetch_all(
        "SELECT %s FROM users WHERE team_id = ? AND is_active = 1 ORDER BY full_name" % COLUMNS,
        (team_id,),
    )
    return User.from_rows(rows)


def count_by_role():
    rows = db.fetch_all("SELECT role, COUNT(*) AS n FROM users WHERE is_active = 1 GROUP BY role")
    return {row["role"]: row["n"] for row in rows}
