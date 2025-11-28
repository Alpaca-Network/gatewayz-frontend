# Playwright Testing - Quick Start

## 🚀 Fastest Way to Run Tests

### For CI/CD (Recommended)

```bash
pnpm build
pnpm start &
npx wait-on http://localhost:3000/api/health
PLAYWRIGHT_SKIP_WEBSERVER=1 pnpm test:e2e
```

### For Local Development

```bash
# Option 1: Production mode (most reliable)
pnpm test:e2e:prod:start      # Terminal 1 - starts server
PLAYWRIGHT_SKIP_WEBSERVER=1 pnpm test:e2e  # Terminal 2 - runs tests
pnpm test:e2e:prod:stop       # Terminal 1 - stops server

# Option 2: Dev mode with warmup (supports auto-reload)
pnpm dev                      # Terminal 1
pnpm test:e2e:warmup         # Terminal 2

# Option 3: Automatic (slowest, 74s+ first run)
pnpm test:e2e
```

---

## 🔧 Common Commands

| Command | Description |
|---------|-------------|
| `pnpm test:e2e` | Run all E2E tests (auto-starts dev server) |
| `pnpm test:e2e:warmup` | Warm server + run tests |
| `pnpm test:e2e:prod:start` | Start production server |
| `pnpm test:e2e:prod:stop` | Stop production server |
| `pnpm warmup` | Warm up dev server only |
| `pnpm test:e2e:ui` | Run with Playwright UI |
| `pnpm test:e2e:debug` | Run in debug mode |

---

## 🩺 Health Check

```bash
curl http://localhost:3000/api/health
# → {"status":"ok","timestamp":"...","uptime":42.5}
```

---

## 🐛 Troubleshooting

### Tests timing out on /chat?

**Cause**: Next.js cold compilation (74-76s)

**Fix**: Use production mode or warmup
```bash
pnpm test:e2e:prod:start
PLAYWRIGHT_SKIP_WEBSERVER=1 pnpm test:e2e
```

### Port 3000 in use?

```bash
pnpm test:e2e:prod:stop
# or
pkill -f "next start"
```

### Server not responding?

```bash
# Check health
curl http://localhost:3000/api/health

# Check process
ps aux | grep next

# View logs
tail -f /tmp/nextjs-production.log
```

---

## 📚 Full Documentation

See [PLAYWRIGHT_TESTING.md](./PLAYWRIGHT_TESTING.md) for complete guide.

---

## ⚡ Performance

| Method | First Run | CI Time | Reliability |
|--------|-----------|---------|-------------|
| **Production** | 2-5s | Fast | ✅ 100% |
| **Warmup** | 74-120s | Slow | ⚠️ 95% |
| **Auto** | 74-120s | Slow | ⚠️ 90% |

**Recommendation**: Use production mode for CI/CD and reliable local testing.
