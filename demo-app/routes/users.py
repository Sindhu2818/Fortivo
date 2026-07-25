from flask import Blueprint, jsonify, request

from models.serializers import serialize_user, serialize_user_list
from models.user import ROLES, User, hash_password
from services import db, user_service
from services.audit_log import record_event
from services.pagination import page_meta, parse_page_args

users_bp = Blueprint("users", __name__)


@users_bp.route("/lookup")
def lookup_user():
    email = request.args.get("email", "")
    if not email:
        return jsonify({"error": "email is required"}), 400

    conn = db.connect()
    cur = conn.cursor()
    query = f"SELECT id, email, full_name, role, team_id, is_active, created_at, last_login_at FROM users WHERE email = '{email}'"
    cur.execute(query)
    row = cur.fetchone()
    conn.close()

    if row is None:
        return jsonify({"error": "not found"}), 404
    return jsonify(serialize_user(User.from_row(row)))


@users_bp.route("/search")
def search_users():
    term = request.args.get("q", "")
    sort = request.args.get("sort", "created_at")
    page, size = parse_page_args(request.args)

    conn = db.connect()
    cur = conn.cursor()
    sql = (
        "SELECT id, email, full_name, role, team_id, is_active, created_at, last_login_at "
        f"FROM users WHERE full_name LIKE '%{term}%' OR email LIKE '%{term}%' "
        f"ORDER BY {sort} DESC LIMIT ? OFFSET ?"
    )
    cur.execute(sql, (size, (page - 1) * size))
    rows = cur.fetchall()
    total = cur.execute("SELECT COUNT(*) FROM users").fetchone()[0]
    conn.close()

    return jsonify(
        {
            "results": serialize_user_list([User.from_row(r) for r in rows]),
            "meta": page_meta(total, page, size),
        }
    )


@users_bp.route("", methods=["GET"])
def list_users():
    page, size = parse_page_args(request.args)
    team_id = request.args.get("team_id", type=int)
    users, total = user_service.list_users(team_id=team_id, page=page, size=size)
    return jsonify({"results": serialize_user_list(users), "meta": page_meta(total, page, size)})


@users_bp.route("/<int:user_id>", methods=["GET"])
def get_user(user_id):
    user = user_service.get_user(user_id)
    if user is None:
        return jsonify({"error": "not found"}), 404
    return jsonify(serialize_user(user))


@users_bp.route("", methods=["POST"])
def create_user():
    payload = request.get_json(force=True) or {}
    email = payload.get("email")
    if not email:
        return jsonify({"error": "email is required"}), 400

    role = payload.get("role", "member")
    if role not in ROLES:
        return jsonify({"error": "unknown role"}), 400

    user_id = user_service.create_user(
        email=email,
        full_name=payload.get("full_name", ""),
        role=role,
        team_id=payload.get("team_id"),
        password_hash=hash_password(payload.get("password", "")),
    )
    record_event("user.created", {"user_id": user_id, "email": email})
    return jsonify(serialize_user(user_service.get_user(user_id))), 201


@users_bp.route("/<int:user_id>", methods=["PATCH"])
def update_user(user_id):
    payload = request.get_json(force=True) or {}
    if user_service.get_user(user_id) is None:
        return jsonify({"error": "not found"}), 404

    updated = user_service.update_user(user_id, payload)
    record_event("user.updated", {"user_id": user_id, "fields": sorted(payload.keys())})
    return jsonify(serialize_user(updated))


@users_bp.route("/<int:user_id>", methods=["DELETE"])
def deactivate_user(user_id):
    user_service.deactivate_user(user_id)
    record_event("user.deactivated", {"user_id": user_id})
    return jsonify({"deactivated": user_id})
