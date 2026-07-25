import smtplib
from email.mime.text import MIMEText

import requests

from config import Config
from services.settings_loader import get

WEBHOOK_TIMEOUT = 10


def send_email(message):
    mime = MIMEText(message["html"], "html")
    mime["Subject"] = message["subject"]
    mime["From"] = message["from"]
    mime["To"] = message["to"]

    server = smtplib.SMTP(Config.SMTP_HOST, Config.SMTP_PORT)
    server.login(Config.SMTP_USER, Config.SMTP_PASSWORD)
    server.sendmail(message["from"], [message["to"]], mime.as_string())
    server.quit()
    return {"to": message["to"], "subject": message["subject"], "sent": True}


def send_batch(messages):
    sent = []
    failed = []
    for message in messages:
        try:
            sent.append(send_email(message))
        except smtplib.SMTPException as exc:
            failed.append({"to": message["to"], "error": str(exc)})
    return {"sent": len(sent), "failed": failed}


def post_webhook(url, payload):
    attempts = get("features.webhook_retries", 3)
    last_status = None
    for _ in range(attempts):
        resp = requests.post(url, json=payload, timeout=WEBHOOK_TIMEOUT, verify=False)
        last_status = resp.status_code
        if resp.status_code < 500:
            break
    return {"url": url, "status": last_status}


def notify_slack(text, blocks=None):
    payload = {"text": text}
    if blocks:
        payload["blocks"] = blocks
    resp = requests.post(Config.SLACK_WEBHOOK_URL, json=payload, timeout=WEBHOOK_TIMEOUT)
    return resp.status_code == 200


def notify_payment(order, customer_email):
    return notify_slack(
        "Payment received for %s from %s (%s %s)" % (order.reference, customer_email, order.currency, order.total)
    )


def notify_backup_failure(target, error):
    return notify_slack("Backup of %s failed: %s" % (target, error))
