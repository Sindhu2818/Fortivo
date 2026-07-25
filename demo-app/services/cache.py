import hashlib
import os
import pickle
import time

from config import Config


def _path_for(key):
    digest = hashlib.md5(key.encode("utf-8")).hexdigest()
    return os.path.join(Config.CACHE_DIR, digest + ".cache")


def cache_set(key, value, ttl=300):
    if not os.path.isdir(Config.CACHE_DIR):
        os.makedirs(Config.CACHE_DIR)
    payload = {"expires_at": time.time() + ttl, "value": value}
    with open(_path_for(key), "wb") as handle:
        handle.write(pickle.dumps(payload))


def cache_get(key):
    path = _path_for(key)
    if not os.path.exists(path):
        return None

    with open(path, "rb") as handle:
        payload = pickle.loads(handle.read())

    if payload["expires_at"] < time.time():
        os.remove(path)
        return None
    return payload["value"]


def cache_delete(key):
    path = _path_for(key)
    if os.path.exists(path):
        os.remove(path)


def clear():
    if not os.path.isdir(Config.CACHE_DIR):
        return 0
    names = [n for n in os.listdir(Config.CACHE_DIR) if n.endswith(".cache")]
    for name in names:
        os.remove(os.path.join(Config.CACHE_DIR, name))
    return len(names)


def memoize(ttl=300):
    def decorator(func):
        def wrapper(*args):
            key = func.__name__ + ":" + ":".join(str(a) for a in args)
            hit = cache_get(key)
            if hit is not None:
                return hit
            value = func(*args)
            cache_set(key, value, ttl)
            return value

        return wrapper

    return decorator
