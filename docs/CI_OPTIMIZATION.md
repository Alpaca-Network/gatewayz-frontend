# CI Pipeline Optimization

This document describes the optimizations applied to the backend CI test pipeline to improve execution speed and efficiency.

## Overview

The optimized CI pipeline reduces test execution time through:

1. **Dependency caching** - Wheelhouse caching for binary dependencies
2. **Parallel test execution** - 4-way test sharding across runners
3. **Smart test splitting** - Duration-based splitting using pytest-split
4. **Concurrency control** - Cancel in-progress runs on new pushes
5. **Path filtering** - Only run on relevant file changes

## Key Optimizations

### 1. Wheelhouse Caching

Binary dependencies (numpy, pandas, etc.) are built once and cached as wheels:

```yaml
- name: Restore wheelhouse cache
  uses: actions/cache@v4
  with:
    path: .cache/wheels
    key: ${{ runner.os }}-wheels-${{ hashFiles('requirements*.txt', 'pyproject.toml') }}

- name: Build wheels
  run: |
    mkdir -p .cache/wheels
    pip wheel -r requirements.txt -w .cache/wheels

- name: Install from wheelhouse
  run: |
    pip install --no-index --find-links=.cache/wheels -r requirements.txt
```

**Benefits:**
- Avoids rebuilding binary packages every run
- Reduces install time from ~2-3 minutes to ~30 seconds
- Cache invalidates only when dependencies change

### 2. Parallel Test Execution (4-way Sharding)

Tests are split across 4 parallel runners using `pytest-split`:

```yaml
strategy:
  fail-fast: false
  matrix:
    shard: [1, 2, 3, 4]  # 4-way parallel execution
```

Each shard runs:
- `pytest-xdist` with `-n auto` (uses all CPU cores per runner)
- `pytest-split` with `--splits 4 --group ${{ matrix.shard }}`

**Benefits:**
- ~4x faster test execution (if tests are evenly distributed)
- Each runner uses all available cores
- `fail-fast: false` ensures all shards complete even if one fails

### 3. Duration-Based Test Splitting

`pytest-split` uses timing data from previous runs to intelligently distribute tests:

```yaml
- name: Restore pytest timings
  uses: actions/download-artifact@v4
  with:
    name: pytest-durations
  continue-on-error: true

- name: Run tests shard ${{ matrix.shard }}
  env:
    PYTEST_SPLIT_DURATION_FILE: .pytest-split-durations
  run: |
    pytest tests/ -v --tb=short \
      -n auto \
      --splits 4 --group ${{ matrix.shard }} \
      --dist=loadfile
```

**Benefits:**
- Tests split by actual duration, not just file count
- Avoids "long tail" where one shard runs much longer
- Gets smarter over time as timing data accumulates

### 4. Concurrency Control

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

**Benefits:**
- Cancels old runs when new commits are pushed
- Saves CI minutes and reduces queue time
- Faster feedback on the latest code

### 5. Path Filtering

```yaml
on:
  pull_request:
    paths:
      - "src/**"
      - "tests/**"
      - "requirements*.txt"
      - "pyproject.toml"
      - ".github/workflows/ci.yml"
```

**Benefits:**
- CI only runs when backend code changes
- Avoids wasting CI minutes on doc-only PRs
- Reduces noise in PR checks

## Coverage Merging

Since tests run across 4 shards, coverage reports are merged:

```yaml
coverage:
  name: Coverage Report
  runs-on: ubuntu-latest
  needs: test

  steps:
    - name: Download all coverage artifacts
      uses: actions/download-artifact@v4
      with:
        pattern: coverage-*
        merge-multiple: true

    - name: Merge coverage reports
      run: |
        coverage combine
        coverage xml
        coverage report --fail-under=25
```

## Additional Optimizations

### MyPy Caching

Type checking results are cached per commit:

```yaml
- name: Cache mypy
  uses: actions/cache@v4
  with:
    path: .mypy_cache
    key: ${{ runner.os }}-mypy-${{ github.sha }}
```

### Pytest Caching

Pytest's internal cache is preserved per shard:

```yaml
- name: Cache pytest
  uses: actions/cache@v4
  with:
    path: .pytest_cache
    key: ${{ runner.os }}-pytest-${{ github.sha }}-${{ matrix.shard }}
```

### Shallow Checkouts

Reduce checkout time with shallow clones:

```yaml
- uses: actions/checkout@v4
  with:
    fetch-depth: 1
```

## Expected Performance

### Before Optimization
- **Dependency install**: ~2-3 minutes (every run)
- **Lint**: ~1 minute
- **Tests**: ~8-12 minutes (single runner, sequential)
- **Total**: ~12-16 minutes

### After Optimization
- **Dependency install**: ~30 seconds (cached wheels)
- **Lint**: ~45 seconds (cached wheels + mypy cache)
- **Tests**: ~3-4 minutes (4 parallel shards with xdist)
- **Total**: ~5-7 minutes

**Expected speedup**: 2-3x faster

## Running Locally

To test the optimized workflow locally:

```bash
# Install test dependencies
pip install -r requirements-dev.txt

# Run tests with xdist (parallel within one machine)
pytest tests/ -n auto -v --cov=src -m "not smoke"

# Run tests for a specific shard (simulate CI)
pytest tests/ -n auto --splits 4 --group 1 -v --cov=src -m "not smoke"
```

## Troubleshooting

### Wheel cache not working
- Check that `requirements*.txt` and `pyproject.toml` haven't changed
- Verify cache key matches: look for "Cache restored from key" in logs
- Force clear cache from GitHub Actions UI if needed

### Tests failing in one shard only
- Check if test has hidden dependencies on execution order
- Look for shared state between tests (database records, etc.)
- Run that specific shard locally to debug

### Coverage merge failing
- Ensure all shards upload coverage with unique names
- Check that coverage files exist before merging
- Verify `coverage combine` can find `.coverage.*` files

## Future Optimizations

Potential additional improvements:

1. **Use `uv` instead of `pip`** - 5-10x faster dependency resolution
2. **Self-hosted runners** - More CPU cores for faster `-n auto` execution
3. **Database optimization** - Use local PostgreSQL instead of Supabase
4. **Test caching** - Skip unchanged test files using pytest-picked
5. **Matrix reduction** - Drop Python 3.10/3.11 testing (focus on 3.12)

## References

- [pytest-xdist documentation](https://pytest-xdist.readthedocs.io/)
- [pytest-split documentation](https://github.com/jerry-git/pytest-split)
- [GitHub Actions caching](https://docs.github.com/en/actions/using-workflows/caching-dependencies-to-speed-up-workflows)
