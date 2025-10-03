#!/usr/bin/env python3
"""
Migration CLI Tool
Command-line interface for database migrations
"""

import sys
import argparse
from datetime import datetime
from tabulate import tabulate

# Add parent directory to path
sys.path.insert(0, '.')

from src.db_config import get_db_connection
from migrations.migration_manager import MigrationManager


def format_datetime(dt):
    """Format datetime for display"""
    if isinstance(dt, str):
        return dt
    return dt.strftime('%Y-%m-%d %H:%M:%S') if dt else 'N/A'


def cmd_migrate(args):
    """Run pending migrations"""
    manager = MigrationManager(get_db_connection)

    try:
        count = manager.migrate(
            target_version=args.target_version,
            validate=not args.no_validate
        )

        if count > 0:
            print(f"\n✅ Successfully applied {count} migration(s)")
        else:
            print("\n✅ Database is already up to date")

    except Exception as e:
        print(f"\n❌ Migration failed: {e}")
        sys.exit(1)


def cmd_info(args):
    """Show migration status"""
    manager = MigrationManager(get_db_connection)

    try:
        manager.init_schema_version_table()
        info = manager.info()

        print("\n" + "=" * 70)
        print("📊 Database Migration Status")
        print("=" * 70)

        print(f"\nCurrent Version: {info['current_version'] or 'None (empty database)'}")
        print(f"Applied Migrations: {info['applied_count']}")
        print(f"Pending Migrations: {info['pending_count']}")
        print(f"Total Migrations: {info['total_migrations']}")

        if info['pending_migrations']:
            print("\n📋 Pending Migrations:")
            table = [
                [m['version'], m['description']]
                for m in info['pending_migrations']
            ]
            print(tabulate(table, headers=['Version', 'Description'], tablefmt='grid'))

        if info['applied_migrations']:
            print("\n✅ Applied Migrations:")
            table = [
                [
                    m['version'],
                    m['description'],
                    format_datetime(m['installed_on']),
                    '✅' if m['success'] else '❌'
                ]
                for m in info['applied_migrations']
            ]
            print(tabulate(
                table,
                headers=['Version', 'Description', 'Installed On', 'Status'],
                tablefmt='grid'
            ))

    except Exception as e:
        print(f"\n❌ Failed to get migration info: {e}")
        sys.exit(1)


def cmd_validate(args):
    """Validate applied migrations"""
    manager = MigrationManager(get_db_connection)

    try:
        manager.init_schema_version_table()

        print("\n🔍 Validating migrations...")
        if manager.validate_migrations():
            print("✅ All migrations are valid")
        else:
            print("❌ Migration validation failed")
            sys.exit(1)

    except Exception as e:
        print(f"\n❌ Validation error: {e}")
        sys.exit(1)


def cmd_create(args):
    """Create a new migration file"""
    version = args.version
    description = args.description.replace(' ', '_')

    filename = f"V{version}__{description}.sql"
    filepath = f"migrations/sql/{filename}"

    template = f"""-- Migration: {description.replace('_', ' ')}
-- Version: {version}
-- Created: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

-- Your SQL migration here
-- Example:
-- CREATE TABLE example (
--     id SERIAL PRIMARY KEY,
--     name VARCHAR(255) NOT NULL
-- );

"""

    try:
        with open(filepath, 'w') as f:
            f.write(template)

        print(f"\n✅ Created migration file: {filepath}")
        print(f"📝 Edit the file to add your SQL migration")

    except Exception as e:
        print(f"\n❌ Failed to create migration file: {e}")
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(
        description='Database Migration Tool (Flyway-style)',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Show migration status
  python migrations/migrate.py info

  # Run all pending migrations
  python migrations/migrate.py migrate

  # Migrate to specific version
  python migrations/migrate.py migrate --target-version 1.2.0

  # Validate migrations
  python migrations/migrate.py validate

  # Create new migration
  python migrations/migrate.py create --version 1.1.0 --description "add users table"
        """
    )

    subparsers = parser.add_subparsers(dest='command', help='Available commands')

    # migrate command
    migrate_parser = subparsers.add_parser('migrate', help='Run pending migrations')
    migrate_parser.add_argument('--target-version', help='Migrate to specific version')
    migrate_parser.add_argument('--no-validate', action='store_true', help='Skip validation')
    migrate_parser.set_defaults(func=cmd_migrate)

    # info command
    info_parser = subparsers.add_parser('info', help='Show migration status')
    info_parser.set_defaults(func=cmd_info)

    # validate command
    validate_parser = subparsers.add_parser('validate', help='Validate applied migrations')
    validate_parser.set_defaults(func=cmd_validate)

    # create command
    create_parser = subparsers.add_parser('create', help='Create new migration file')
    create_parser.add_argument('--version', required=True, help='Migration version (e.g., 1.0.0)')
    create_parser.add_argument('--description', required=True, help='Migration description')
    create_parser.set_defaults(func=cmd_create)

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(1)

    args.func(args)


if __name__ == '__main__':
    main()