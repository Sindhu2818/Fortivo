import os
import sqlite3

from config import Config


def connect():
    directory = os.path.dirname(Config.DATABASE_PATH)
    if directory and not os.path.isdir(directory):
        os.makedirs(directory)
    conn = sqlite3.connect(Config.DATABASE_PATH, timeout=Config.DATABASE_TIMEOUT)
    conn.row_factory = sqlite3.Row
    return conn


def fetch_all(sql, params=()):
    conn = connect()
    try:
        return conn.execute(sql, params).fetchall()
    finally:
        conn.close()


def fetch_one(sql, params=()):
    conn = connect()
    try:
        return conn.execute(sql, params).fetchone()
    finally:
        conn.close()


def scalar(sql, params=()):
    row = fetch_one(sql, params)
    return row[0] if row else None


def execute(sql, params=()):
    conn = connect()
    try:
        cur = conn.execute(sql, params)
        conn.commit()
        return cur.lastrowid
    finally:
        conn.close()


def execute_many(sql, rows):
    conn = connect()
    try:
        conn.executemany(sql, rows)
        conn.commit()
    finally:
        conn.close()


def build_update(table, changes, allowed, key="id"):
    fields = [name for name in changes if name in allowed]
    if not fields:
        return None, ()
    assignments = ", ".join("%s = ?" % name for name in fields)
    sql = "UPDATE %s SET %s WHERE %s = ?" % (table, assignments, key)
    return sql, tuple(changes[name] for name in fields)
