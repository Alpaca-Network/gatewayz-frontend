# Testing Setup Troubleshooting

Having issues running coverage scripts? This guide will help you fix common problems.

---

## Quick Fix

If you're getting "pip not found" or "python not found", try this:

```bash
# Option 1: Use Python 3 directly
python3 -m pip install pytest pytest-cov coverage
python3 -m pytest tests/ --cov=src --cov-report=html

# Option 2: Create virtual environment first
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
pytest tests/ --cov=src --cov-report=html

# View report
open htmlcov/index.html
```

---

## Common Issues & Solutions

### Issue 1: "pip not found"

**Symptoms:**
```
pip: command not found
```

**Solutions:**

**A. Use pip3 instead:**
```bash
pip3 install pytest pytest-cov coverage
```

**B. Use Python module directly:**
```bash
python3 -m pip install pytest pytest-cov coverage
```

**C. Check if Python is installed:**
```bash
# Check Python version
python3 --version

# If not found, install Python 3.12+
# macOS: brew install python@3.12
# Ubuntu: sudo apt install python3.12
```

---

### Issue 2: "python not found"

**Symptoms:**
```
python: command not found
```

**Solutions:**

**A. Use python3:**
```bash
python3 --version  # Check version
python3 -m pytest tests/  # Run tests
```

**B. Install Python:**
```bash
# macOS
brew install python@3.12

# Ubuntu/Debian
sudo apt update
sudo apt install python3.12

# Verify
python3 --version
```

---

### Issue 3: Virtual Environment Not Working

**Symptoms:**
```
.venv/bin/python not found
```

**Solutions:**

**A. Recreate virtual environment:**
```bash
# Remove old venv
rm -rf .venv

# Create new one
python3 -m venv .venv

# Activate it
source .venv/bin/activate

# Install dependencies
pip install -r requirements-dev.txt

# Verify
which python  # Should show .venv/bin/python
```

**B. Check venv structure:**
```bash
ls -la .venv/
# Should have: bin/, lib/, pyvenv.cfg

# If on Windows Git Bash:
ls -la .venv/Scripts/
# Should have: python.exe, pip.exe
```

---

### Issue 4: "pytest not found"

**Symptoms:**
```
pytest: command not found
```

**Solutions:**

**A. Install pytest:**
```bash
pip3 install pytest pytest-cov
```

**B. Use requirements-dev.txt:**
```bash
pip3 install -r requirements-dev.txt
```

**C. Run as module:**
```bash
python3 -m pytest tests/
```

---

### Issue 5: Permission Denied

**Symptoms:**
```
permission denied: ./scripts/coverage_report.sh
```

**Solution:**
```bash
# Make script executable
chmod +x scripts/coverage_report.sh
chmod +x scripts/coverage_simple.sh

# Run it
./scripts/coverage_report.sh
```

---

### Issue 6: "No module named coverage"

**Symptoms:**
```
ModuleNotFoundError: No module named 'coverage'
```

**Solutions:**

**A. Install coverage:**
```bash
pip3 install pytest-cov coverage[toml]
```

**B. Install all dev dependencies:**
```bash
pip3 install -r requirements-dev.txt
```

---

## Step-by-Step Setup (Fresh Start)

If nothing is working, start fresh:

### Step 1: Verify Python
```bash
python3 --version
# Should be Python 3.12 or higher
```

### Step 2: Create Virtual Environment
```bash
python3 -m venv .venv
```

### Step 3: Activate Virtual Environment
```bash
# macOS/Linux:
source .venv/bin/activate

# Windows (Git Bash):
source .venv/Scripts/activate

# Windows (CMD):
.venv\Scripts\activate.bat

# Windows (PowerShell):
.venv\Scripts\Activate.ps1
```

### Step 4: Upgrade pip
```bash
pip install --upgrade pip
```

### Step 5: Install Dependencies
```bash
pip install -r requirements.txt
pip install -r requirements-dev.txt
```

### Step 6: Verify Installation
```bash
pytest --version
coverage --version
```

### Step 7: Run Tests
```bash
pytest tests/ --cov=src --cov-report=html
```

