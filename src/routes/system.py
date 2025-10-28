"""
System endpoints for cache management and gateway health monitoring
Phase 2 implementation
"""

import os
import io
import json
import logging
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime, date, timezone, timedelta
from contextlib import redirect_stdout
from html import escape

from fastapi.concurrency import run_in_threadpool

from fastapi import APIRouter, Query, HTTPException
from fastapi.responses import HTMLResponse
import httpx

from src.cache import get_models_cache, get_providers_cache, clear_models_cache, clear_providers_cache, get_modelz_cache, clear_modelz_cache
from src.services.models import (
    fetch_models_from_openrouter,
    fetch_models_from_portkey,
    fetch_models_from_featherless,
    fetch_models_from_chutes,
    fetch_models_from_groq,
    fetch_models_from_fireworks,
    fetch_models_from_together
)
from src.services.huggingface_models import fetch_models_from_hug
from src.config import Config
from src.services.modelz_client import refresh_modelz_cache, get_modelz_cache_status as get_modelz_cache_status_func
from src.services.pricing_lookup import get_model_pricing

try:
    from check_and_fix_gateway_models import run_comprehensive_check  # type: ignore
except Exception:  # pragma: no cover - optional dependency for dashboard
    run_comprehensive_check = None  # type: ignore

# Initialize logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()


def _normalize_timestamp(value: Any) -> Optional[datetime]:
    """Convert a cached timestamp into an aware ``datetime`` in UTC."""

    if not value:
        return None

    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)

    if isinstance(value, date):
        return datetime.combine(value, datetime.min.time(), tzinfo=timezone.utc)

    if isinstance(value, (int, float)):
        try:
            return datetime.fromtimestamp(value, tz=timezone.utc)
        except (OSError, OverflowError, ValueError):
            return None

    if isinstance(value, str):
        try:
            cleaned = value.replace("Z", "+00:00") if value.endswith("Z") else value
            parsed = datetime.fromisoformat(cleaned)
            return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
        except ValueError:
            return None

    return None


