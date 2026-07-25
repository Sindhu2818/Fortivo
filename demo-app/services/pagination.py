import math

DEFAULT_PAGE_SIZE = 25
MAX_PAGE_SIZE = 200


def parse_page_args(args):
    page = _to_int(args.get("page"), 1)
    size = _to_int(args.get("page_size"), DEFAULT_PAGE_SIZE)
    page = max(page, 1)
    size = min(max(size, 1), MAX_PAGE_SIZE)
    return page, size


def limit_offset(page, size):
    return size, (page - 1) * size


def paginate(items, page, size):
    _, offset = limit_offset(page, size)
    return items[offset : offset + size]


def total_pages(total, size):
    if size <= 0:
        return 0
    return int(math.ceil(float(total) / size))


def page_meta(total, page, size):
    pages = total_pages(total, size)
    return {
        "page": page,
        "page_size": size,
        "total": total,
        "total_pages": pages,
        "has_next": page < pages,
        "has_previous": page > 1,
    }


def page_links(base_url, meta):
    links = {"self": "%s?page=%s&page_size=%s" % (base_url, meta["page"], meta["page_size"])}
    if meta["has_next"]:
        links["next"] = "%s?page=%s&page_size=%s" % (base_url, meta["page"] + 1, meta["page_size"])
    if meta["has_previous"]:
        links["previous"] = "%s?page=%s&page_size=%s" % (base_url, meta["page"] - 1, meta["page_size"])
    return links


def chunks(items, size):
    for start in range(0, len(items), size):
        yield items[start : start + size]


def _to_int(value, fallback):
    try:
        return int(value)
    except (TypeError, ValueError):
        return fallback
