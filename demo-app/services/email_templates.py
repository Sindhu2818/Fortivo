from jinja2 import Template

from config import Config
from services.dates import display
from services.pricing import format_money

WELCOME = """
<p>Hi {{ name }},</p>
<p>Your Acme Invoicing account is ready. You are signed up as a <b>{{ role }}</b>.</p>
<p><a href="{{ login_url }}">Sign in</a></p>
"""

INVOICE = """
<p>Hi {{ name }},</p>
<p>Invoice <b>{{ reference }}</b> for {{ amount }} is due on {{ due_on }}.</p>
{{ note }}
<p><a href="{{ pay_url }}">Pay now</a></p>
<p>— {{ company }}</p>
"""

REMINDER = """
<p>Hi {{ name }},</p>
<p>Invoice {{ reference }} ({{ amount }}) is {{ days }} days overdue.</p>
<p>A late fee of {{ late_fee }} applies from today.</p>
"""

RESET = """
<p>Hi {{ name }},</p>
<p>Use this link within one hour to reset your password:</p>
<p><a href="{{ reset_url }}">{{ reset_url }}</a></p>
"""

COMPANY = "Acme Invoicing"
BASE_URL = "https://app.acme-invoicing.io"


def render(template_body, **context):
    return Template(template_body).render(**context)


def welcome_email(user):
    return {
        "to": user.email,
        "from": Config.MAIL_FROM,
        "subject": "Welcome to %s" % COMPANY,
        "html": render(WELCOME, name=user.display_name, role=user.role, login_url=BASE_URL + "/login"),
    }


def invoice_email(user, order, note=""):
    return {
        "to": user.email,
        "from": Config.MAIL_FROM,
        "subject": "Invoice %s from %s" % (order.reference, COMPANY),
        "html": render(
            INVOICE,
            name=user.display_name,
            reference=order.reference,
            amount=format_money(order.total, order.currency),
            due_on=display(order.due_on),
            note=note,
            pay_url="%s/pay/%s" % (BASE_URL, order.reference),
            company=COMPANY,
        ),
    }


def reminder_email(user, order, days_overdue, late_fee_amount):
    return {
        "to": user.email,
        "from": Config.MAIL_FROM,
        "subject": "Invoice %s is overdue" % order.reference,
        "html": render(
            REMINDER,
            name=user.display_name,
            reference=order.reference,
            amount=format_money(order.balance, order.currency),
            days=days_overdue,
            late_fee=format_money(late_fee_amount, order.currency),
        ),
    }


def reset_email(user, token):
    return {
        "to": user.email,
        "from": Config.MAIL_FROM,
        "subject": "Reset your password",
        "html": render(RESET, name=user.display_name, reset_url="%s/reset?token=%s" % (BASE_URL, token)),
    }


def plain_text(html):
    text = html
    for tag in ("<p>", "</p>", "<b>", "</b>"):
        text = text.replace(tag, "")
    return " ".join(text.split())
