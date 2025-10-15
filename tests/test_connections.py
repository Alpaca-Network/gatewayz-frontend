# !/usr/bin/env python3
"""
Database Connection Test Script
Run this to verify all database connections before starting the app
"""

import os
import sys
from datetime import datetime


def test_postgres():
    """Test PostgreSQL connection"""
    print("\n🔍 Testing PostgreSQL Connection...")
    try:
        from src.db_config import get_db_config

        db_config = get_db_config()

        if not db_config.enabled:
            print("   ⚠️  PostgreSQL support not available")
            print("   💡 Install: pip install 'psycopg[binary]'")
            return False

        print(f"   Host: {db_config.db_host}:{db_config.db_port}")
        print(f"   Database: {db_config.db_name}")
        print(f"   User: {db_config.db_user}")

        # Check for psycopg_version attribute (may not exist in older versions)
        if hasattr(db_config, 'psycopg_version') and db_config.psycopg_version:
            print(f"   Driver: psycopg{db_config.psycopg_version}")
        else:
            print(f"   Driver: psycopg2")

        # Test connection
        with db_config.get_connection() as conn:
            cursor = conn.cursor()

            # Get version
            cursor.execute("SELECT version();")
            version = cursor.fetchone()[0]
            print(f"   ✅ Connected!")
            print(f"   Version: {version.split(',')[0]}")

            # Check ping_stats table
            cursor.execute("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = 'ping_stats'
                );
            """)
            table_exists = cursor.fetchone()[0]

            if table_exists:
                cursor.execute("SELECT count, last_ping_at FROM ping_stats WHERE id = 1;")
                result = cursor.fetchone()
                if result:
                    print(f"   📊 Current ping count: {result[0]}")
                    if result[1]:
                        print(f"   🕐 Last ping: {result[1]}")
                else:
                    print("   ⚠️  ping_stats table is empty")
                    print("   💡 Run migrations: python migrations/migrate.py migrate")
            else:
                print("   ⚠️  ping_stats table does not exist")
                print("   💡 Run migrations: python migrations/migrate.py migrate")

            cursor.close()

        return True

    except Exception as e:
        print(f"   ❌ Failed: {e}")
        import traceback
        print(f"   Debug: {traceback.format_exc()}")
        return False


def test_redis():
    """Test Redis connection"""
    print("\n🔍 Testing Redis Connection...")
    try:
        from src.redis_config import get_redis_config

        redis_config = get_redis_config()
        print(f"   Host: {redis_config.redis_host}:{redis_config.redis_port}")

        if redis_config.is_available():
            client = redis_config.get_client()

            # Get info
            info = client.info()
            print(f"   ✅ Connected!")
            print(f"   Version: {info.get('redis_version')}")
            print(f"   Uptime: {info.get('uptime_in_seconds')} seconds")
            print(f"   Connected clients: {info.get('connected_clients')}")

            # Check cache
            ping_cache = redis_config.get_cache("ping:count")
            if ping_cache:
                print(f"   📊 Cached ping count: {ping_cache}")
            else:
                print(f"   📊 No cached ping count yet")

            return True
        else:
            print("   ❌ Redis not available")
            print("   💡 Start Docker: ./docker-start.sh start")
            return False

    except Exception as e:
        print(f"   ❌ Failed: {e}")
        return False


def test_supabase():
    """Test Supabase connection"""
    print("\n🔍 Testing Supabase Connection...")
    try:
        from src.supabase_config import get_supabase_client

        supabase_url = os.environ.get('SUPABASE_URL', 'Not set')
        print(f"   URL: {supabase_url}")

        client = get_supabase_client()

        # Test connection
        result = client.table('users').select('*').limit(1).execute()
        print(f"   ✅ Connected!")
        print(f"   📊 Sample query successful")

        return True

    except Exception as e:
        print(f"   ❌ Failed: {e}")
        if "SUPABASE_URL" not in os.environ:
            print("   💡 Set SUPABASE_URL in your .env file")
        if "SUPABASE_KEY" not in os.environ:
            print("   💡 Set SUPABASE_KEY in your .env file")
        return False


def test_docker_services():
    """Test if Docker services are running"""
    print("\n🔍 Testing Docker Services...")
    try:
        import subprocess

        # Check if docker-compose is available
        result = subprocess.run(
            ['docker-compose', 'ps'],
            capture_output=True,
            text=True,
            timeout=5
        )

        if result.returncode == 0:
            output = result.stdout
            postgres_running = 'gatewayz-postgres' in output and 'Up' in output
            redis_running = 'gatewayz-redis' in output and 'Up' in output

            if postgres_running:
                print("   ✅ PostgreSQL container is running")
            else:
                print("   ❌ PostgreSQL container is not running")

            if redis_running:
                print("   ✅ Redis container is running")
            else:
                print("   ❌ Redis container is not running")

            if not postgres_running or not redis_running:
                print("   💡 Start Docker: ./docker-start.sh start")

            return postgres_running and redis_running
        else:
            print("   ⚠️  Could not check Docker status")
            print("   💡 Make sure Docker is running")
            return False

    except FileNotFoundError:
        print("   ⚠️  docker-compose not found")
        print("   💡 Install Docker: https://docs.docker.com/get-docker/")
        return False
    except Exception as e:
        print(f"   ⚠️  Error checking Docker: {e}")
        return False


def main():
    print("=" * 70)
    print("🔧 Database Connection Test")
    print("=" * 70)

    # Test Docker first
    docker_ok = test_docker_services()

    # Test databases
    results = {
        "PostgreSQL": test_postgres(),
        "Redis": test_redis(),
        "Supabase": test_supabase()
    }

    print("\n" + "=" * 70)
    print("📋 Summary")
    print("=" * 70)

    for db, status in results.items():
        emoji = "✅" if status else "❌"
        print(f"   {emoji} {db}: {'Connected' if status else 'Failed'}")

    all_connected = all(results.values())

    if all_connected:
        print("\n🎉 All databases connected successfully!")
        print("\n💡 Next steps:")
        print("   1. Run migrations: python migrations/migrate.py migrate")
        print("   2. Start server: python -m uvicorn src.main:app --reload")
        print("   3. Test ping: curl http://localhost:8000/ping")
        sys.exit(0)
    else:
        print("\n⚠️  Some databases failed to connect")
        print("\n💡 Troubleshooting:")

        if not results["PostgreSQL"]:
            print("   PostgreSQL:")
            print("     - Install driver: pip install 'psycopg[binary]'")
            print("     - Or try: pip install psycopg2-binary")
            print("     - Check Docker: ./docker-start.sh status")

        if not results["Redis"]:
            print("   Redis:")
            print("     - Start Docker: ./docker-start.sh start")
            print("     - Check logs: ./docker-start.sh logs redis")

        if not results["Supabase"]:
            print("   Supabase:")
            print("     - Verify SUPABASE_URL and SUPABASE_KEY in .env")
            print("     - Check Supabase project status")

        sys.exit(1)


if __name__ == "__main__":
    main()