import pytest
from datetime import datetime, timedelta, timezone

# =========================
# In-memory Supabase stub
# =========================

class _Result:
    def __init__(self, data=None, count=None):
        self.data = data
        self.count = count
    def execute(self):
        return self

class _BaseQuery:
    def __init__(self, store, table):
        self.store = store
        self.table = table
        self._filters = []     # tuples (op, field, value)
        self._order = None     # (field, desc)
        self._range = None     # (start, end)
        self._join = None      # (join_table, left_field, right_field)

    def eq(self, field, value):
        self._filters.append(("eq", field, value)); return self
    def gte(self, field, value):
        self._filters.append(("gte", field, value)); return self
    def lt(self, field, value):
        self._filters.append(("lt", field, value)); return self
    def in_(self, field, values):
        self._filters.append(("in", field, list(values))); return self
    def ilike(self, field, pattern):
        self._filters.append(("ilike", field, pattern)); return self
    def order(self, field, desc=False):
        self._order = (field, bool(desc)); return self
    def range(self, start, end):
        self._range = (start, end); return self
    def join(self, join_table, left_field, right_field):
        self._join = (join_table, left_field, right_field); return self

    # — helpers —
    def _get_join_row(self, row):
        if not self._join:
            return None
        jt, lf, rf = self._join
        left_val = row.get(lf)
        for jr in self.store[jt]:
            if jr.get(rf) == left_val:
                return jr
        return None

    def _get_value(self, row, field):
        # Support dotted: "chat_sessions.user_id" on joined row
        if "." in field:
            tbl, col = field.split(".", 1)
            if not self._join or tbl != self._join[0]:
                return None
            jrow = self._get_join_row(row)
            return jrow.get(col) if jrow else None
        return row.get(field)

    def _match(self, row):
        for op, f, v in self._filters:
            rv = self._get_value(row, f)
            if op == "eq":
                if rv != v: return False
            elif op == "gte":
                if rv is None or rv < v: return False
            elif op == "lt":
                if rv is None or rv >= v: return False
            elif op == "in":
                if rv not in v: return False
            elif op == "ilike":
                # only handle %substr% case (case-insensitive)
                s = str(rv or "")
                pat = str(v or "")
                if pat.startswith("%") and pat.endswith("%"):
                    needle = pat[1:-1].lower()
                    if needle not in s.lower(): return False
                else:
                    if s.lower() != pat.lower(): return False
        return True

    def _apply_order_range(self, rows):
        if self._order:
            field, desc = self._order
            rows = sorted(rows, key=lambda r: r.get(field), reverse=desc)
        if self._range:
            s, e = self._range
            rows = rows[s:e+1]
        return rows

class _Select(_BaseQuery):
    def __init__(self, store, table):
        super().__init__(store, table)
        self._count = None
    def select(self, *_cols, count=None):
        self._count = count; return self
    def execute(self):
        rows = []
        for r in self.store[self.table]:
            if self._match(r):
                rows.append(r.copy())
        rows = self._apply_order_range(rows)
        cnt = len(rows) if self._count == "exact" else None
        return _Result(rows, cnt)

class _Insert:
    def __init__(self, store, table, payload):
        self.store = store; self.table = table; self.payload = payload
    def execute(self):
        inserted = []
        items = self.payload if isinstance(self.payload, list) else [self.payload]
        next_id = (max([r.get("id", 0) for r in self.store[self.table]] or [0]) + 1)
        for item in items:
            row = item.copy()
            if "id" not in row:
                row["id"] = next_id; next_id += 1
            self.store[self.table].append(row)
            inserted.append(row.copy())
        return _Result(inserted)

class _Update(_BaseQuery):
    def __init__(self, store, table, payload):
        super().__init__(store, table); self.payload = payload
    def execute(self):
        updated = []
        for r in self.store[self.table]:
            if self._match(r):
                r.update(self.payload)
                updated.append(r.copy())
        return _Result(updated)

class _Delete(_BaseQuery):
    def execute(self):
        kept, deleted = [], []
        for r in self.store[self.table]:
            (deleted if self._match(r) else kept).append(r)
        self.store[self.table][:] = kept
        return _Result(deleted)

class SupabaseStub:
    def __init__(self):
        from collections import defaultdict
        self.tables = defaultdict(list)

    def table(self, name):
        class _Shim:
            def __init__(self, outer, table):
                self.outer = outer; self.table = table
            def select(self, *cols, count=None):
                return _Select(self.outer.tables, self.table).select(*cols, count=count)
            def insert(self, payload):
                return _Insert(self.outer.tables, self.table, payload)
            def update(self, payload):
                return _Update(self.outer.tables, self.table, payload)
            def delete(self):
                return _Delete(self.outer.tables, self.table)
        return _Shim(self, name)

    # No RPC needed here

