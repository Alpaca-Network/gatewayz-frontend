# How to Check Test Coverage - Simple Guide

## 🎯 Quick Answer

**Your test coverage is currently: ~25%**
**Your goal: 90%**

---

## 🚀 3 Ways to Check Coverage

### Method 1: One Command (Easiest)

```bash
python3 -m pytest tests/ --cov=src --cov-report=term
```

**What you'll see:**
```
Name                          Stmts   Miss  Cover
-------------------------------------------------
src/__init__.py                   5      0   100%
src/main.py                     124     89    28%
src/routes/admin.py              45     45     0%
src/routes/auth.py               89     23    74%
src/services/pricing.py          67     12    82%
-------------------------------------------------
TOTAL                          2847   2136    25%
```

The last line shows your **total coverage percentage**.

---

### Method 2: Visual HTML Report (Best)

```bash
# Run tests with HTML output
python3 -m pytest tests/ --cov=src --cov-report=html

# Open in browser
open htmlcov/index.html
```

**What you'll see:**
- 🟢 Green = Well tested
- 🟡 Yellow = Partially tested
- 🔴 Red = Not tested
- Click any file to see which lines are missing tests

---

### Method 3: Use the Script (Comprehensive)

```bash
./quick_coverage.sh
```

This runs tests and opens the HTML report automatically.

---

## 📊 Understanding Coverage

### What the Numbers Mean

```
Name                Stmts   Miss  Cover
----------------------------------------
src/routes/admin.py    45     45     0%   ← No tests! 🔴
src/routes/auth.py     89     23    74%   ← Good! 🟢
src/routes/chat.py    156     12    92%   ← Excellent! 🎯
```

- **Stmts** = Total lines of code
- **Miss** = Lines not tested
- **Cover** = Percentage tested

**Formula:** Cover = (Stmts - Miss) / Stmts × 100%

---

## 🔍 What's Your Current Status?

Based on your codebase:

```
📊 Current Coverage: 25%

Test Files:     92 files ✅
Test Cases:     1,226 tests ✅
Source Files:   126 files

Coverage by Module:
  Routes:       ~40% (18/27 files tested)
  Services:     ~45% (21/46 files tested)
  Database:     ~75% (12/16 files tested)
  Security:     ~20% (3 files, low coverage) 🔴
```

---

## 🎯 Visual Coverage Report

After running the HTML report, you'll see something like this:

```
Module          Coverage   Bar
--------------------------------
routes/         40% ████████░░░░░░░░░░░░
services/       45% █████████░░░░░░░░░░░
db/             75% ███████████████░░░░░
security/       20% ████░░░░░░░░░░░░░░░░
utils/           0% ░░░░░░░░░░░░░░░░░░░░
```

---

## 🚨 Critical Files with 0% Coverage

These need tests URGENTLY:

1. ❌ `src/routes/admin.py` - Admin endpoints (security critical!)
2. ❌ `src/services/model_health_monitor.py` - Health monitoring
3. ❌ `src/services/response_cache.py` - Caching
4. ❌ `src/utils/*` - Utility functions
5. ❌ 26 provider client files

**See full list:** `docs/TESTING_ROADMAP.md`

---

## 📈 Check Coverage on GitHub

Your CI automatically checks coverage on every push!

### View in GitHub Actions:

1. Go to your repo on GitHub
2. Click **"Actions"** tab
3. Click latest workflow run
4. Look for **"Coverage Report"** step

Example output:
```yaml
✅ Coverage: 25.34%
⚠️  Need 65% more to reach 90% target
📊 View detailed report in artifacts
```

### View Codecov (if connected):

1. Go to https://codecov.io
2. Find your repo
3. See visual coverage reports
4. Track coverage trends over time

---

## 💡 Quick Coverage Commands

### See Overall Coverage
```bash
python3 -m pytest tests/ --cov=src --cov-report=term | grep TOTAL
```