def _render_gateway_dashboard(results: Dict[str, Any], log_output: str, auto_fix: bool) -> str:
    """Generate a minimal HTML dashboard for gateway health results."""

    timestamp = escape(results.get("timestamp", ""))
    summary = {
        "total": results.get("total_gateways", 0),
        "healthy": results.get("healthy", 0),
        "unhealthy": results.get("unhealthy", 0),
        "unconfigured": results.get("unconfigured", 0),
        "fixed": results.get("fixed", 0),
    }

    def format_price_value(value: Any) -> Optional[str]:
        if value is None:
            return None
        value_str = str(value).strip()
        if not value_str:
            return None
        # Remove leading currency symbol for numeric parsing
        cleaned = value_str[1:] if value_str.startswith("$") else value_str
        try:
            numeric = float(cleaned)
            if numeric == 0:
                formatted = "0"
            elif numeric < 0.01:
                formatted = f"{numeric:.6f}".rstrip("0").rstrip(".")
            elif numeric < 1:
                formatted = f"{numeric:.4f}".rstrip("0").rstrip(".")
            else:
                formatted = f"{numeric:.2f}".rstrip("0").rstrip(".")
            return f"${formatted}"
        except ValueError:
            return value_str

    def format_pricing_display(pricing: Optional[Dict[str, Any]]) -> str:
        if not isinstance(pricing, dict):
            return ""
        label_map = {
            "prompt": "Prompt",
            "completion": "Completion",
            "input": "Input",
            "output": "Output",
            "cached_prompt": "Cached Prompt",
            "cached_completion": "Cached Completion",
            "request": "Request",
            "image": "Image",
            "audio": "Audio",
            "video": "Video",
            "training": "Training",
            "fine_tune": "Fine-tune",
        }
        unit_map = {
            "prompt": "/1M tokens",
            "completion": "/1M tokens",
            "input": "/1M tokens",
            "output": "/1M tokens",
            "cached_prompt": "/1M tokens",
            "cached_completion": "/1M tokens",
            "request": " each",
            "image": " each",
            "audio": " /min",
            "video": " /min",
            "training": " /hr",
            "fine_tune": " /hr",
        }
        parts: List[str] = []
        for key, raw_value in pricing.items():
            normalized = format_price_value(raw_value)
            if not normalized:
                continue
            label = label_map.get(key, key.replace("_", " ").title())
            unit = unit_map.get(key, "")
            parts.append(f"{label} {normalized}{unit}")
        return " | ".join(parts)

    def status_badge(status: str) -> str:
        status_lower = (status or "unknown").lower()
        if status_lower in {"healthy", "pass", "configured"}:
            cls = "badge badge-healthy"
        elif status_lower in {"unconfigured", "skipped"}:
            cls = "badge badge-unconfigured"
        elif status_lower in {"unhealthy", "fail", "error"}:
            cls = "badge badge-unhealthy"
        else:
            cls = "badge badge-unknown"
        return f'<span class="{cls}">{escape(status.title())}</span>'

    rows = []
    gateways: Dict[str, Any] = results.get("gateways", {}) or {}
    for gateway_id in sorted(gateways.keys()):
        data = gateways[gateway_id] or {}
        name = data.get("name") or gateway_id.title()
        final_status = data.get("final_status", "unknown")
        configured = "Yes" if data.get("configured") else "No"

        endpoint_test = data.get("endpoint_test") or {}
        endpoint_status = "Pass" if endpoint_test.get("success") else "Fail"
        endpoint_msg = endpoint_test.get("message") or "Not run"
        endpoint_count = endpoint_test.get("model_count")
        endpoint_details = endpoint_msg
        if endpoint_count is not None:
            endpoint_details += f" (models: {endpoint_count})"

        cache_test = data.get("cache_test") or {}
        cache_status = "Pass" if cache_test.get("success") else "Fail"
        cache_msg = cache_test.get("message") or "Not run"
        cache_count = cache_test.get("model_count")
        cache_details = cache_msg
        if cache_count is not None:
            cache_details += f" (models: {cache_count})"

        auto_fix_attempted = data.get("auto_fix_attempted")
        auto_fix_successful = data.get("auto_fix_successful")
        auto_fix_text = "Not attempted"
        if auto_fix_attempted:
            auto_fix_text = "Succeeded" if auto_fix_successful else "Failed"

        final_status_lower = (final_status or "unknown").lower()
        toggle_disabled = (not data.get("configured")) or final_status_lower == "healthy"
        toggle_hint = "Toggle to run fix"
        if not data.get("configured"):
            toggle_hint = "Configure API key to enable fixes"
        elif final_status_lower == "healthy":
            toggle_hint = "Gateway healthy"

        toggle_attributes = 'disabled="disabled"' if toggle_disabled else ""
        auto_fix_cell = """
        <div class="fix-toggle">
            <div class="status-text">{status_text}</div>
            <label class="switch">
                <input type="checkbox" onclick="event.stopPropagation()" onchange="handleFixToggle(event, '{gateway_id}', this)" {attributes}>
                <span class="slider"></span>
            </label>
            <span class="toggle-hint">{hint}</span>
        </div>
        """.format(
            status_text=escape(auto_fix_text),
            gateway_id=escape(gateway_id),
            attributes=toggle_attributes,
            hint=escape(toggle_hint)
        )

        # Get models from cache test
        models = cache_test.get("models", [])
        models_html = ""
        if models and len(models) > 0:
            model_items = []
            for model in models:
                pricing_info: Optional[Dict[str, Any]] = None
                pricing_source: Optional[str] = None

                if isinstance(model, dict):
                    model_id = model.get("id") or model.get("model") or str(model)
                    candidate_pricing = model.get("pricing")
                    if isinstance(candidate_pricing, dict) and any(
                        str(v).strip() for v in candidate_pricing.values() if v is not None
                    ):
                        pricing_info = candidate_pricing
                        pricing_source = model.get("pricing_source")
                else:
                    model_id = str(model)

                if pricing_info is None:
                    manual_pricing = get_model_pricing(gateway_id, model_id)
                    if manual_pricing:
                        pricing_info = manual_pricing
                        pricing_source = "manual"

                pricing_display = format_pricing_display(pricing_info)
                if pricing_display:
                    pricing_html = """
                        <div class="pricing">
                            <span class="pricing-label">Pricing:</span>
                            <span class="pricing-value">{pricing_details}</span>
                            {source}
                        </div>
                    """.format(
                        pricing_details=escape(pricing_display),
                        source=(
                            f'<span class="pricing-source">{escape(pricing_source)}</span>'
                            if pricing_source
                            else ""
                        ),
                    )
                else:
                    pricing_html = """
                        <div class="pricing pricing-missing">
                            <span class="pricing-label">Pricing:</span>
                            <span class="pricing-value">Unavailable</span>
                        </div>
                    """

                model_items.append(
                    """
                    <li>
                        <span class="model-id">{model}</span>
                        {pricing_html}
                    </li>
                    """.format(
                        model=escape(model_id),
                        pricing_html=pricing_html,
                    )
                )
            models_html = f"""
            <tr class="model-row" id="models-{escape(gateway_id)}" style="display: none;">
                <td colspan="6" class="models-cell">
                    <div class="models-container">
                        <strong>Successfully loaded models ({len(models)}):</strong>
                        <ul class="models-list">
                            {''.join(model_items)}
                        </ul>
                    </div>
                </td>
            </tr>
            """

        rows.append(
            """
            <tr class="gateway-row {clickable_class}" data-gateway="{gateway_attr}" {onclick}>
                <td>{name} {expand_icon}</td>
                <td>{configured}</td>
                <td>{endpoint_badge}<div class="details">{endpoint_details}</div></td>
                <td>{cache_badge}<div class="details">{cache_details}</div></td>
                <td>{final_badge}</td>
                <td>{auto_fix}</td>
            </tr>
            {models_row}
            """.format(
                clickable_class="clickable" if models_html else "",
                onclick=f'onclick="toggleModels(\'{escape(gateway_id)}\')"' if models_html else "",
                gateway_attr=escape(gateway_id),
                name=escape(name),
                expand_icon='<span class="expand-icon">▶</span>' if models_html else "",
                configured=escape(configured),
                endpoint_badge=status_badge(endpoint_status),
                endpoint_details=escape(endpoint_details),
                cache_badge=status_badge(cache_status),
                cache_details=escape(cache_details),
                final_badge=status_badge(final_status),
                auto_fix=auto_fix_cell,
                models_row=models_html
            )
        )

    rows_html = "\n".join(rows) or "<tr><td colspan=6>No gateways inspected.</td></tr>"

    summary_cards = """
        <div class="card">
            <div class="metric">{total}</div>
            <div class="label">Total Gateways</div>
        </div>
        <div class="card">
            <div class="metric success">{healthy}</div>
            <div class="label">Healthy</div>
        </div>
        <div class="card">
            <div class="metric warning">{unconfigured}</div>
            <div class="label">Unconfigured</div>
        </div>
        <div class="card">
            <div class="metric danger">{unhealthy}</div>
            <div class="label">Unhealthy</div>
        </div>
    """.format(
        total=summary["total"],
        healthy=summary["healthy"],
        unconfigured=summary["unconfigured"],
        unhealthy=summary["unhealthy"],
    )

    if auto_fix:
        summary_cards += """
            <div class=\"card\">
                <div class=\"metric\">{fixed}</div>
                <div class=\"label\">Auto-fixed</div>
            </div>
        """.format(fixed=summary["fixed"])

    raw_json = escape(json.dumps(results, indent=2))
    log_block = escape(log_output.strip()) if log_output else "No log output captured."

    return f"""
    <!DOCTYPE html>
    <html lang=\"en\">
    <head>
        <meta charset=\"utf-8\" />
        <title>Gateway Health Dashboard</title>
        <style>
            body {{
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                background: #0f172a;
                color: #e2e8f0;
                margin: 0;
                padding: 32px;
            }}
            h1 {{
                margin-top: 0;
                font-size: 2rem;
            }}
            .summary {{
                display: flex;
                flex-wrap: wrap;
                gap: 16px;
                margin: 24px 0;
            }}
            .card {{
                background: rgba(148, 163, 184, 0.1);
                border-radius: 12px;
                padding: 16px 20px;
                min-width: 160px;
                box-shadow: 0 12px 24px rgba(15, 23, 42, 0.45);
            }}
            .metric {{
                font-size: 1.75rem;
                font-weight: 700;
            }}
            .metric.success {{ color: #4ade80; }}
            .metric.danger {{ color: #f87171; }}
            .metric.warning {{ color: #facc15; }}
            .label {{
                margin-top: 4px;
                font-size: 0.9rem;
                color: #cbd5f5;
                opacity: 0.85;
            }}
            table {{
                width: 100%;
                border-collapse: collapse;
                background: rgba(15, 23, 42, 0.8);
                border-radius: 12px;
                overflow: hidden;
                box-shadow: 0 16px 32px rgba(15, 23, 42, 0.65);
            }}
            thead {{
                background: rgba(30, 41, 59, 0.9);
            }}
            th, td {{
                padding: 14px 16px;
                text-align: left;
                border-bottom: 1px solid rgba(148, 163, 184, 0.15);
                vertical-align: top;
            }}
            tr:last-child td {{
                border-bottom: none;
            }}
            .badge {{
                display: inline-block;
                padding: 4px 10px;
                border-radius: 999px;
                font-size: 0.75rem;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.04em;
            }}
            .badge-healthy {{
                background: rgba(74, 222, 128, 0.16);
                color: #4ade80;
                border: 1px solid rgba(74, 222, 128, 0.4);
            }}
            .badge-unhealthy {{
                background: rgba(248, 113, 113, 0.16);
                color: #f87171;
                border: 1px solid rgba(248, 113, 113, 0.4);
            }}
            .badge-unconfigured {{
                background: rgba(250, 204, 21, 0.16);
                color: #facc15;
                border: 1px solid rgba(250, 204, 21, 0.4);
            }}
            .badge-unknown {{
                background: rgba(148, 163, 184, 0.16);
                color: #e2e8f0;
                border: 1px solid rgba(148, 163, 184, 0.35);
            }}
            .details {{
                margin-top: 6px;
                font-size: 0.85rem;
                color: rgba(226, 232, 240, 0.8);
            }}
            details {{
                margin-top: 24px;
                background: rgba(30, 41, 59, 0.65);
                border-radius: 12px;
                padding: 16px 20px;
                box-shadow: 0 10px 22px rgba(15, 23, 42, 0.5);
            }}
            summary {{
                cursor: pointer;
                font-weight: 600;
            }}
            pre {{
                white-space: pre-wrap;
                word-break: break-word;
                font-family: 'JetBrains Mono', 'Fira Code', monospace;
                background: rgba(15, 23, 42, 0.75);
                padding: 16px;
                border-radius: 8px;
                color: #cbd5f5;
                margin-top: 16px;
            }}
            .meta {{
                display: flex;
                gap: 12px;
                align-items: center;
                color: rgba(226, 232, 240, 0.75);
                font-size: 0.95rem;
            }}
            .meta strong {{
                color: #e2e8f0;
            }}
            .gateway-row.clickable {{
                cursor: pointer;
                transition: background-color 0.2s ease;
            }}
            .gateway-row.clickable:hover {{
                background: rgba(148, 163, 184, 0.08);
            }}
            .expand-icon {{
                display: inline-block;
                margin-left: 8px;
                transition: transform 0.2s ease;
                font-size: 0.8rem;
                color: #94a3b8;
            }}
            .gateway-row.expanded .expand-icon {{
                transform: rotate(90deg);
            }}
            .models-cell {{
                background: rgba(30, 41, 59, 0.5);
                padding: 20px !important;
            }}
            .models-container {{
                background: rgba(15, 23, 42, 0.6);
                border-radius: 8px;
                padding: 16px;
                border-left: 3px solid #4ade80;
            }}
            .models-container strong {{
                color: #4ade80;
                display: block;
                margin-bottom: 12px;
                font-size: 0.95rem;
            }}
            .models-list {{
                list-style: none;
                padding: 0;
                margin: 0;
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
                gap: 8px;
                max-height: 400px;
                overflow-y: auto;
            }}
            .models-list li {{
                background: rgba(148, 163, 184, 0.08);
                padding: 8px 12px;
                border-radius: 6px;
                font-size: 0.85rem;
                font-family: 'JetBrains Mono', 'Fira Code', monospace;
                color: #cbd5e1;
                border: 1px solid rgba(148, 163, 184, 0.15);
            }}
            .model-id {{
                display: block;
                font-weight: 600;
                color: #f8fafc;
                margin-bottom: 4px;
            }}
            .pricing {{
                font-size: 0.75rem;
                color: rgba(226, 232, 240, 0.75);
                display: flex;
                flex-wrap: wrap;
                gap: 4px;
                align-items: center;
            }}
            .pricing-label {{
                font-weight: 600;
                color: #94a3b8;
            }}
            .pricing-value {{
                color: #cbd5f5;
            }}
            .pricing-source {{
                background: rgba(59, 130, 246, 0.2);
                color: #93c5fd;
                border: 1px solid rgba(59, 130, 246, 0.35);
                border-radius: 999px;
                padding: 2px 8px;
                font-size: 0.7rem;
                text-transform: uppercase;
                letter-spacing: 0.04em;
            }}
            .pricing-missing .pricing-value {{
                color: rgba(226, 232, 240, 0.45);
                font-style: italic;
            }}
            .fix-toggle {{
                display: flex;
                flex-direction: column;
                gap: 8px;
                align-items: flex-start;
            }}
            .fix-toggle .status-text {{
                font-weight: 600;
                font-size: 0.85rem;
                color: #cbd5f5;
            }}
            .fix-toggle .toggle-hint {{
                font-size: 0.75rem;
                color: rgba(226, 232, 240, 0.6);
            }}
            .switch {{
                position: relative;
                display: inline-block;
                width: 48px;
                height: 24px;
            }}
            .switch input {{
                opacity: 0;
                width: 0;
                height: 0;
            }}
            .slider {{
                position: absolute;
                cursor: pointer;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background-color: rgba(248, 113, 113, 0.35);
                transition: 0.2s;
                border-radius: 24px;
                border: 1px solid rgba(248, 113, 113, 0.5);
            }}
            .slider:before {{
                position: absolute;
                content: "";
                height: 18px;
                width: 18px;
                left: 3px;
                bottom: 2px;
                background-color: #0f172a;
                transition: 0.2s;
                border-radius: 50%;
                box-shadow: 0 2px 4px rgba(15, 23, 42, 0.4);
            }}
            .switch input:checked + .slider {{
                background-color: rgba(74, 222, 128, 0.45);
                border-color: rgba(74, 222, 128, 0.7);
            }}
            .switch input:checked + .slider:before {{
                transform: translateX(22px);
            }}
            .switch input:disabled + .slider {{
                background-color: rgba(148, 163, 184, 0.2);
                border-color: rgba(148, 163, 184, 0.3);
                cursor: not-allowed;
            }}
            .models-list::-webkit-scrollbar {{
                width: 8px;
            }}
            .models-list::-webkit-scrollbar-track {{
                background: rgba(15, 23, 42, 0.4);
                border-radius: 4px;
            }}
            .models-list::-webkit-scrollbar-thumb {{
                background: rgba(148, 163, 184, 0.3);
                border-radius: 4px;
            }}
            .models-list::-webkit-scrollbar-thumb:hover {{
                background: rgba(148, 163, 184, 0.5);
            }}
        </style>
    </head>
    <body>
        <h1>Gateway Health Dashboard</h1>
        <div class="meta">
            <div><strong>Run completed:</strong> {timestamp or 'unknown'}</div>
            <div><strong>Auto-fix:</strong> {'Enabled' if auto_fix else 'Disabled'}</div>
        </div>
        <div class="summary">
            {summary_cards}
        </div>
        <table>
            <thead>
                <tr>
                    <th>Gateway</th>
                    <th>Configured</th>
                    <th>Endpoint Check</th>
                    <th>Cache Check</th>
                    <th>Final Status</th>
                    <th>Fix Gateway</th>
                </tr>
            </thead>
            <tbody>
                {rows_html}
            </tbody>
        </table>
        <details>
            <summary>View raw log output</summary>
            <pre>{log_block}</pre>
        </details>
        <details>
            <summary>View raw JSON payload</summary>
            <pre>{raw_json}</pre>
        </details>
        <script>
            function toggleModels(gatewayId) {{
                const modelsRow = document.getElementById('models-' + gatewayId);
                const gatewayRows = document.querySelectorAll('.gateway-row');

                // Find the gateway row that was clicked
                let clickedRow = null;
                gatewayRows.forEach(row => {{
                    if (row.onclick && row.onclick.toString().includes(gatewayId)) {{
                        clickedRow = row;
                    }}
                }});

                if (modelsRow) {{
                    if (modelsRow.style.display === 'none' || modelsRow.style.display === '') {{
                        modelsRow.style.display = 'table-row';
                        if (clickedRow) clickedRow.classList.add('expanded');
                    }} else {{
                        modelsRow.style.display = 'none';
                        if (clickedRow) clickedRow.classList.remove('expanded');
                    }}
                }}
            }}

            async function handleFixToggle(event, gatewayId, checkbox) {{
                event.stopPropagation();
                if (!checkbox.checked) {{
                    return;
                }}

                const container = checkbox.closest('.fix-toggle');
                const statusText = container ? container.querySelector('.status-text') : null;
                const hintText = container ? container.querySelector('.toggle-hint') : null;
                const originalStatus = statusText ? statusText.textContent : '';
                const originalHint = hintText ? hintText.textContent : '';

                checkbox.disabled = true;
                if (statusText) {{
                    statusText.textContent = 'Running fix...';
                }}
                if (hintText) {{
                    hintText.textContent = 'Attempting auto-fix via API...';
                }}

                try {{
                    const response = await fetch('/health/gateways/' + gatewayId + '/fix?auto_fix=true', {{
                        method: 'POST'
                    }});

                    if (!response.ok) {{
                        throw new Error('HTTP ' + response.status);
                    }}

                    const payload = await response.json();

                    if (payload && payload.data) {{
                        const resultStatus = payload.data.auto_fix_successful ? 'Succeeded' : 'Failed';
                        if (statusText) {{
                            statusText.textContent = 'Auto-fix ' + resultStatus;
                        }}
                    }} else if (statusText) {{
                        statusText.textContent = 'Fix attempted';
                    }}

                    if (hintText) {{
                        hintText.textContent = 'Fix completed. Refreshing...';
                    }}

                    checkbox.checked = false;
                    setTimeout(() => window.location.reload(), 600);
                }} catch (error) {{
                    console.error('Failed to run fix for', gatewayId, error);
                    if (statusText) {{
                        statusText.textContent = originalStatus || 'Not attempted';
                    }}
                    if (hintText) {{
                        hintText.textContent = 'Fix failed. Check logs.';
                    }}
                    checkbox.checked = false;
                    checkbox.disabled = false;
                }}
            }}
        </script>
    </body>
    </html>
    """


