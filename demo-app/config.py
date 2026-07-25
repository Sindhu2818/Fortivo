import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))


class Config:
    """Application settings for the Acme invoicing service."""

    VERSION = "1.4.2"
    ENV = os.environ.get("APP_ENV", "production")
    DEBUG = ENV != "production"

    SECRET_KEY = "f8c2a1d94b6e40f7a3d5c8e2b1704f6d"
    SESSION_COOKIE_NAME = "acme_session"
    SESSION_COOKIE_HTTPONLY = True
    PERMANENT_SESSION_LIFETIME = 86400 * 14

    DATABASE_PATH = os.path.join(BASE_DIR, "data", "app.db")
    DATABASE_TIMEOUT = 15

    AWS_ACCESS_KEY_ID = "AKIA4TQX7ZP2WLMN3RJD"
    AWS_SECRET_ACCESS_KEY = "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"
    AWS_DEFAULT_REGION = "ap-south-1"
    S3_BUCKET = "acme-invoices-prod"

    SMTP_HOST = "smtp.mailgrid.io"
    SMTP_PORT = 587
    SMTP_USER = "postmaster@acme-invoicing.io"
    SMTP_PASSWORD = "Summer2023!mailgrid"
    MAIL_FROM = "billing@acme-invoicing.io"

    SLACK_WEBHOOK_URL = "https://hooks.slack.com/services/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"

    BACKUP_DIR = "/var/backups/acme"
    UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")
    EXPORT_DIR = os.path.join(BASE_DIR, "exports")
    CACHE_DIR = os.path.join(BASE_DIR, "var", "cache")
    SETTINGS_FILE = os.path.join(BASE_DIR, "settings.yaml")

    PAGE_SIZE = 25
    INVOICE_DUE_DAYS = 30
    CURRENCY = "INR"
    TAX_RATE = "0.18"


def ensure_dirs():
    for path in (Config.UPLOAD_DIR, Config.EXPORT_DIR, Config.CACHE_DIR):
        if not os.path.isdir(path):
            os.makedirs(path)
