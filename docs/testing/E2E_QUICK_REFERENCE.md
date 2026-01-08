# E2E Testing Quick Reference

## Credentials (from Privy test account)

```
Email: test-1049@privy.io
OTP:   362762
Phone: +1 555 555 6196
```

---

## Common Commands

### Run Tests

```bash
pnpm test:e2e                    # All tests
pnpm test:e2e:ui                # Interactive mode
pnpm test:e2e:debug             # Debug mode
pnpm test:e2e:headed            # Visible browser
pnpm test:e2e -g "Real Privy"   # Specific suite
```

### Debug & View Reports

```bash
pnpm exec playwright test --last-failed     # Failed tests only
pnpm exec playwright show-report            # View HTML report
npx tsx scripts/validate-e2e-setup.ts       # Validate setup
```

---

## Test Files

| File | Purpose |
|------|---------|
| `e2e/auth.spec.ts` | Mock authentication tests |
| `e2e/auth-privy-real.spec.ts` | Real Privy auth tests |
| `e2e/models-loading.spec.ts` | Models feature tests |
| `e2e/chat*.spec.ts` | Chat feature tests |

---

## Test Fixtures

### authenticatedPage (Mock Auth)
```typescript
test('with mock auth', async ({ authenticatedPage: page }) => {
  // Pre-authenticated with fake credentials
});
```

### realAuthPage (Real Privy Auth)
```typescript
test('with real auth', async ({ realAuthPage: page }) => {
  // Logs in via Privy automatically
  // Uses test-1049@privy.io / 362762
});
```

---

## Environment Variables

```env
PRIVY_TEST_EMAIL=test-1049@privy.io
PRIVY_TEST_OTP=362762
```

---

## GitHub Actions

### View Workflows
```bash
gh run list --repo owner/repo                          # All runs
gh run view RUN_ID --repo owner/repo                   # Specific run
gh workflow list --repo owner/repo                     # All workflows
```

### Trigger E2E Workflow
```bash
gh workflow run e2e-privy-auth.yml --ref main
```

### Set GitHub Secrets
```bash
gh secret set PRIVY_TEST_EMAIL -b "test-1049@privy.io"
gh secret set PRIVY_TEST_OTP -b "362762"
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Tests timeout | Increase timeout: `--timeout=120000` |
| Connection refused | Ensure dev server: `pnpm dev` |
| Privy not working | Check `NEXT_PUBLIC_PRIVY_APP_ID` env var |
| Can't find element | Use UI mode: `pnpm test:e2e:ui` |
| Tests pass locally but fail in CI | Set GitHub Secrets for credentials |

---

## Files Created

- `e2e/auth-privy-real.spec.ts` - Real auth test suite
- `.github/workflows/e2e-privy-auth.yml` - Automated workflow
- `E2E_TESTING.md` - Complete guide (2000+ lines)
- `E2E_AUTOMATION_SETUP.md` - Setup summary
- `scripts/validate-e2e-setup.ts` - Validation script
- `e2e/fixtures.ts` - Updated with realAuthPage
- `.env.example` - Updated with test credentials

---

## Next Steps

1. Test locally: `pnpm test:e2e -g "Real Privy"`
2. Setup GitHub Secrets (see above)
3. Create test PR to verify CI workflow
4. Monitor automated runs (daily 2 AM UTC)

---

## Documentation

- **E2E_TESTING.md** - Full guide with everything
- **E2E_AUTOMATION_SETUP.md** - Setup and implementation details
- **This file** - Quick reference

---

## Status

✅ Setup complete and validated (23/23 checks passed)
✅ Ready to run: `pnpm test:e2e`