async def _run_gateway_check(auto_fix: bool) -> Tuple[Dict[str, Any], str]:
    """Execute the comprehensive check in a thread and capture stdout."""

    if run_comprehensive_check is None:
        raise HTTPException(
            status_code=503,
            detail="check_and_fix_gateway_models module is unavailable in this deployment."
        )

    def _runner() -> Tuple[Dict[str, Any], str]:
        buffer = io.StringIO()
        with redirect_stdout(buffer):
            results = run_comprehensive_check(auto_fix=auto_fix, verbose=False)  # type: ignore[arg-type]
        return results, buffer.getvalue()

    return await run_in_threadpool(_runner)


async def _run_single_gateway_check(gateway: str, auto_fix: bool) -> Tuple[Dict[str, Any], str]:
    """Execute the check for a single gateway and capture stdout."""

    if run_comprehensive_check is None:
        raise HTTPException(
            status_code=503,
            detail="check_and_fix_gateway_models module is unavailable in this deployment."
        )

    def _runner() -> Tuple[Dict[str, Any], str]:
        buffer = io.StringIO()
        with redirect_stdout(buffer):
            results = run_comprehensive_check(  # type: ignore[arg-type]
                auto_fix=auto_fix,
                verbose=False,
                gateway=gateway
            )
        return results, buffer.getvalue()

    return await run_in_threadpool(_runner)


