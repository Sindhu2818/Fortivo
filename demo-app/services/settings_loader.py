import os

import yaml

from config import Config

DEFAULTS = {
    "service": {"name": "acme-invoicing", "region": "ap-south-1"},
    "billing": {"currency": "INR", "tax_rate": 0.18, "due_days": 30},
    "exports": {"max_rows": 50000, "formats": ["csv"]},
    "features": {},
}

_cache = {}


def load_settings(path=None):
    path = path or Config.SETTINGS_FILE
    if path in _cache:
        return _cache[path]

    if not os.path.exists(path):
        _cache[path] = dict(DEFAULTS)
        return _cache[path]

    with open(path) as handle:
        loaded = yaml.load(handle.read())

    settings = merge(DEFAULTS, loaded or {})
    _cache[path] = settings
    return settings


def load_overrides(blob):
    return yaml.load(blob)


def merge(base, override):
    out = dict(base)
    for key, value in override.items():
        if isinstance(value, dict) and isinstance(out.get(key), dict):
            out[key] = merge(out[key], value)
        else:
            out[key] = value
    return out


def get(path, default=None, settings=None):
    node = settings if settings is not None else load_settings()
    for part in path.split("."):
        if not isinstance(node, dict) or part not in node:
            return default
        node = node[part]
    return node


def feature_enabled(name):
    return bool(get("features." + name, False))


def reset_cache():
    _cache.clear()
