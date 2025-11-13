# API Key Migration Runner for Windows PowerShell
# This script helps run the migration and verification steps

param(
    [switch]$SkipPull,
    [switch]$DashboardOnly,
    [switch]$VerifyOnly
)

$ErrorActionPreference = "Stop"

Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host "API KEY MIGRATION - AUTOMATED RUNNER" -ForegroundColor Cyan
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host ""

# Function to check if command exists
function Test-Command($cmdname) {
    return [bool](Get-Command -Name $cmdname -ErrorAction SilentlyContinue)
}

# Check required tools
Write-Host "🔍 Checking required tools..." -ForegroundColor Yellow

$hasSupabase = Test-Command "supabase"
$hasPython = Test-Command "python"
$hasPsql = Test-Command "psql"

if ($hasSupabase) {
    Write-Host "  ✅ Supabase CLI found" -ForegroundColor Green
} else {
    Write-Host "  ⚠️  Supabase CLI not found" -ForegroundColor Yellow
    Write-Host "     Install: npm install -g supabase" -ForegroundColor Gray
}

if ($hasPython) {
    Write-Host "  ✅ Python found" -ForegroundColor Green
} else {
    Write-Host "  ❌ Python not found - required for verification" -ForegroundColor Red
}

Write-Host ""

# If verify only mode
if ($VerifyOnly) {
    Write-Host "================================================================================" -ForegroundColor Cyan
    Write-Host "VERIFICATION ONLY MODE" -ForegroundColor Cyan
    Write-Host "================================================================================" -ForegroundColor Cyan
    Write-Host ""

    if ($hasPython) {
        Write-Host "🔍 Running verification script..." -ForegroundColor Yellow
        python scripts/utilities/verify_api_key_migration.py

        if ($LASTEXITCODE -eq 0) {
            Write-Host ""
            Write-Host "✅ VERIFICATION PASSED!" -ForegroundColor Green
        } else {
            Write-Host ""
            Write-Host "❌ VERIFICATION FAILED - See errors above" -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "❌ Python not available for verification" -ForegroundColor Red
        exit 1
    }
    exit 0
}

# If dashboard only mode
if ($DashboardOnly) {
    Write-Host "================================================================================" -ForegroundColor Cyan
    Write-Host "DASHBOARD MIGRATION MODE" -ForegroundColor Cyan
    Write-Host "================================================================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Follow these steps to migrate via Supabase Dashboard:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "1. Open Supabase Dashboard:" -ForegroundColor White
    Write-Host "   https://supabase.com/dashboard" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "2. Select your project" -ForegroundColor White
    Write-Host ""
    Write-Host "3. Go to SQL Editor (left sidebar)" -ForegroundColor White
    Write-Host ""
    Write-Host "4. Create a new query" -ForegroundColor White
    Write-Host ""
    Write-Host "5. Copy the migration SQL:" -ForegroundColor White
    $migrationPath = "supabase/migrations/20251112000000_migrate_legacy_api_keys.sql"
    if (Test-Path $migrationPath) {
        Write-Host "   Opening file: $migrationPath" -ForegroundColor Cyan
        Write-Host ""

        # Copy to clipboard if possible
        try {
            Get-Content $migrationPath | Set-Clipboard
            Write-Host "   ✅ Migration SQL copied to clipboard!" -ForegroundColor Green
        } catch {
            Write-Host "   📄 Migration file location:" -ForegroundColor Yellow
            Write-Host "   $(Resolve-Path $migrationPath)" -ForegroundColor Gray
        }

        Write-Host ""
        Write-Host "6. Paste into SQL Editor and click RUN" -ForegroundColor White
        Write-Host ""
        Write-Host "7. After running, verify with:" -ForegroundColor White
        Write-Host "   .\run_migration.ps1 -VerifyOnly" -ForegroundColor Cyan
    } else {
        Write-Host "   ❌ Migration file not found: $migrationPath" -ForegroundColor Red
        exit 1
    }
    exit 0
}

# Normal migration flow
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host "STEP 1: SYNC LOCAL WITH REMOTE" -ForegroundColor Cyan
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host ""

if (-not $SkipPull -and $hasSupabase) {
    Write-Host "📥 Pulling remote database schema..." -ForegroundColor Yellow
    Write-Host ""

    try {
        supabase db pull
        Write-Host ""
        Write-Host "✅ Database schema pulled successfully" -ForegroundColor Green
        Write-Host ""
    } catch {
        Write-Host ""
        Write-Host "⚠️  Warning: supabase db pull failed" -ForegroundColor Yellow
        Write-Host "    Error: $_" -ForegroundColor Red
        Write-Host ""
        Write-Host "    Options:" -ForegroundColor Yellow
        Write-Host "    1. Run: .\run_migration.ps1 -DashboardOnly" -ForegroundColor Cyan
        Write-Host "    2. Check connection: supabase login" -ForegroundColor Cyan
        Write-Host ""

        $continue = Read-Host "Continue with migration anyway? (y/N)"
        if ($continue -ne 'y') {
            exit 1
        }
    }
} elseif ($SkipPull) {
    Write-Host "⏭️  Skipping database pull (--SkipPull flag set)" -ForegroundColor Yellow
    Write-Host ""
} else {
    Write-Host "⚠️  Supabase CLI not available - skipping pull" -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host "STEP 2: APPLY MIGRATION" -ForegroundColor Cyan
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host ""

if ($hasSupabase) {
    Write-Host "📤 Pushing migration to remote database..." -ForegroundColor Yellow
    Write-Host ""

    try {
        supabase db push
        Write-Host ""
        Write-Host "✅ Migration applied successfully" -ForegroundColor Green
        Write-Host ""
    } catch {
        Write-Host ""
        Write-Host "❌ Migration failed!" -ForegroundColor Red
        Write-Host "    Error: $_" -ForegroundColor Red
        Write-Host ""
        Write-Host "    Try using Dashboard method:" -ForegroundColor Yellow
        Write-Host "    .\run_migration.ps1 -DashboardOnly" -ForegroundColor Cyan
        Write-Host ""
        exit 1
    }
} else {
    Write-Host "⚠️  Supabase CLI not available" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "    Use Dashboard method instead:" -ForegroundColor Yellow
    Write-Host "    .\run_migration.ps1 -DashboardOnly" -ForegroundColor Cyan
    Write-Host ""
    exit 1
}

Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host "STEP 3: VERIFY MIGRATION" -ForegroundColor Cyan
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host ""

if ($hasPython) {
    Write-Host "🔍 Running automated verification..." -ForegroundColor Yellow
    Write-Host ""

    python scripts/utilities/verify_api_key_migration.py

    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "================================================================================" -ForegroundColor Green
        Write-Host "✅ MIGRATION COMPLETED SUCCESSFULLY!" -ForegroundColor Green
        Write-Host "================================================================================" -ForegroundColor Green
        Write-Host ""
        Write-Host "Next steps:" -ForegroundColor Yellow
        Write-Host "  1. Monitor application logs for 24-48 hours" -ForegroundColor White
        Write-Host "  2. Check for PGRST205 errors (should be gone)" -ForegroundColor White
        Write-Host "  3. Check for legacy key warnings (should be gone)" -ForegroundColor White
        Write-Host "  4. Review: docs/MIGRATION_VERIFICATION_CHECKLIST.md" -ForegroundColor White
        Write-Host ""
    } else {
        Write-Host ""
        Write-Host "================================================================================" -ForegroundColor Red
        Write-Host "⚠️  MIGRATION COMPLETED BUT VERIFICATION FAILED" -ForegroundColor Red
        Write-Host "================================================================================" -ForegroundColor Red
        Write-Host ""
        Write-Host "Please review the errors above and:" -ForegroundColor Yellow
        Write-Host "  1. Check docs/MIGRATION_VERIFICATION_CHECKLIST.md" -ForegroundColor White
        Write-Host "  2. Run SQL verification: Get-Content scripts/utilities/migration_verification.sql" -ForegroundColor White
        Write-Host "  3. Contact support if needed" -ForegroundColor White
        Write-Host ""
        exit 1
    }
} else {
    Write-Host "⚠️  Python not available - skipping automated verification" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Please verify manually:" -ForegroundColor Yellow
    Write-Host "  1. Check Supabase Dashboard SQL Editor" -ForegroundColor White
    Write-Host "  2. Run queries from: scripts/utilities/migration_verification.sql" -ForegroundColor White
    Write-Host ""
}

Write-Host ""
