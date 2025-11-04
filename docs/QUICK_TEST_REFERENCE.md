# Quick Testing Reference Card

Keep this handy while creating db tests!

---

## 🚀 Quick Start Commands

```bash
# List all functions in a file
grep -n "^def \|^async def " src/db/FILENAME.py

# Run tests for one file
pytest tests/db/test_FILENAME.py -v

# Run with coverage
pytest tests/db/test_FILENAME.py --cov=src/db/FILENAME --cov-report=html

# Open coverage report
open htmlcov/index.html

# Run all db tests
pytest tests/db/ --cov=src/db --cov-report=term
```

---

## 📝 Test Template (Copy & Paste)

```python
def test_FUNCTION_NAME_happy_path(sb):
    """Test FUNCTION_NAME with valid input"""
    import src.db.MODULE as module

    # Arrange
    sb.table("TABLE").insert({"id": 1, "field": "value"}).execute()

    # Act
    result = module.FUNCTION_NAME(param)

    # Assert
    assert result is not None
    assert result["field"] == "value"


def test_FUNCTION_NAME_not_found(sb):
    """Test FUNCTION_NAME when record not found"""
    import src.db.MODULE as module

    result = module.FUNCTION_NAME("nonexistent")
    assert result is None


def test_FUNCTION_NAME_exception_handling(sb, monkeypatch):
    """Test FUNCTION_NAME exception handling"""
    import src.db.MODULE as module

    def raise_exception(name):
        raise Exception("Database error")

    monkeypatch.setattr(sb, "table", raise_exception)

    result = module.FUNCTION_NAME("any")
    assert result is None  # or: with pytest.raises(RuntimeError)
```

---

## 🎯 Test Checklist (Per Function)

For EACH function, write tests for:

- [ ] ✅ **Happy path** - Function works with valid input
- [ ] ✅ **Not found** - Record/entity doesn't exist
- [ ] ✅ **Empty/None** - Edge case with empty input
- [ ] ✅ **Exception** - Database/connection fails
- [ ] ✅ **Optional params** - Test with/without optional params
- [ ] ✅ **Multiple records** - If function returns lists
- [ ] ✅ **Update scenarios** - If function modifies data
- [ ] ✅ **Delete scenarios** - If function deletes data

---

## 🔍 Common Patterns

### Pattern 1: Read Operations (get, fetch, find)

```python
def test_get_user_success(sb):
    sb.table("users").insert({"id": 1, "name": "Alice"}).execute()
    result = module.get_user(1)
    assert result["name"] == "Alice"

def test_get_user_not_found(sb):
    result = module.get_user(999)
    assert result is None

def test_get_user_exception(sb, monkeypatch):
    monkeypatch.setattr(sb, "table", lambda x: raise Exception())
    result = module.get_user(1)
    assert result is None  # or raises RuntimeError
```

### Pattern 2: Create Operations (create, add, insert)

```python
def test_create_user_success(sb, monkeypatch):
    # Mock any dependencies
    monkeypatch.setattr("module.dependency", lambda: "mock")

    result = module.create_user(username="Alice", email="alice@test.com")

    assert result is not None
    assert result["username"] == "Alice"

    # Verify DB was updated
    users = sb.tables["users"]
    assert len(users) == 1
    assert users[0]["username"] == "Alice"

def test_create_user_failure(sb, monkeypatch):
    # Make insert return empty
    original_table = sb.table
    def broken_table(name):
        t = original_table(name)
        t.insert = lambda data: _Result([])
        return t
    monkeypatch.setattr(sb, "table", broken_table)

    with pytest.raises(RuntimeError):
        module.create_user(username="Fail")
```

### Pattern 3: Update Operations (update, modify, edit)

```python
def test_update_user_success(sb):
    sb.table("users").insert({"id": 1, "name": "Alice"}).execute()

    result = module.update_user(1, {"name": "Bob"})

    assert result is not None
    assert result["name"] == "Bob"

def test_update_user_not_found(sb):
    with pytest.raises(RuntimeError, match="User.*not found"):
        module.update_user(999, {"name": "Bob"})
```

### Pattern 4: Delete Operations (delete, remove)

```python
def test_delete_user_success(sb):
    sb.table("users").insert({"id": 1, "name": "Alice"}).execute()

    result = module.delete_user(1)

    assert result is True
    assert len(sb.tables["users"]) == 0

def test_delete_user_not_found(sb):
    with pytest.raises(RuntimeError, match="not found"):
        module.delete_user(999)
```

---

## 🛠️ Useful Monkeypatch Patterns

### Break Database Insert

