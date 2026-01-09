# Windows Layout Router Mounting Issue

## Problem
The application crashes on Windows with the error:
```
Error: invariant expected layout router to be mounted
```

## Root Cause
Next.js 15.3.3 has a known issue on Windows where module path casing inconsistencies (`C:\` vs `c:\`) cause duplicate module instances, leading to layout router mounting failures.

The error logs show:
```
There are multiple modules with names that only differ in casing.
This can lead to unexpected behavior when compiling on a filesystem with other case-semantic.
```

## Impact
- Application cannot load in development mode
- Models dropdown cannot be tested
- All features are blocked

## Attempted Fixes (All Failed)
1. ✗ Disabled GTM analytics component
2. ✗ Cleared `.next` build cache
3. ✗ Cleared browser localStorage
4. ✗ Used dynamic imports with `ssr: false`
5. ✗ Created client component wrappers

## Recommended Solutions

### Option 1: Downgrade Next.js (Quickest Fix)
```bash
npm install next@15.0.0
rm -rf .next node_modules/.cache
npm run dev
```

### Option 2: Use WSL2 (Best for Development)
Develop on WSL2 (Windows Subsystem for Linux) where path casing is consistent:
```bash
wsl
cd /mnt/c/Users/vaughn.v/Documents/GitHub/gatewayz-frontend
npm run dev
```

### Option 3: Wait for Next.js Fix
Track this issue: https://github.com/vercel/next.js/issues/

## Models API Fix (Ready When App Loads)
The models loading issue has been fixed with:
- Created `/api/models` proxy endpoint with static fallback data
- Updated model-select and model pages to use the proxy
- Backend needs to implement `GET /models?gateway=X` endpoint
- See `BACKEND_FIXES_NEEDED.md` for details

## Files Modified in This Session
- `src/app/api/models/route.ts` - New API proxy endpoint
- `src/components/chat/model-select.tsx` - Use proxy, add validation
- `src/app/models/[name]/page.tsx` - Use proxy
- `src/app/layout.tsx` - GTM disabled
- `BACKEND_FIXES_NEEDED.md` - Documented backend requirements
