#!/usr/bin/env python3
"""
Migration Runner for Supabase
Runs SQL migrations directly against Postgres
"""

import os
from dotenv import load_dotenv
import psycopg2
from urllib.parse import urlparse

load_dotenv()

def get_postgres_connection():
    """Get direct Postgres connection from Supabase URL"""
    supabase_url = os.getenv('SUPABASE_URL')
    supabase_key = os.getenv('SUPABASE_KEY')

    # Extract project ref from URL
    # URL format: https://{project_ref}.supabase.co
    if not supabase_url:
        raise ValueError("SUPABASE_URL not found in environment")

    parsed = urlparse(supabase_url)
    project_ref = parsed.hostname.split('.')[0]

    # Construct Postgres connection string
    # You'll need the database password from Supabase dashboard
    # Format: postgresql://postgres:[YOUR-PASSWORD]@{project_ref}.pooler.supabase.com:6543/postgres

    db_password = os.getenv('SUPABASE_DB_PASSWORD')
    if not db_password:
        print("⚠️  SUPABASE_DB_PASSWORD not found in environment")
        print("Please add it to your .env file")
        print("You can find it in Supabase Dashboard > Settings > Database > Connection String")
        return None

    conn_string = f"postgresql://postgres.{project_ref}:{db_password}@aws-0-us-west-1.pooler.supabase.com:6543/postgres"

    return psycopg2.connect(conn_string)

def run_migration(sql_file_path):
    """Run a SQL migration file"""
    try:
        print(f"📄 Reading migration: {sql_file_path}")
        with open(sql_file_path, 'r') as f:
            sql = f.read()

        print("🔌 Connecting to database...")
        conn = get_postgres_connection()

        if not conn:
            print("❌ Could not connect to database")
            print("\n💡 Alternative: Copy the SQL from migrations/001_create_payments_table.sql")
            print("   and run it in Supabase Dashboard > SQL Editor")
            return False

        print("✅ Connected!")

        cursor = conn.cursor()

        print("🚀 Executing migration...")
        cursor.execute(sql)

        conn.commit()
        cursor.close()
        conn.close()

        print("✅ Migration completed successfully!")
        return True

    except psycopg2.Error as e:
        print(f"❌ Database error: {e}")
        if conn:
            conn.rollback()
        return False
    except FileNotFoundError:
        print(f"❌ Migration file not found: {sql_file_path}")
        return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1:
        migration_file = sys.argv[1]
    else:
        migration_file = "migrations/001_create_payments_table.sql"

    print("=" * 60)
    print("🗄️  Supabase Migration Runner")
    print("=" * 60)
    print()

    success = run_migration(migration_file)

    if not success:
        print("\n" + "=" * 60)
        print("📋 Manual Migration Instructions:")
        print("=" * 60)
        print("1. Go to https://supabase.com/dashboard/project/poxomztzvdkxxpqotybo/sql/new")
        print("2. Copy the contents of migrations/001_create_payments_table.sql")
        print("3. Paste into the SQL Editor")
        print("4. Click 'Run' button")
        print("=" * 60)
        sys.exit(1)
