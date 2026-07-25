from datetime import date, datetime
from decimal import Decimal


class Record(object):
    """Thin row wrapper. Subclasses declare the columns they care about."""

    fields = ()

    def __init__(self, **kwargs):
        for name in self.fields:
            setattr(self, name, kwargs.get(name))

    @classmethod
    def from_row(cls, row):
        if row is None:
            return None
        keys = row.keys() if hasattr(row, "keys") else []
        return cls(**{name: row[name] for name in cls.fields if name in keys})

    @classmethod
    def from_rows(cls, rows):
        return [cls.from_row(row) for row in rows]

    def to_dict(self):
        out = {}
        for name in self.fields:
            out[name] = _plain(getattr(self, name, None))
        return out

    def merge(self, changes):
        for name, value in changes.items():
            if name in self.fields:
                setattr(self, name, value)
        return self

    def changed_fields(self, other):
        return [name for name in self.fields if getattr(self, name, None) != getattr(other, name, None)]

    def __eq__(self, other):
        return isinstance(other, self.__class__) and self.to_dict() == other.to_dict()

    def __repr__(self):
        return "<%s id=%s>" % (self.__class__.__name__, getattr(self, "id", None))


def _plain(value):
    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%dT%H:%M:%SZ")
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, Decimal):
        return str(value)
    return value
