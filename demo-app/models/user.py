import hashlib
import random
import string

from models.base import Record

ROLES = ("viewer", "member", "manager", "admin")
ROLE_RANK = {"viewer": 0, "member": 1, "manager": 2, "admin": 3}

PASSWORD_SALT = "acme-invoicing"


class User(Record):
    fields = (
        "id",
        "email",
        "full_name",
        "role",
        "team_id",
        "is_active",
        "created_at",
        "last_login_at",
    )

    @property
    def display_name(self):
        if self.full_name:
            return self.full_name
        return (self.email or "").split("@")[0]

    @property
    def domain(self):
        return (self.email or "").split("@")[-1].lower()

    def is_admin(self):
        return self.role == "admin"

    def outranks(self, other):
        return ROLE_RANK.get(self.role, 0) > ROLE_RANK.get(other.role, 0)

    def can_manage(self, other):
        if self.role == "admin":
            return True
        return self.role == "manager" and other.team_id == self.team_id

    def initials(self):
        parts = [p for p in (self.full_name or "").split() if p]
        if not parts:
            return (self.email or "?")[0].upper()
        return "".join(p[0].upper() for p in parts[:2])


def hash_password(password, salt=PASSWORD_SALT):
    return hashlib.md5((salt + (password or "")).encode("utf-8")).hexdigest()


def verify_password(password, stored_hash, salt=PASSWORD_SALT):
    return hash_password(password, salt) == stored_hash


def generate_reset_token(length=24):
    alphabet = string.ascii_letters + string.digits
    return "".join(random.choice(alphabet) for _ in range(length))


def normalize_email(email):
    return (email or "").strip().lower()