@router.post(
    "/health/gateways/{gateway}/fix",
    tags=["health"]
)
async def trigger_gateway_fix(
    gateway: str,
    auto_fix: bool = Query(
        True,
        description="Attempt to auto-fix the specified gateway after running diagnostics."
    )
):
    """
    Trigger a targeted gateway diagnostics run with optional auto-fix.

    Returns structured status along with captured logs so operators can review
    what happened without leaving the dashboard.
    """
    try:
        results, log_output = await _run_single_gateway_check(gateway=gateway, auto_fix=auto_fix)
        gateway_key = gateway.lower()
        gateway_payload = results.get("gateways", {}).get(gateway_key)

        if not gateway_payload:
            raise HTTPException(
                status_code=404,
                detail=f"Gateway '{gateway}' not found in health check results."
            )

        return {
            "success": True,
            "gateway": gateway_key,
            "auto_fix": auto_fix,
            "timestamp": results.get("timestamp"),
            "data": {
                "final_status": gateway_payload.get("final_status"),
                "auto_fix_attempted": gateway_payload.get("auto_fix_attempted"),
                "auto_fix_successful": gateway_payload.get("auto_fix_successful"),
                "endpoint_test": gateway_payload.get("endpoint_test"),
                "cache_test": gateway_payload.get("cache_test"),
            },
            "summary": {
                "total_gateways": results.get("total_gateways"),
                "healthy": results.get("healthy"),
                "unhealthy": results.get("unhealthy"),
                "unconfigured": results.get("unconfigured"),
                "fixed": results.get("fixed"),
            },
            "logs": log_output.strip()
        }
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:  # pragma: no cover - unexpected failures
        logger.exception("Failed to trigger gateway fix for %s", gateway)
        raise HTTPException(status_code=500, detail=f"Failed to run gateway fix: {exc}")


