#!/usr/bin/env python3
"""
Check inference latency metrics from usage_records table
"""

from src.supabase_config import get_supabase_client
import sys

def get_latency_stats():
    """Get latency statistics from usage_records"""
    try:
        client = get_supabase_client()

        # Get recent records with latency data
        result = client.table('usage_records').select(
            'model, latency_ms, tokens_used, timestamp'
        ).not_.is_('latency_ms', 'null').order(
            'timestamp', desc=True
        ).limit(100).execute()

        if not result.data or len(result.data) == 0:
            print("No latency data found in usage_records table.")
            print("\nNote: The latency_ms column was just added. Data will appear after:")
            print("1. Running the migration: migrations/sql/V1.0.0__add_latency_to_usage_records.sql")
            print("2. Making API requests to /v1/chat/completions or /v1/images/generations")
            return

        records = result.data

        # Calculate statistics
        latencies = [r['latency_ms'] for r in records if r['latency_ms'] is not None]

        if not latencies:
            print("No latency data available yet.")
            return

        print(f"\n{'='*70}")
        print(f"INFERENCE LATENCY METRICS")
        print(f"{'='*70}\n")

        print(f"Total requests analyzed: {len(latencies)}")
        print(f"\nLatency Statistics:")
        print(f"  Min:     {min(latencies):>8,} ms")
        print(f"  Max:     {max(latencies):>8,} ms")
        print(f"  Average: {sum(latencies) / len(latencies):>8,.1f} ms")
        print(f"  Median:  {sorted(latencies)[len(latencies)//2]:>8,} ms")

        # Percentiles
        sorted_lat = sorted(latencies)
        p50 = sorted_lat[int(len(sorted_lat) * 0.50)]
        p90 = sorted_lat[int(len(sorted_lat) * 0.90)]
        p95 = sorted_lat[int(len(sorted_lat) * 0.95)]
        p99 = sorted_lat[int(len(sorted_lat) * 0.99)] if len(sorted_lat) > 100 else sorted_lat[-1]

        print(f"\nPercentiles:")
        print(f"  P50: {p50:>8,} ms")
        print(f"  P90: {p90:>8,} ms")
        print(f"  P95: {p95:>8,} ms")
        print(f"  P99: {p99:>8,} ms")

        # By model
        model_latencies = {}
        for record in records:
            model = record['model']
            lat = record['latency_ms']
            if model not in model_latencies:
                model_latencies[model] = []
            model_latencies[model].append(lat)

        print(f"\n{'='*70}")
        print("Latency by Model:")
        print(f"{'='*70}")
        for model, lats in sorted(model_latencies.items(), key=lambda x: sum(x[1])/len(x[1])):
            avg = sum(lats) / len(lats)
            print(f"  {model:<50} {avg:>8,.1f} ms (n={len(lats)})")

        # Recent requests
        print(f"\n{'='*70}")
        print("Recent Requests (last 10):")
        print(f"{'='*70}")
        print(f"{'Timestamp':<22} {'Model':<35} {'Latency':>10} {'Tokens':>8}")
        print(f"{'-'*22} {'-'*35} {'-'*10} {'-'*8}")

        for record in records[:10]:
            ts = record['timestamp'][:19] if record['timestamp'] else 'N/A'
            model = (record['model'][:32] + '...') if len(record['model']) > 35 else record['model']
            lat = f"{record['latency_ms']:,} ms" if record['latency_ms'] else 'N/A'
            tokens = record['tokens_used']
            print(f"{ts:<22} {model:<35} {lat:>10} {tokens:>8}")

        print(f"\n{'='*70}\n")

    except Exception as e:
        print(f"Error retrieving latency metrics: {e}")
        print("\nMake sure:")
        print("1. The database migration has been run")
        print("2. SUPABASE_URL and SUPABASE_KEY environment variables are set")
        print("3. You have made some API requests with the updated code")
        sys.exit(1)

if __name__ == "__main__":
    get_latency_stats()
