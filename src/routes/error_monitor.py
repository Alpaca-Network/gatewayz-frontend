"""
Error monitoring and dashboard endpoints.

Provides API endpoints for viewing errors, generating fixes, and tracking status.
"""

import logging
from typing import List

from fastapi import APIRouter, BackgroundTasks, HTTPException, Query

from src.services.autonomous_monitor import get_autonomous_monitor
from src.services.bug_fix_generator import (
    BugFix,
    get_bug_fix_generator,
)
from src.services.error_monitor import (
    ErrorPattern,
    get_error_monitor,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/error-monitor", tags=["error-monitor"])


@router.get("/health")
async def monitor_health():
    """Check if error monitoring is enabled."""
    try:
        monitor = await get_error_monitor()
        autonomous_monitor = get_autonomous_monitor()
        return {
            "status": "healthy",
            "monitoring_enabled": monitor.loki_enabled,
            "error_patterns_tracked": len(monitor.error_patterns),
            "autonomous_monitoring": {
                "enabled": autonomous_monitor.enabled,
                "running": autonomous_monitor.is_running,
                "auto_fix": autonomous_monitor.auto_fix_enabled,
            },
        }
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/autonomous/status")
async def autonomous_monitor_status():
    """Get autonomous monitoring status."""
    try:
        monitor = get_autonomous_monitor()
        status = await monitor.get_status()
        return {
            "status": "ok",
            "monitor": status,
        }
    except Exception as e:
        logger.error(f"Error getting autonomous monitor status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/errors/recent")
async def get_recent_errors(
    hours: int = Query(1, ge=1, le=24),
    limit: int = Query(100, ge=1, le=1000),
):
    """Get recent errors from logs."""
    try:
        monitor = await get_error_monitor()
        raw_errors = await monitor.fetch_recent_errors(hours=hours, limit=limit)
        patterns = await monitor.analyze_errors(raw_errors)

        return {
            "count": len(patterns),
            "hours": hours,
            "errors": [p.to_dict() for p in patterns],
        }
    except Exception as e:
        logger.error(f"Error fetching recent errors: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/errors/critical")
async def get_critical_errors(
    hours: int = Query(1, ge=1, le=24),
):
    """Get critical and high-severity errors."""
    try:
        monitor = await get_error_monitor()
        critical = await monitor.get_critical_errors(hours=hours)

        return {
            "count": len(critical),
            "hours": hours,
            "critical_errors": [p.to_dict() for p in critical],
        }
    except Exception as e:
        logger.error(f"Error fetching critical errors: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/errors/fixable")
async def get_fixable_errors(
    hours: int = Query(1, ge=1, le=24),
):
    """Get errors that can be automatically fixed."""
    try:
        monitor = await get_error_monitor()
        fixable = await monitor.get_fixable_errors(hours=hours)

        return {
            "count": len(fixable),
            "hours": hours,
            "fixable_errors": [p.to_dict() for p in fixable],
        }
    except Exception as e:
        logger.error(f"Error fetching fixable errors: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/errors/patterns")
async def get_error_patterns():
    """Get tracked error patterns."""
    try:
        monitor = await get_error_monitor()
        patterns = list(monitor.error_patterns.values())

        return {
            "total_patterns": len(patterns),
            "patterns": [p.to_dict() for p in patterns],
        }
    except Exception as e:
        logger.error(f"Error fetching error patterns: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/fixes/generate-for-error")
async def generate_fix_for_error(
    error_id: str = Query(...),
    create_pr: bool = Query(False),
    background_tasks: BackgroundTasks = BackgroundTasks(),
):
    """Generate a fix for a specific error."""
    try:
        monitor = await get_error_monitor()
        generator = await get_bug_fix_generator()

        # Find the error pattern
        error_pattern = None
        for pattern in monitor.error_patterns.values():
            if pattern.to_dict().get("error_type") == error_id:
                error_pattern = pattern
                break

        if not error_pattern:
            raise HTTPException(status_code=404, detail="Error pattern not found")

        # Generate fix in background if create_pr is True
        if create_pr:
            background_tasks.add_task(generator.process_error, error_pattern, create_pr=True)
            return {
                "status": "processing",
                "message": "Fix generation started in background",
            }

        # Otherwise generate synchronously
        fix = await generator.generate_fix(error_pattern)
        if not fix:
            raise HTTPException(status_code=500, detail="Failed to generate fix")

        return {
            "status": "success",
            "fix": fix.to_dict(),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating fix: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/fixes/generate-batch")
async def generate_fixes_batch(
    error_ids: List[str] = Query(...),
    create_prs: bool = Query(False),
    background_tasks: BackgroundTasks = BackgroundTasks(),
):
    """Generate fixes for multiple errors."""
    try:
        monitor = await get_error_monitor()
        generator = await get_bug_fix_generator()

        # Find error patterns
        error_patterns = []
        for pattern in monitor.error_patterns.values():
            if pattern.to_dict().get("error_type") in error_ids:
                error_patterns.append(pattern)

        if not error_patterns:
            raise HTTPException(status_code=404, detail="No matching error patterns found")

        # Process in background
        if create_prs:
            background_tasks.add_task(
                generator.process_multiple_errors,
                error_patterns,
                create_prs=True,
            )
            return {
                "status": "processing",
                "message": f"Processing {len(error_patterns)} errors in background",
                "count": len(error_patterns),
            }

        # Otherwise generate synchronously
        fixes = await generator.process_multiple_errors(error_patterns, create_prs=False)

        return {
            "status": "success",
            "fixes": [f.to_dict() for f in fixes],
            "count": len(fixes),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating batch fixes: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/fixes/generated")
async def get_generated_fixes():
    """Get all generated fixes."""
    try:
        generator = await get_bug_fix_generator()
        fixes = list(generator.generated_fixes.values())

        return {
            "total_fixes": len(fixes),
            "fixes": [f.to_dict() for f in fixes],
        }
    except Exception as e:
        logger.error(f"Error fetching generated fixes: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/fixes/{fix_id}")
async def get_fix_details(fix_id: str):
    """Get details of a specific fix."""
    try:
        generator = await get_bug_fix_generator()

        if fix_id not in generator.generated_fixes:
            raise HTTPException(status_code=404, detail="Fix not found")

        fix = generator.generated_fixes[fix_id]
        return {
            "fix": fix.to_dict(),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching fix details: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/dashboard")
async def error_dashboard():
    """Get comprehensive error dashboard data."""
    try:
        monitor = await get_error_monitor()
        generator = await get_bug_fix_generator()

        # Get recent critical errors
        critical = await monitor.get_critical_errors(hours=1)
        fixable = await monitor.get_fixable_errors(hours=1)

        # Count by category
        category_counts = {}
        for pattern in monitor.error_patterns.values():
            cat = pattern.category.value
            category_counts[cat] = category_counts.get(cat, 0) + pattern.count

        return {
            "timestamp": __import__("datetime").datetime.utcnow().isoformat(),
            "summary": {
                "total_patterns": len(monitor.error_patterns),
                "critical_errors": len(critical),
                "fixable_errors": len(fixable),
                "generated_fixes": len(generator.generated_fixes),
                "patterns_by_category": category_counts,
            },
            "recent_critical": [p.to_dict() for p in critical[:10]],
            "recent_fixable": [p.to_dict() for p in fixable[:10]],
            "recent_fixes": [
                f.to_dict()
                for f in sorted(
                    generator.generated_fixes.values(),
                    key=lambda x: x.generated_at,
                    reverse=True,
                )[:10]
            ],
        }
    except Exception as e:
        logger.error(f"Error building dashboard: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/monitor/start")
async def start_continuous_monitoring(
    interval: int = Query(300, ge=60, le=3600),
    background_tasks: BackgroundTasks = BackgroundTasks(),
):
    """Start continuous error monitoring."""
    try:
        monitor = await get_error_monitor()
        background_tasks.add_task(monitor.monitor_continuously, interval=interval)

        return {
            "status": "started",
            "interval_seconds": interval,
            "message": "Continuous monitoring started in background",
        }
    except Exception as e:
        logger.error(f"Error starting monitoring: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/monitor/scan")
async def scan_for_errors(
    hours: int = Query(1, ge=1, le=24),
    auto_fix: bool = Query(False),
    background_tasks: BackgroundTasks = BackgroundTasks(),
):
    """Trigger a manual scan for errors."""
    try:
        monitor = await get_error_monitor()
        generator = await get_bug_fix_generator()

        # Scan for errors
        raw_errors = await monitor.fetch_recent_errors(hours=hours)
        patterns = await monitor.analyze_errors(raw_errors)

        # Store patterns
        for pattern in patterns:
            monitor.store_error_pattern(pattern)

        result = {
            "status": "scanned",
            "errors_found": len(patterns),
            "hours": hours,
            "critical_errors": sum(1 for p in patterns if p.severity.value in ["critical", "high"]),
        }

        # Auto-fix if requested
        if auto_fix and patterns:
            fixable = [p for p in patterns if p.fixable]
            if fixable:
                background_tasks.add_task(
                    generator.process_multiple_errors,
                    fixable,
                    create_prs=True,
                )
                result["auto_fixes_started"] = len(fixable)

        return result

    except Exception as e:
        logger.error(f"Error scanning for errors: {e}")
        raise HTTPException(status_code=500, detail=str(e))