### Step 8: View Report
```bash
open htmlcov/index.html  # macOS
xdg-open htmlcov/index.html  # Linux
start htmlcov/index.html  # Windows
```

---

## Alternative: Run Without Scripts

If scripts still don't work, run commands directly:

```bash
# Activate venv (if using one)
source .venv/bin/activate

# Run tests with coverage
python3 -m pytest tests/ \
    --cov=src \
    --cov-report=term \
    --cov-report=html \
    -v \
    -m "not smoke"

# View detailed report
open htmlcov/index.html

# Or terminal report
python3 -m coverage report
```

---

## Quick Coverage Check (Minimal)

Just want a quick coverage number?

```bash
# Quick run
python3 -m pytest tests/ --cov=src --cov-report=term

# Last line shows total coverage percentage
```

---

## Environment Check Script

Create a quick diagnostic:

```bash
#!/bin/bash
# Save as: check_environment.sh

echo "Python Check:"
python3 --version || echo "❌ python3 not found"

echo ""
echo "Pip Check:"
pip3 --version || echo "❌ pip3 not found"

echo ""
echo "Virtual Environment:"
if [ -d ".venv" ]; then
    echo "✅ .venv found"
    ls -la .venv/bin/ 2>/dev/null || ls -la .venv/Scripts/ 2>/dev/null
else
    echo "❌ .venv not found"
fi

echo ""
echo "Pytest:"
python3 -m pytest --version || echo "❌ pytest not installed"

echo ""
echo "Coverage:"
python3 -m coverage --version || echo "❌ coverage not installed"

echo ""
echo "Requirements:"
if [ -f "requirements-dev.txt" ]; then
    echo "✅ requirements-dev.txt found"
else
    echo "❌ requirements-dev.txt not found"
fi
```

Run it:
```bash
chmod +x check_environment.sh
./check_environment.sh
```

---

## Platform-Specific Notes

### macOS
- Use `python3` and `pip3`
- Install via Homebrew: `brew install python@3.12`
- Venv location: `.venv/bin/`

### Linux (Ubuntu/Debian)
- Use `python3` and `pip3`
- Install: `sudo apt install python3.12 python3-pip python3-venv`
- Venv location: `.venv/bin/`

### Windows
- May be `python` instead of `python3`
- Venv location: `.venv/Scripts/`
- Use Git Bash or PowerShell

---

## Still Having Issues?

### Check PATH
```bash
echo $PATH
```

### Check Which Python
```bash
which python3
which pip3
```

### Reinstall in Virtual Environment
```bash
# Deactivate current venv
deactivate

# Remove venv
rm -rf .venv

# Create fresh venv
python3 -m venv .venv

# Activate
source .venv/bin/activate

# Install everything fresh
pip install --upgrade pip
pip install -r requirements.txt
pip install -r requirements-dev.txt

# Try tests
pytest tests/ --cov=src --cov-report=html
```

---

## Working Commands (Copy-Paste Ready)

### Minimal Test Run
```bash
python3 -m pytest tests/ --cov=src --cov-report=html -v
open htmlcov/index.html
```

### With Virtual Environment
```bash
source .venv/bin/activate
pytest tests/ --cov=src --cov-report=html -v
open htmlcov/index.html
```

### Single Module
```bash
python3 -m pytest tests/routes/ --cov=src/routes --cov-report=term
```

### Fast Run (Stop on First Failure)
```bash
python3 -m pytest tests/ --cov=src -x -v
```

---

## Success Indicators

You'll know it's working when you see:

```
✅ pytest --version shows: pytest 7.4.3
✅ coverage --version shows: Coverage.py, version 7.x
✅ pytest runs and shows: collected X items
✅ Coverage report shows: TOTAL X%
✅ htmlcov/index.html opens in browser
```

---

## Need Help?

1. Run environment check (see above)
2. Try manual commands (see Working Commands)
3. Check Python/pip installation
4. Recreate virtual environment
5. Install dependencies fresh

---

**Last Updated:** 2025-10-31
**For:** Testing setup troubleshooting
