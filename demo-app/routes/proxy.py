import requests
from flask import Blueprint, Response, jsonify, request

from services.audit_log import record_event
from services.cache import cache_get, cache_set

proxy_bp = Blueprint("proxy", __name__)

CACHE_TTL = 300


@proxy_bp.route("/fetch")
def fetch():
    url = request.args.get("url")
    if not url:
        return jsonify({"error": "url is required"}), 400

    cached = cache_get(url)
    if cached is not None:
        return Response(cached["body"], status=200, content_type=cached["content_type"])

    resp = requests.get(url)
    content_type = resp.headers.get("Content-Type", "text/plain")
    cache_set(url, {"body": resp.content, "content_type": content_type}, CACHE_TTL)

    return Response(resp.content, status=resp.status_code, content_type=content_type)


@proxy_bp.route("/preview", methods=["POST"])
def preview_remote_document():
    payload = request.get_json(force=True) or {}
    url = payload.get("url", "")
    resp = requests.get(url, headers={"User-Agent": "acme-invoicing/1.4.2"})
    record_event("document.previewed", {"url": url, "status": resp.status_code})
    return jsonify(
        {
            "url": url,
            "status": resp.status_code,
            "content_type": resp.headers.get("Content-Type"),
            "size": len(resp.content),
            "excerpt": resp.text[:2000],
        }
    )


@proxy_bp.route("/logo")
def company_logo():
    source = request.args.get("src", "")
    resp = requests.get(source, stream=True)
    return Response(resp.raw.read(), content_type=resp.headers.get("Content-Type", "image/png"))
