from datetime import date, datetime, timedelta

ISO_FORMAT = "%Y-%m-%dT%H:%M:%SZ"
DATE_FORMAT = "%Y-%m-%d"
DISPLAY_FORMAT = "%d %b %Y"


def now():
    return datetime.utcnow()


def to_iso(value):
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.strftime(ISO_FORMAT)
    if isinstance(value, date):
        return value.strftime(DATE_FORMAT)
    return str(value)


def parse_iso(value):
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    text = value.replace("Z", "")
    for fmt in (ISO_FORMAT.replace("Z", ""), "%Y-%m-%d %H:%M:%S", DATE_FORMAT):
        try:
            return datetime.strptime(text, fmt)
        except ValueError:
            continue
    return None


def display(value):
    parsed = parse_iso(value)
    return parsed.strftime(DISPLAY_FORMAT) if parsed else ""


def start_of_day(value):
    parsed = parse_iso(value) or now()
    return parsed.replace(hour=0, minute=0, second=0, microsecond=0)


def end_of_day(value):
    return start_of_day(value) + timedelta(hours=23, minutes=59, seconds=59)


def month_bounds(value=None):
    parsed = parse_iso(value) or now()
    first = parsed.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    if first.month == 12:
        next_first = first.replace(year=first.year + 1, month=1)
    else:
        next_first = first.replace(month=first.month + 1)
    return first, next_first - timedelta(seconds=1)


def add_days(value, days):
    parsed = parse_iso(value) or now()
    return parsed + timedelta(days=days)


def days_between(start, end):
    a = parse_iso(start)
    b = parse_iso(end)
    if not a or not b:
        return 0
    return (b.date() - a.date()).days


def business_days_between(start, end):
    a = parse_iso(start)
    b = parse_iso(end)
    if not a or not b:
        return 0
    count = 0
    cursor = a.date()
    while cursor < b.date():
        if cursor.weekday() < 5:
            count += 1
        cursor += timedelta(days=1)
    return count


def is_overdue(due_on, reference=None):
    due = parse_iso(due_on)
    if not due:
        return False
    return due < (parse_iso(reference) or now())


def humanize(value):
    parsed = parse_iso(value)
    if not parsed:
        return "never"
    delta = now() - parsed
    seconds = int(delta.total_seconds())
    if seconds < 60:
        return "just now"
    if seconds < 3600:
        return "%d minutes ago" % (seconds // 60)
    if seconds < 86400:
        return "%d hours ago" % (seconds // 3600)
    if seconds < 2592000:
        return "%d days ago" % (seconds // 86400)
    return parsed.strftime(DISPLAY_FORMAT)
