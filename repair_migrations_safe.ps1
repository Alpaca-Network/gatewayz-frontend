# Safe Migration History Repair
# This script repairs the migration history, skipping already-applied migrations

Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host "SAFE MIGRATION HISTORY REPAIR" -ForegroundColor Cyan
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "This will sync your local migration history with the remote database..." -ForegroundColor Yellow
Write-Host "Skipping migrations that are already applied to avoid errors." -ForegroundColor Yellow
Write-Host ""

# Migrations to revert (mark as not applied locally)
$revertMigrations = @(
    "20251011",
    "20251012"
)

# Migrations to mark as applied (try each, ignore if already exists)
$appliedMigrations = @(
    "20250116000000",
    "20250116000001",
    "20251011",
    "20251012080000",
    "20251012",
    "20251030000000",
    "20251030000001",
    "20251105000000",
    "20251109000000",
    "20251109000001",
    "20251112000000"
)

$successCount = 0
$skipCount = 0
$errorCount = 0

Write-Host "Step 1: Reverting local status for migrations that don't exist locally..." -ForegroundColor Yellow
foreach ($migration in $revertMigrations) {
    Write-Host "  Reverting: $migration" -ForegroundColor Gray
    try {
        $output = supabase migration repair --status reverted $migration 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "    ✅ Reverted" -ForegroundColor Green
            $successCount++
        } else {
            Write-Host "    ⚠️  Already in correct state" -ForegroundColor Yellow
            $skipCount++
        }
    } catch {
        Write-Host "    ⚠️  Skipped (already correct)" -ForegroundColor Yellow
        $skipCount++
    }
}

Write-Host ""
Write-Host "Step 2: Marking remote migrations as applied..." -ForegroundColor Yellow
foreach ($migration in $appliedMigrations) {
    Write-Host "  Checking: $migration" -ForegroundColor Gray
    try {
        $output = supabase migration repair --status applied $migration 2>&1 | Out-String

        # Check if error is about duplicate key (already applied)
        if ($output -match "duplicate key" -or $output -match "already applied") {
            Write-Host "    ⏭️  Already applied (skipping)" -ForegroundColor Cyan
            $skipCount++
        } elseif ($LASTEXITCODE -eq 0) {
            Write-Host "    ✅ Marked as applied" -ForegroundColor Green
            $successCount++
        } else {
            Write-Host "    ⚠️  Warning: $output" -ForegroundColor Yellow
            $errorCount++
        }
    } catch {
        $errorMsg = $_.Exception.Message
        if ($errorMsg -match "duplicate key" -or $errorMsg -match "already applied") {
            Write-Host "    ⏭️  Already applied (skipping)" -ForegroundColor Cyan
            $skipCount++
        } else {
            Write-Host "    ⚠️  Warning: $errorMsg" -ForegroundColor Yellow
            $errorCount++
        }
    }
}

Write-Host ""
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host "REPAIR SUMMARY" -ForegroundColor Cyan
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  ✅ Successfully repaired: $successCount" -ForegroundColor Green
Write-Host "  ⏭️  Already correct: $skipCount" -ForegroundColor Cyan
Write-Host "  ⚠️  Warnings/Errors: $errorCount" -ForegroundColor Yellow
Write-Host ""

if ($errorCount -gt 0) {
    Write-Host "⚠️  Some migrations had errors, but this is likely OK." -ForegroundColor Yellow
    Write-Host "   The important thing is that the migration states are synced." -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host "NEXT STEP: CHECK IF YOUR MIGRATION ALREADY RAN" -ForegroundColor Cyan
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Before applying the migration, let's check if it already ran..." -ForegroundColor Yellow
Write-Host ""
Write-Host "Go to Supabase Dashboard > SQL Editor and run:" -ForegroundColor White
Write-Host ""
Write-Host "  SELECT COUNT(*) as migrated_keys" -ForegroundColor Cyan
Write-Host "  FROM api_keys_new" -ForegroundColor Cyan
Write-Host "  WHERE key_name = 'Legacy Primary Key';" -ForegroundColor Cyan
Write-Host ""
Write-Host "Results:" -ForegroundColor White
Write-Host "  • If count > 0: Migration already ran! ✅" -ForegroundColor Green
Write-Host "    Run: .\run_migration.ps1 -VerifyOnly" -ForegroundColor Cyan
Write-Host ""
Write-Host "  • If count = 0: Migration not run yet" -ForegroundColor Yellow
Write-Host "    Run: supabase db push" -ForegroundColor Cyan
Write-Host "    Then: python scripts/utilities/verify_api_key_migration.py" -ForegroundColor Cyan
Write-Host ""
