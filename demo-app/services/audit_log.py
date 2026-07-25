import json
import os

from config import Config
from services.dates import now, to_iso

MAX_DETAIL_CHARS = 2000


def _log_path():
    path = os.path.join(os.path.dirname(Config.CACHE_DIR), "audit.log")
    directory = os.path.dirname(path)
    if not os.path.isdir(directory):
        os.makedirs(directory)
    return path


def record_event(action, details=None, actor=None):
    entry = {
        "at": to_iso(now()),
        "action": action,
        "actor": actor,
        "details": _truncate(details or {}),
    }
    with open(_log_path(), "a") as handle:
        handle.write(json.dumps(entry) + "\n")
    return entry


def tail_events(limit=100):
    path = _log_path()
    if not os.path.exists(path):
        return []
    with open(path) as handle:
        lines = handle.readlines()
    events = []
    for line in lines[-limit:]:
        try:
            events.append(json.loads(line))
        except ValueError:
            continue
    return list(reversed(events))


def events_for(action, limit=100):
    return [e for e in tail_events(limit) if e.get("action") == action]


def summarize(limit=500):
    counts = {}
    for event in tail_events(limit):
        counts[event.get("action", "unknown")] = counts.get(event.get("action", "unknown"), 0) + 1
    return counts


def _truncate(details):
    blob = json.dumps(details, default=str)
    if len(blob) <= MAX_DETAIL_CHARS:
        return details
    return {"truncated": blob[:MAX_DETAIL_CHARS]}
