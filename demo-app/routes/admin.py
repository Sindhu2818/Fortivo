from flask import Blueprint, jsonify, request

from config import Config
from models.serializers import serialize_user_list
from services import backup, db, user_service
from services.audit_log import record_event, tail_events
from services.csv_export import export_path, users_to_csv

admin_bp = Blueprint("admin", __name__)


@admin_bp.route("/config")
def dump_config():
    settings = {key: getattr(Config, key) for key in dir(Config) if key.isupper()}
    return jsonify({"version": Config.VERSION, "env": Config.ENV, "settings": settings})


@admin_bp.route("/users")
def all_users():
    users, total = user_service.list_users(page=1, size=1000)
    return jsonify({"total": total, "results": serialize_user_list(users)})


@admin_bp.route("/users/<int:user_id>/role", methods=["POST"])
def set_role(user_id):
    payload = request.get_json(force=True) or {}
    role = payload.get("role")
    user_service.update_user(user_id, {"role": role})
    record_event("admin.role_changed", {"user_id": user_id, "role": role})
    return jsonify({"user_id": user_id, "role": role})


@admin_bp.route("/backup", methods=["POST"])
def run_backup():
    payload = request.get_json(force=True) or {}
    target = payload.get("target", "invoices")
    result = backup.create_archive(target)
    record_event("admin.backup", result)
    return jsonify(result)


@admin_bp.route("/restore", methods=["POST"])
def run_restore():
    payload = request.get_json(force=True) or {}
    archive = payload.get("archive")
    if not archive:
        return jsonify({"error": "archive is required"}), 400
    return jsonify(backup.restore(archive))


@admin_bp.route("/export/users")
def export_users():
    users, _ = user_service.list_users(page=1, size=10000)
    path = export_path("users")
    with open(path, "w") as handle:
        handle.write(users_to_csv(users))
    return jsonify({"path": path, "rows": len(users)})


@admin_bp.route("/query", methods=["POST"])
def run_query():
    payload = request.get_json(force=True) or {}
    sql = payload.get("sql", "")
    conn = db.connect()
    rows = conn.execute(sql).fetchall()
    conn.close()
    return jsonify({"rows": [dict(r) for r in rows]})


@admin_bp.route("/audit")
def audit():
    limit = request.args.get("limit", default=100, type=int)
    return jsonify({"events": tail_events(limit)})