# =========================
# Fixtures / monkeypatch
# =========================

@pytest.fixture()
def sb(monkeypatch):
    import src.db.chat_history as ch
    stub = SupabaseStub()
    # Patch in the module where it's actually used
    monkeypatch.setattr(ch, "get_supabase_client", lambda: stub)
    return stub

def iso_now():
    return datetime.now(timezone.utc).isoformat()

# =========================
# Tests
# =========================

def test_create_and_get_session_with_messages(sb):
    import src.db.chat_history as ch
    # create session
    sess = ch.create_chat_session(user_id=1, title="Session A", model="openai/gpt-4o")
    assert sess["user_id"] == 1
    # add messages (ensure ascending created_at order)
    ch.save_chat_message(sess["id"], "user", "hello", "gpt", 5)
    ch.save_chat_message(sess["id"], "assistant", "hi!", "gpt", 3)

    loaded = ch.get_chat_session(sess["id"], user_id=1)
    assert loaded is not None
    assert loaded["id"] == sess["id"]
    assert len(loaded["messages"]) == 2
    assert [m["role"] for m in loaded["messages"]] == ["user", "assistant"]

def test_get_user_chat_sessions_pagination_and_sort(sb):
    import src.db.chat_history as ch
    # seed sessions with different updated_at
    base = datetime.now(timezone.utc)
    for i in range(5):
        s = {
            "user_id": 2,
            "title": f"S{i}",
            "model": "m",
            "created_at": (base - timedelta(minutes=i)).isoformat(),
            "updated_at": (base - timedelta(minutes=i)).isoformat(),
            "is_active": True,
        }
        sb.table("chat_sessions").insert(s).execute()
    # Most recent first; limit 2
    sessions_page1 = ch.get_user_chat_sessions(2, limit=2, offset=0)
    sessions_page2 = ch.get_user_chat_sessions(2, limit=2, offset=2)
    assert len(sessions_page1) == 2
    assert sessions_page1[0]["updated_at"] >= sessions_page1[1]["updated_at"]
    # no overlap
    ids1 = {s["title"] for s in sessions_page1}
    ids2 = {s["title"] for s in sessions_page2}
    assert ids1.isdisjoint(ids2)

def test_update_and_delete_chat_session(sb):
    import src.db.chat_history as ch
    sess = ch.create_chat_session(user_id=3, title="Old", model="m1")
    ok = ch.update_chat_session(sess["id"], 3, title="New Title", model="m2")
    assert ok is True
    stored = [r for r in sb.tables["chat_sessions"] if r["id"] == sess["id"]][0]
    assert stored["title"] == "New Title"
    assert stored["model"] == "m2"

    # soft delete
    deleted = ch.delete_chat_session(sess["id"], 3)
    assert deleted is True
    # not returned anymore
    assert ch.get_chat_session(sess["id"], 3) is None
    active = ch.get_user_chat_sessions(3)
    assert all(s["is_active"] for s in active)

def test_chat_session_stats(sb):
    import src.db.chat_history as ch
    # Two sessions, one inactive
    s1 = ch.create_chat_session(4, "T1", "m")
    s2 = ch.create_chat_session(4, "T2", "m")
    # mark s2 inactive
    sb.table("chat_sessions").update({"is_active": False}).eq("id", s2["id"]).execute()
    # messages on both sessions (only s1 should count in totals for sessions, but messages/tokens queries
    # are joined with active sessions)
    ch.save_chat_message(s1["id"], "user", "msg1", tokens=10)
    ch.save_chat_message(s1["id"], "assistant", "msg2", tokens=5)
    ch.save_chat_message(s2["id"], "user", "msg3", tokens=99)

    out = ch.get_chat_session_stats(4)
    assert out["total_sessions"] == 1  # only active
    assert out["total_messages"] == 2   # joined to active session only
    assert out["total_tokens"] == 15

def test_search_chat_sessions_title_and_message(sb):
    import src.db.chat_history as ch
    # three sessions, one matches title, one via message, one irrelevant
    s1 = ch.create_chat_session(5, "Build vector index", "m")
    s2 = ch.create_chat_session(5, "Chit chat", "m")
    s3 = ch.create_chat_session(5, "Other", "m")

    ch.save_chat_message(s2["id"], "user", "how to build an INDEX quickly?", tokens=1)
    ch.save_chat_message(s3["id"], "user", "no match here", tokens=1)

    res = ch.search_chat_sessions(5, "index", limit=10)
    ids = {r["id"] for r in res}
    assert s1["id"] in ids      # matched by title
    assert s2["id"] in ids      # matched by message content
    assert s3["id"] not in ids  # no match

    # ensure sorted by updated_at desc
    assert res == sorted(res, key=lambda r: r["updated_at"], reverse=True)
