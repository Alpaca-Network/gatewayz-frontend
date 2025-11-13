# Repair Supabase Migration History
# This script repairs the migration history table to match the remote database

Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host "REPAIRING MIGRATION HISTORY" -ForegroundColor Cyan
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "This will sync your local migration history with the remote database..." -ForegroundColor Yellow
Write-Host ""

# Migrations to revert (mark as not applied locally)
$revertMigrations = @(
    "20251011",
    "20251012"
)

# Migrations to mark as applied
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

Write-Host "Step 1: Reverting local status for migrations that don't exist locally..." -ForegroundColor Yellow
foreach ($migration in $revertMigrations) {
    Write-Host "  Reverting: $migration" -ForegroundColor Gray
    try {
        supabase migration repair --status reverted $migration
        Write-Host "    ✅ Reverted" -ForegroundColor Green
    } catch {
        Write-Host "    ⚠️  Warning: $_" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "Step 2: Marking remote migrations as applied..." -ForegroundColor Yellow
foreach ($migration in $appliedMigrations) {
    Write-Host "  Applying: $migration" -ForegroundColor Gray
    try {
        supabase migration repair --status applied $migration
        Write-Host "    ✅ Applied" -ForegroundColor Green
    } catch {
        Write-Host "    ⚠️  Warning: $_" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host "REPAIR COMPLETE" -ForegroundColor Cyan
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Run: supabase db pull" -ForegroundColor White
Write-Host "  2. Run: supabase db push" -ForegroundColor White
Write-Host "  3. Verify: python scripts/utilities/verify_api_key_migration.py" -ForegroundColor White
Write-Host ""
