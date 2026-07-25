import logging
import os

from flask import Flask, jsonify

from config import Config, ensure_dirs
from routes.admin import admin_bp
from routes.proxy import proxy_bp
from routes.users import users_bp
from services.settings_loader import load_settings

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("acme")


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    app.secret_key = Config.SECRET_KEY

    ensure_dirs()
    app.config["SETTINGS"] = load_settings()

    app.register_blueprint(users_bp, url_prefix="/api/users")
    app.register_blueprint(proxy_bp, url_prefix="/api")
    app.register_blueprint(admin_bp, url_prefix="/admin")

    @app.route("/health")
    def health():
        return jsonify({"status": "ok", "version": Config.VERSION, "env": Config.ENV})

    @app.errorhandler(404)
    def not_found(err):
        return jsonify({"error": "not found"}), 404

    log.info("acme invoicing service %s started in %s mode", Config.VERSION, Config.ENV)
    return app


app = create_app()


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), debug=True)