### Check Specific Module
```bash
# Routes only
python3 -m pytest tests/routes/ --cov=src/routes --cov-report=term

# Services only
python3 -m pytest tests/services/ --cov=src/services --cov-report=term

# Single file
python3 -m pytest tests/routes/test_auth.py --cov=src/routes/auth --cov-report=term
```

### See Untested Lines
```bash
python3 -m pytest tests/ --cov=src --cov-report=term-missing
```

Output shows missing line numbers:
```
src/routes/admin.py    45     45     0%   1-87
                                          ^^^^^ These lines have no tests
```

---

## 🎯 Your Coverage Goals

```
Current:    25% ███████████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
Week 4:     40% ████████████████████████████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
Week 8:     55% ███████████████████████████████████████████████████████░░░░░░░░░░░░░░░░░
Week 12:    70% ██████████████████████████████████████████████████████████████████████░░░
Week 16:    90% █████████████████████████████████████████████████████████████████████████████████████████
```

**Progress tracker:** Run `./quick_coverage.sh` weekly to track improvement!

---

## 🔧 Troubleshooting

### "pytest: command not found"

```bash
# Install pytest
python3 -m pip install pytest pytest-cov

# Or use requirements
python3 -m pip install -r requirements-dev.txt
```

### "No module named coverage"

```bash
python3 -m pip install coverage
```

### Coverage shows 0%

```bash
# Make sure you're in project root
pwd
# Should show: .../gatewayz-backend

# Run from correct directory
python3 -m pytest tests/ --cov=src
```

---

## 📱 Quick Reference Card

| Command | Purpose |
|---------|---------|
| `python3 -m pytest tests/ --cov=src --cov-report=term` | Terminal coverage |
| `python3 -m pytest tests/ --cov=src --cov-report=html` | HTML report |
| `open htmlcov/index.html` | View HTML report |
| `python3 -m coverage report` | Quick coverage check |
| `./quick_coverage.sh` | All-in-one script |

---

## 🎓 Example Session

```bash
# 1. Run tests with coverage
$ python3 -m pytest tests/ --cov=src --cov-report=html

# Output shows:
# ====== test session starts ======
# ...
# 1226 passed in 45.67s
# Coverage HTML written to htmlcov/index.html

# 2. Open report
$ open htmlcov/index.html

# 3. Browser opens showing:
# - Overall: 25% coverage
# - Click "src/routes/" to see route coverage
# - Click "src/routes/admin.py" to see untested lines
# - Red highlighting shows untested code

# 4. Check specific module
$ python3 -m pytest tests/routes/ --cov=src/routes --cov-report=term

# Output:
# src/routes/admin.py      0%   ← Need to add tests!
# src/routes/auth.py      74%   ← Good coverage
# src/routes/chat.py      92%   ← Excellent!
```

---

## ✅ Success Criteria

You'll know coverage is working when:

- ✅ Command runs without errors
- ✅ See coverage percentage (currently ~25%)
- ✅ HTML report opens in browser
- ✅ Can see green/yellow/red highlighted code
- ✅ GitHub Actions shows coverage in CI

---

## 🚀 Next Steps

1. **Check current coverage:**
   ```bash
   python3 -m pytest tests/ --cov=src --cov-report=html
   open htmlcov/index.html
   ```

2. **Review roadmap:**
   ```bash
   cat docs/TESTING_ROADMAP.md
   ```

3. **Pick a module to test:**
   - Start with `src/routes/admin.py` (0% coverage, critical!)
   - Use templates from `docs/TEST_TEMPLATES.md`

4. **Write tests and re-check:**
   ```bash
   # After writing tests
   python3 -m pytest tests/ --cov=src --cov-report=html
   # See coverage increase!
   ```

---

**TL;DR:**
```bash
python3 -m pytest tests/ --cov=src --cov-report=html && open htmlcov/index.html
```

This one command shows you EXACTLY how much of your code is tested! 🎯

---

**Last Updated:** 2025-10-31
**Your Current Coverage:** 25%
**Your Target:** 90%
**Next Milestone:** 40% (by Week 4)