```python
def test_insert_failure(sb, monkeypatch):
    original_table = sb.table
    def broken_table(name):
        t = original_table(name)
        t.insert = lambda data: _Result([])  # Empty result
        return t
    monkeypatch.setattr(sb, "table", broken_table)
```

### Break Database Update

```python
def test_update_failure(sb, monkeypatch):
    sb.table("users").insert({"id": 1}).execute()

    original_table = sb.table
    def broken_table(name):
        t = original_table(name)
        def bad_update(data):
            raise Exception("Update failed")
        t.update = bad_update
        return t
    monkeypatch.setattr(sb, "table", broken_table)
```

### Make Entire Table Raise Exception

```python
def test_database_error(sb, monkeypatch):
    def raise_exception(name):
        raise Exception("Database error")
    monkeypatch.setattr(sb, "table", raise_exception)
```

### Mock External Dependencies

```python
def test_with_mocked_dependency(sb, monkeypatch):
    # Mock function in the module under test
    import src.db.MODULE as module
    monkeypatch.setattr(module, "external_function", lambda: "mocked")

    # Or mock an import
    monkeypatch.setattr("src.db.MODULE.dependency", mock_value)
```

---

## 🎨 Using Test Factories

```python
def test_with_factory(sb, user_factory):
    # Create test user data
    user_data = user_factory.create(
        username="alice",
        credits=100.0,
        role="admin"
    )

    # Insert into stub
    sb.table("users").insert(user_data).execute()

    # Test your function
    result = module.get_user(user_data["api_key"])
    assert result["credits"] == 100.0
```

Available factories:
- `user_factory`
- `api_key_factory`
- `chat_factory`
- `model_factory`
- `payment_factory`
- `referral_factory`

---

## 📊 Coverage Targets

| Lines | Tests Needed | Priority |
|-------|--------------|----------|
| <100 | 10-15 tests | 2-3 hours |
| 100-200 | 20-30 tests | 4-6 hours |
| 200+ | 30-50 tests | 8-12 hours |

**Target Coverage:** 90%+ per file

---

## 🚨 Common Mistakes to Avoid

### ❌ DON'T: Guess the implementation

```python
# Wrong - assuming it returns False
def test_delete_not_found(sb):
    result = module.delete_user(999)
    assert result is False  # ❌ Might raise RuntimeError!
```

### ✅ DO: Read the actual code first

```python
# Right - checked that it raises RuntimeError
def test_delete_not_found(sb):
    with pytest.raises(RuntimeError, match="not found"):
        module.delete_user(999)
```

### ❌ DON'T: Test implementation details

```python
# Wrong - testing how it's done, not what it does
def test_uses_correct_query(sb):
    result = module.get_user(1)
    assert "SELECT" in some_internal_variable  # ❌
```

### ✅ DO: Test behavior and outcomes

```python
# Right - testing what the function returns
def test_returns_user(sb):
    sb.table("users").insert({"id": 1, "name": "Alice"}).execute()
    result = module.get_user(1)
    assert result["name"] == "Alice"  # ✅
```

---

## 🔄 Iteration Process

1. **Write 3-5 tests** for one function
2. **Run coverage**
   ```bash
   pytest tests/db/test_file.py --cov=src/db/file --cov-report=html
   ```
3. **Open HTML report** - See which lines are red
4. **Add tests** for missing lines
5. **Repeat** until 90%+
6. **Move to next function**

---

## 🎯 Daily Goals

### Sustainable Pace:
- **1-2 hours/day** = 1-2 functions tested
- **1 week** = 1 complete file (90%+ coverage)
- **4-6 weeks** = All db files done

### Focus Time Block:
1. **Pick ONE function** to test
2. **Write 3-4 tests** (happy, not found, error)
3. **Run coverage** - check progress
4. **Iterate** if needed
5. **Move to next** function

---

## 💪 Motivation

Remember:
- ✅ **users.py**: 9% → 91% in ONE session
- ✅ **39 tests** all passing
- ✅ **Proven approach** that works
- ✅ **You can do this!**

Each test you write:
- Prevents bugs 🐛
- Saves debugging time ⏱️
- Builds confidence 💪
- Makes refactoring safe 🔒

**Keep going! Every test counts!** 🚀

---

## 📚 Reference Files

- `tests/db/test_users.py` - Perfect example (91% coverage)
- `DB_TESTING_GUIDE.md` - Complete guide
- `DB_TEST_COMPLETION_SUMMARY.md` - Progress summary
- `TEST_COVERAGE_ANALYSIS.md` - Detailed analysis

---

**Last updated:** 2025-10-24
**Next file to test:** `db/api_keys.py`
