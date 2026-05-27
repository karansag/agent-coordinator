"""Cute name pool for auto-assigned recipient ids."""

from __future__ import annotations

import random
import sqlite3

POOL = [
    "otter",
    "ferret",
    "badger",
    "panda",
    "tapir",
    "axolotl",
    "puffin",
    "quokka",
    "narwhal",
    "capybara",
    "mongoose",
    "lemur",
    "stoat",
    "marten",
    "ocelot",
    "wombat",
    "pangolin",
    "salamander",
    "kestrel",
    "magpie",
    "hedgehog",
    "raccoon",
    "fennec",
    "dormouse",
    "shrew",
    "manatee",
    "ibis",
    "heron",
    "viper",
    "newt",
    "civet",
    "gecko",
]


def pick_unused(conn: sqlite3.Connection, rng: random.Random | None = None) -> str:
    """Return a cute name not yet taken in `recipients`. Falls back to suffixing."""
    r = rng or random.Random()
    taken = {row[0] for row in conn.execute("SELECT user_id FROM recipients")}
    candidates = [n for n in POOL if n not in taken]
    if candidates:
        return r.choice(candidates)
    # Pool exhausted — append a numeric suffix.
    base = r.choice(POOL)
    n = 2
    while f"{base}-{n}" in taken:
        n += 1
    return f"{base}-{n}"