# ============================================================================
# Cache Management Endpoints
# ============================================================================

@router.get("/cache/status", tags=["cache"])
async def get_cache_status():
    """
    Get cache status for all gateways.
    
    Returns information about:
    - Number of models cached per gateway
    - Last refresh timestamp
    - TTL (Time To Live)
    - Cache size estimate
    
    **Example Response:**
    ```json
    {
        "openrouter": {
            "models_cached": 250,
            "last_refresh": "2025-01-15T10:30:00Z",
            "ttl_seconds": 3600,
            "status": "healthy"
        },
        ...
    }
    ```
    """
    try:
        cache_status = {}
        gateways = ["openrouter", "portkey", "featherless", "deepinfra", "chutes", "groq", "fireworks", "together"]
        
        for gateway in gateways:
            cache_info = get_models_cache(gateway)
            
            if cache_info:
                models = cache_info.get("data") or []
                timestamp = cache_info.get("timestamp")
                ttl = cache_info.get("ttl", 3600)
                
                # Calculate cache age
                cache_age_seconds = None
                is_stale = False
                if timestamp:
                    normalized_timestamp = _normalize_timestamp(timestamp)
                    if normalized_timestamp:
                        age = (datetime.now(timezone.utc) - normalized_timestamp).total_seconds()
                        cache_age_seconds = int(age)
                        is_stale = age > ttl
                
                # Convert timestamp to ISO format string
                normalized_timestamp = _normalize_timestamp(timestamp)
                last_refresh = normalized_timestamp.isoformat() if normalized_timestamp else None
                
                cache_status[gateway] = {
                    "models_cached": len(models) if models else 0,
                    "last_refresh": last_refresh,
                    "ttl_seconds": ttl,
                    "cache_age_seconds": cache_age_seconds,
                    "status": "stale" if is_stale else ("healthy" if models else "empty"),
                    "has_data": bool(models)
                }
            else:
                cache_status[gateway] = {
                    "models_cached": 0,
                    "last_refresh": None,
                    "ttl_seconds": 3600,
                    "cache_age_seconds": None,
                    "status": "empty",
                    "has_data": False
                }
        
        # Add providers cache
        providers_cache = get_providers_cache()
        if providers_cache:
            providers = providers_cache.get("data") or []
            timestamp = providers_cache.get("timestamp")
            ttl = providers_cache.get("ttl", 3600)
            
            cache_age_seconds = None
            is_stale = False
            if timestamp:
                normalized_timestamp = _normalize_timestamp(timestamp)
                if normalized_timestamp:
                    age = (datetime.now(timezone.utc) - normalized_timestamp).total_seconds()
                    cache_age_seconds = int(age)
                    is_stale = age > ttl
            
            # Convert timestamp to ISO format string
            normalized_timestamp = _normalize_timestamp(timestamp)
            last_refresh = normalized_timestamp.isoformat() if normalized_timestamp else None
            
            cache_status["providers"] = {
                "providers_cached": len(providers) if providers else 0,
                "last_refresh": last_refresh,
                "ttl_seconds": ttl,
                "cache_age_seconds": cache_age_seconds,
                "status": "stale" if is_stale else ("healthy" if providers else "empty"),
                "has_data": bool(providers)
            }
        else:
            cache_status["providers"] = {
                "providers_cached": 0,
                "last_refresh": None,
                "ttl_seconds": 3600,
                "cache_age_seconds": None,
                "status": "empty",
                "has_data": False
            }
        
        return {
            "success": True,
            "data": cache_status,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    
    except Exception as e:
        logger.error(f"Failed to get cache status: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get cache status: {str(e)}")


@router.post("/cache/refresh/{gateway}", tags=["cache"])
async def refresh_gateway_cache(
    gateway: str,
    force: bool = Query(False, description="Force refresh even if cache is still valid")
):
    """
    Force refresh cache for a specific gateway.
    
    **Parameters:**
    - `gateway`: The gateway to refresh (openrouter, portkey, featherless, etc.)
    - `force`: If true, refresh even if cache is still valid
    
    **Example:**
    ```bash
    curl -X POST "http://localhost:8000/cache/refresh/openrouter?force=true"
    ```
    """
    try:
        gateway = gateway.lower()
        valid_gateways = ["openrouter", "portkey", "featherless", "deepinfra", "chutes", "groq", "fireworks", "together", "huggingface"]

        if gateway not in valid_gateways:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid gateway. Must be one of: {', '.join(valid_gateways)}"
            )
        
        # Check if refresh is needed
        cache_info = get_models_cache(gateway)
        needs_refresh = force
        
        if not force and cache_info:
            timestamp = cache_info.get("timestamp")
            ttl = cache_info.get("ttl", 3600)
            if timestamp:
                normalized_timestamp = _normalize_timestamp(timestamp)
                if normalized_timestamp:
                    age = (datetime.now(timezone.utc) - normalized_timestamp).total_seconds()
                    needs_refresh = age > ttl
        
        if not needs_refresh:
            return {
                "success": True,
                "message": f"Cache for {gateway} is still valid. Use force=true to refresh anyway.",
                "gateway": gateway,
                "action": "skipped",
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        
        # Clear existing cache
        clear_models_cache(gateway)
        
        # Fetch new data based on gateway
        logger.info(f"Refreshing cache for {gateway}...")
        
        fetch_functions = {
            "openrouter": fetch_models_from_openrouter,
            "portkey": fetch_models_from_portkey,
            "featherless": fetch_models_from_featherless,
            "chutes": fetch_models_from_chutes,
            "groq": fetch_models_from_groq,
            "fireworks": fetch_models_from_fireworks,
            "together": fetch_models_from_together,
            "huggingface": fetch_models_from_hug
        }
        
        fetch_func = fetch_functions.get(gateway)
        if fetch_func:
            # Most fetch functions are sync, so we need to handle both
            try:
                result = fetch_func()
                # If it's a coroutine, await it
                if hasattr(result, '__await__'):
                    await result
            except Exception as fetch_error:
                logger.error(f"Error fetching models from {gateway}: {fetch_error}")
                raise HTTPException(status_code=500, detail=f"Failed to fetch models from {gateway}")
        elif gateway == "deepinfra":
            # DeepInfra doesn't have bulk fetching, only individual model fetching
            return {
                "success": False,
                "message": f"DeepInfra does not support bulk cache refresh. Models are fetched on-demand.",
                "gateway": gateway,
                "action": "not_supported",
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        else:
            raise HTTPException(status_code=400, detail=f"Unknown gateway: {gateway}")
        
        # Get updated cache info
        new_cache_info = get_models_cache(gateway)
        models_count = len(new_cache_info.get("data", [])) if new_cache_info else 0
        
        return {
            "success": True,
            "message": f"Cache refreshed successfully for {gateway}",
            "gateway": gateway,
            "models_cached": models_count,
            "action": "refreshed",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to refresh cache for {gateway}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to refresh cache: {str(e)}")


@router.post("/cache/clear", tags=["cache"])
async def clear_all_caches(
    gateway: Optional[str] = Query(None, description="Specific gateway to clear, or all if not specified")
):
    """
    Clear cache for all gateways or a specific gateway.
    
    **Warning:** This will remove all cached data. Use with caution.
    """
    try:
        if gateway:
            gateway = gateway.lower()
            clear_models_cache(gateway)
            return {
                "success": True,
                "message": f"Cache cleared for {gateway}",
                "gateway": gateway,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        else:
            # Clear all gateways
            gateways = ["openrouter", "portkey", "featherless", "deepinfra", "chutes", "groq", "fireworks", "together"]
            for gw in gateways:
                clear_models_cache(gw)
            clear_providers_cache()
            
            return {
                "success": True,
                "message": "All caches cleared",
                "gateways_cleared": gateways + ["providers"],
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
    
    except Exception as e:
        logger.error(f"Failed to clear cache: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to clear cache: {str(e)}")


# ============================================================================
# Gateway Health Monitoring Endpoints
# ============================================================================

@router.get("/health/gateways", tags=["health"])
async def check_all_gateways():
    """
    Check health status of all configured gateways.
    
    Performs live health checks by making test requests to each gateway's API.
    
    **Returns:**
    ```json
    {
        "openrouter": {
            "status": "healthy",
            "latency_ms": 150,
            "available": true,
            "last_check": "2025-01-15T10:30:00Z",
            "error": null
        },
        ...
    }
    ```
    """
    try:
        health_status = {}
        
        # Define gateway endpoints for health checks
        gateway_endpoints = {
            "openrouter": {
                "url": "https://openrouter.ai/api/v1/models",
                "api_key": Config.OPENROUTER_API_KEY,
                "headers": {}
            },
            "portkey": {
                "url": "https://api.portkey.ai/v1/models",
                "api_key": Config.PORTKEY_API_KEY,
                "headers": {"x-portkey-api-key": Config.PORTKEY_API_KEY} if Config.PORTKEY_API_KEY else {}
            },
            "featherless": {
                "url": "https://api.featherless.ai/v1/models",
                "api_key": Config.FEATHERLESS_API_KEY,
                "headers": {"Authorization": f"Bearer {Config.FEATHERLESS_API_KEY}"} if Config.FEATHERLESS_API_KEY else {}
            },
            "deepinfra": {
                "url": "https://api.deepinfra.com/v1/openai/models",
                "api_key": Config.DEEPINFRA_API_KEY,
                "headers": {"Authorization": f"Bearer {Config.DEEPINFRA_API_KEY}"} if Config.DEEPINFRA_API_KEY else {}
            },
            "groq": {
                "url": "https://api.groq.com/openai/v1/models",
                "api_key": os.environ.get("GROQ_API_KEY"),
                "headers": {"Authorization": f"Bearer {os.environ.get('GROQ_API_KEY')}"} if os.environ.get("GROQ_API_KEY") else {}
            },
            "fireworks": {
                "url": "https://api.fireworks.ai/inference/v1/models",
                "api_key": os.environ.get("FIREWORKS_API_KEY"),
                "headers": {"Authorization": f"Bearer {os.environ.get('FIREWORKS_API_KEY')}"} if os.environ.get("FIREWORKS_API_KEY") else {}
            },
            "together": {
                "url": "https://api.together.xyz/v1/models",
                "api_key": os.environ.get("TOGETHER_API_KEY"),
                "headers": {"Authorization": f"Bearer {os.environ.get('TOGETHER_API_KEY')}"} if os.environ.get("TOGETHER_API_KEY") else {}
            }
        }
        
        # Check each gateway
        async with httpx.AsyncClient(timeout=10.0) as client:
            for gateway_name, config in gateway_endpoints.items():
                check_time = datetime.now(timezone.utc)
                
                if not config["api_key"]:
                    health_status[gateway_name] = {
                        "status": "unconfigured",
                        "latency_ms": None,
                        "available": False,
                        "last_check": check_time.isoformat(),
                        "error": "API key not configured"
                    }
                    continue
                
                try:
                    start_time = datetime.now(timezone.utc)
                    response = await client.get(
                        config["url"],
                        headers=config["headers"],
                        timeout=5.0
                    )
                    end_time = datetime.now(timezone.utc)
                    latency_ms = int((end_time - start_time).total_seconds() * 1000)
                    
                    if response.status_code == 200:
                        health_status[gateway_name] = {
                            "status": "healthy",
                            "latency_ms": latency_ms,
                            "available": True,
                            "last_check": check_time.isoformat(),
                            "error": None
                        }
                    else:
                        health_status[gateway_name] = {
                            "status": "degraded",
                            "latency_ms": latency_ms,
                            "available": False,
                            "last_check": check_time.isoformat(),
                            "error": f"HTTP {response.status_code}"
                        }
                
                except httpx.TimeoutException:
                    health_status[gateway_name] = {
                        "status": "timeout",
                        "latency_ms": None,
                        "available": False,
                        "last_check": check_time.isoformat(),
                        "error": "Request timed out"
                    }
                
                except Exception as e:
                    health_status[gateway_name] = {
                        "status": "error",
                        "latency_ms": None,
                        "available": False,
                        "last_check": check_time.isoformat(),
                        "error": str(e)
                    }
        
        # Calculate overall health
        healthy_count = sum(1 for g in health_status.values() if g["status"] == "healthy")
        total_configured = sum(1 for g in health_status.values() if g["status"] != "unconfigured")
        
        return {
            "success": True,
            "data": health_status,
            "summary": {
                "total_gateways": len(health_status),
                "healthy": healthy_count,
                "degraded": sum(1 for g in health_status.values() if g["status"] == "degraded"),
                "unhealthy": sum(1 for g in health_status.values() if g["status"] in ["error", "timeout"]),
                "unconfigured": sum(1 for g in health_status.values() if g["status"] == "unconfigured"),
                "overall_health_percentage": (healthy_count / total_configured * 100) if total_configured > 0 else 0
            },
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    
    except Exception as e:
        logger.error(f"Failed to check gateway health: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to check gateway health: {str(e)}")


@router.get("/health/gateways/dashboard", response_class=HTMLResponse, tags=["health"])
async def gateway_health_dashboard(
    auto_fix: bool = Query(
        False,
        description="Attempt to auto-fix failing gateways using the CLI logic before rendering the dashboard."
    )
):
    """Render an HTML dashboard view of the comprehensive gateway health check."""

    results, log_output = await _run_gateway_check(auto_fix=auto_fix)
    html = _render_gateway_dashboard(results, log_output, auto_fix)
    return HTMLResponse(content=html)


@router.get("/health/gateways/dashboard/data", tags=["health"])
async def gateway_health_dashboard_data(
    auto_fix: bool = Query(
        False,
        description="Attempt to auto-fix failing gateways using the CLI logic before returning the payload."
    ),
    include_logs: bool = Query(
        False,
        description="Include captured stdout logs from the CLI run in the response."
    )
):
    """Expose the dashboard data as JSON for programmatic consumption."""

    results, log_output = await _run_gateway_check(auto_fix=auto_fix)

    payload: Dict[str, Any] = {
        "success": True,
        "timestamp": results.get("timestamp"),
        "auto_fix": auto_fix,
        "summary": {
            "total_gateways": results.get("total_gateways"),
            "healthy": results.get("healthy"),
            "unhealthy": results.get("unhealthy"),
            "unconfigured": results.get("unconfigured"),
            "auto_fixed": results.get("fixed"),
        },
        "gateways": results.get("gateways", {}),
    }

    if include_logs:
        payload["logs"] = log_output

    return payload


@router.get("/health/{gateway}", tags=["health"])
async def check_single_gateway(gateway: str):
    """
    Check health status of a specific gateway with detailed diagnostics.
    
    **Parameters:**
    - `gateway`: Gateway name (openrouter, portkey, featherless, etc.)
    
    **Returns detailed health information including:**
    - API connectivity
    - Response latency
    - Models available
    - Cache status
    """
    try:
        # Get all gateway health first
        all_health = await check_all_gateways()
        gateway_health = all_health["data"].get(gateway.lower())
        
        if not gateway_health:
            raise HTTPException(status_code=404, detail=f"Gateway '{gateway}' not found")
        
        # Add cache information
        cache_info = get_models_cache(gateway.lower())
        if cache_info:
            models = cache_info.get("data") or []
            timestamp = cache_info.get("timestamp")

            normalized_timestamp = _normalize_timestamp(timestamp)

            gateway_health["cache"] = {
                "models_cached": len(models),
                "last_refresh": normalized_timestamp.isoformat() if normalized_timestamp else None,
                "has_data": bool(models)
            }
        else:
            gateway_health["cache"] = {
                "models_cached": 0,
                "last_refresh": None,
                "has_data": False
            }
        
        return {
            "success": True,
            "gateway": gateway.lower(),
            "data": gateway_health,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to check gateway {gateway}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to check gateway health: {str(e)}")


# ============================================================================
# Modelz Cache Management Endpoints
# ============================================================================

@router.get("/cache/modelz/status", tags=["cache", "modelz"])
async def get_modelz_cache_status():
    """
    Get the current status of the Modelz cache.
    
    Returns information about:
    - Cache validity status
    - Number of tokens cached
    - Last refresh timestamp
    - Cache age and TTL
    
    **Example Response:**
    ```json
    {
      "status": "valid",
      "message": "Modelz cache is valid",
      "cache_size": 53,
      "timestamp": 1705123456.789,
      "ttl": 1800,
      "age_seconds": 245.3,
      "is_valid": true
    }
    ```
    """
    try:
        cache_status = get_modelz_cache_status_func()
        return {
            "success": True,
            "data": cache_status,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    except Exception as e:
        logger.error(f"Failed to get Modelz cache status: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get Modelz cache status: {str(e)}")


@router.post("/cache/modelz/refresh", tags=["cache", "modelz"])
async def refresh_modelz_cache_endpoint():
    """
    Force refresh the Modelz cache by fetching fresh data from the API.
    
    This endpoint:
    - Clears the existing Modelz cache
    - Fetches fresh data from the Modelz API
    - Updates the cache with new data
    
    **Example Response:**
    ```json
    {
      "success": true,
      "data": {
        "status": "success",
        "message": "Modelz cache refreshed with 53 tokens",
        "cache_size": 53,
        "timestamp": 1705123456.789,
        "ttl": 1800
      },
      "timestamp": "2024-01-15T10:30:45.123Z"
    }
    ```
    """
    try:
        logger.info("Refreshing Modelz cache via API endpoint")
        refresh_result = await refresh_modelz_cache()
        
        return {
            "success": True,
            "data": refresh_result,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    except Exception as e:
        logger.error(f"Failed to refresh Modelz cache: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to refresh Modelz cache: {str(e)}")


@router.delete("/cache/modelz/clear", tags=["cache", "modelz"])
async def clear_modelz_cache_endpoint():
    """
    Clear the Modelz cache.
    
    This endpoint:
    - Removes all cached Modelz data
    - Resets cache timestamps
    - Forces next request to fetch fresh data from API
    
    **Example Response:**
    ```json
    {
      "success": true,
      "message": "Modelz cache cleared successfully",
      "timestamp": "2024-01-15T10:30:45.123Z"
    }
    ```
    """
    try:
        logger.info("Clearing Modelz cache via API endpoint")
        clear_modelz_cache()
        
        return {
            "success": True,
            "message": "Modelz cache cleared successfully",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    except Exception as e:
        logger.error(f"Failed to clear Modelz cache: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to clear Modelz cache: {str(e)}")
