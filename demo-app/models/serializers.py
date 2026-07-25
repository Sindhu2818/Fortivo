from services.dates import humanize, to_iso


def serialize_user(user):
    if user is None:
        return None
    data = user.to_dict()
    data["display_name"] = user.display_name
    data["initials"] = user.initials()
    data["is_admin"] = user.is_admin()
    data["last_login_label"] = humanize(user.last_login_at)
    if user.team_id is None:
        data.pop("team_id", None)
    return data


def serialize_user_list(users):
    return [serialize_user(u) for u in users]


def serialize_order(order, lines=None):
    if order is None:
        return None
    data = order.to_dict()
    data["balance"] = str(order.balance)
    data["percent_paid"] = order.percent_paid()
    data["is_open"] = order.is_open
    data["due_on"] = to_iso(order.due_on)
    if lines is not None:
        data["lines"] = [serialize_order_line(line) for line in lines]
    return data


def serialize_order_line(line):
    data = line.to_dict()
    data["line_total"] = str(line.recalculate())
    return data


def serialize_product(product):
    data = product.to_dict()
    data["label"] = product.label()
    data["needs_reorder"] = product.needs_reorder
    return data


def serialize_collection(items, serializer, meta=None):
    body = {"results": [serializer(item) for item in items]}
    if meta:
        body["meta"] = meta
    return body
