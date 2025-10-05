#!/usr/bin/env python3
"""
Database Migration Manager
Flyway-style schema versioning and migration system
"""

import os
import re
import logging
from typing import List, Dict, Optional
from datetime import datetime
import hashlib

logger = logging.getLogger(__name__)


class Migration:
    """Represents a single database migration"""

    def __init__(self, version: str, description: str, sql_file: str):
        self.version = version
        self.description = description
        self.sql_file = sql_file
        self.checksum: Optional[str] = None

    def calculate_checksum(self) -> str:
        """Calculate MD5 checksum of the SQL file"""
        with open(self.sql_file, 'rb') as f:
            return hashlib.md5(f.read()).hexdigest()

    def __repr__(self):
        return f"Migration(version={self.version}, description={self.description})"

    def __lt__(self, other):
        """Allow sorting migrations by version"""
        return self._version_tuple() < other._version_tuple()

    def _version_tuple(self):
        """Convert version string to tuple for comparison (e.g., '1.0.0' -> (1, 0, 0))"""
        return tuple(map(int, self.version.split('.')))


class MigrationManager:
    """Manages database schema migrations"""

    def __init__(self, db_connection_factory, migrations_dir: str = "migrations/sql"):
        """
        Initialize migration manager

        Args:
            db_connection_factory: Function that returns database connection context manager
            migrations_dir: Directory containing SQL migration files
        """
        self.db_connection_factory = db_connection_factory
        self.migrations_dir = migrations_dir
        self.migration_table = "schema_version"

    def init_schema_version_table(self):
        """Create the schema_version table to track migrations"""
        try:
            with self.db_connection_factory() as conn:
                cursor = conn.cursor()

                cursor.execute(f"""
                    CREATE TABLE IF NOT EXISTS {self.migration_table} (
                        installed_rank INTEGER PRIMARY KEY,
                        version VARCHAR(50) NOT NULL UNIQUE,
                        description VARCHAR(200) NOT NULL,
                        type VARCHAR(20) NOT NULL DEFAULT 'SQL',
                        script VARCHAR(1000) NOT NULL,
                        checksum VARCHAR(32),
                        installed_by VARCHAR(100) DEFAULT CURRENT_USER,
                        installed_on TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                        execution_time INTEGER NOT NULL,
                        success BOOLEAN NOT NULL
                    );
                """)

                cursor.execute(f"""
                    CREATE INDEX IF NOT EXISTS idx_schema_version_success 
                    ON {self.migration_table}(success);
                """)

                cursor.close()
                logger.info(f"Schema version table '{self.migration_table}' initialized")

        except Exception as e:
            logger.error(f"Failed to initialize schema version table: {e}")
            raise

    def discover_migrations(self) -> List[Migration]:
        """
        Discover all migration files in the migrations directory.
        Expected filename format: V{version}__{description}.sql
        Example: V1.0.0__initial_schema.sql, V1.1.0__add_users_table.sql
        """
        migrations = []

        if not os.path.exists(self.migrations_dir):
            logger.warning(f"Migrations directory not found: {self.migrations_dir}")
            return migrations

        pattern = re.compile(r'^V(\d+\.\d+\.\d+)__(.+)\.sql$')

        for filename in sorted(os.listdir(self.migrations_dir)):
            match = pattern.match(filename)
            if match:
                version = match.group(1)
                description = match.group(2).replace('_', ' ')
                sql_file = os.path.join(self.migrations_dir, filename)

                migration = Migration(version, description, sql_file)
                migration.checksum = migration.calculate_checksum()
                migrations.append(migration)

        return sorted(migrations)

    def get_applied_migrations(self) -> List[Dict]:
        """Get list of already applied migrations from database"""
        try:
            with self.db_connection_factory() as conn:
                cursor = conn.cursor()

                cursor.execute(f"""
                    SELECT version, description, checksum, installed_on, success
                    FROM {self.migration_table}
                    ORDER BY installed_rank
                """)

                results = cursor.fetchall()
                cursor.close()

                return [
                    {
                        'version': row[0],
                        'description': row[1],
                        'checksum': row[2],
                        'installed_on': row[3],
                        'success': row[4]
                    }
                    for row in results
                ]

        except Exception as e:
            logger.warning(f"Could not retrieve applied migrations: {e}")
            return []

    def apply_migration(self, migration: Migration) -> bool:
        """Apply a single migration"""
        start_time = datetime.now()
        success = False

        try:
            logger.info(f"Applying migration {migration.version}: {migration.description}")

            # Read SQL file
            with open(migration.sql_file, 'r') as f:
                sql = f.read()

            # Apply migration
            with self.db_connection_factory() as conn:
                cursor = conn.cursor()

                # Execute migration SQL
                cursor.execute(sql)

                # Record migration in schema_version table
                execution_time = int((datetime.now() - start_time).total_seconds() * 1000)

                cursor.execute(f"""
                    INSERT INTO {self.migration_table} 
                    (installed_rank, version, description, type, script, checksum, 
                     installed_on, execution_time, success)
                    VALUES (
                        (SELECT COALESCE(MAX(installed_rank), 0) + 1 FROM {self.migration_table}),
                        %s, %s, 'SQL', %s, %s, CURRENT_TIMESTAMP, %s, TRUE
                    )
                """, (
                    migration.version,
                    migration.description,
                    os.path.basename(migration.sql_file),
                    migration.checksum,
                    execution_time
                ))

                cursor.close()
                success = True
                logger.info(f"✅ Migration {migration.version} applied successfully ({execution_time}ms)")

        except Exception as e:
            logger.error(f"❌ Failed to apply migration {migration.version}: {e}")

            # Record failed migration
            try:
                with self.db_connection_factory() as conn:
                    cursor = conn.cursor()
                    execution_time = int((datetime.now() - start_time).total_seconds() * 1000)

                    cursor.execute(f"""
                        INSERT INTO {self.migration_table} 
                        (installed_rank, version, description, type, script, checksum, 
                         installed_on, execution_time, success)
                        VALUES (
                            (SELECT COALESCE(MAX(installed_rank), 0) + 1 FROM {self.migration_table}),
                            %s, %s, 'SQL', %s, %s, CURRENT_TIMESTAMP, %s, FALSE
                        )
                    """, (
                        migration.version,
                        migration.description,
                        os.path.basename(migration.sql_file),
                        migration.checksum,
                        execution_time
                    ))
                    cursor.close()
            except Exception as record_error:
                logger.error(f"Failed to record migration failure: {record_error}")

            raise

        return success

    def validate_migrations(self) -> bool:
        """Validate applied migrations against current migration files"""
        applied = {m['version']: m for m in self.get_applied_migrations()}
        discovered = {m.version: m for m in self.discover_migrations()}

        valid = True

        for version, applied_migration in applied.items():
            if version not in discovered:
                logger.warning(f"⚠️  Applied migration {version} not found in migration files")
                valid = False
            else:
                discovered_migration = discovered[version]
                if applied_migration['checksum'] != discovered_migration.checksum:
                    logger.error(
                        f"❌ Checksum mismatch for migration {version}! "
                        f"Applied: {applied_migration['checksum']}, "
                        f"Current: {discovered_migration.checksum}"
                    )
                    valid = False

        return valid

    def migrate(self, target_version: Optional[str] = None, validate: bool = True) -> int:
        """
        Run pending migrations up to target version (or all if not specified)

        Args:
            target_version: Stop at this version (inclusive). None means apply all.
            validate: Whether to validate existing migrations first

        Returns:
            Number of migrations applied
        """
        logger.info("🚀 Starting database migration...")

        # Initialize schema version table if needed
        self.init_schema_version_table()

        # Validate existing migrations
        if validate and not self.validate_migrations():
            raise RuntimeError("Migration validation failed. Please resolve conflicts.")

        # Get applied and pending migrations
        applied_versions = {m['version'] for m in self.get_applied_migrations() if m['success']}
        all_migrations = self.discover_migrations()

        pending_migrations = [
            m for m in all_migrations
            if m.version not in applied_versions
        ]

        # Filter by target version if specified
        if target_version:
            pending_migrations = [
                m for m in pending_migrations
                if m._version_tuple() <= Migration(target_version, "", "")._version_tuple()
            ]

        if not pending_migrations:
            logger.info("✅ Database is up to date. No migrations to apply.")
            return 0

        logger.info(f"📋 Found {len(pending_migrations)} pending migration(s)")

        # Apply migrations
        applied_count = 0
        for migration in pending_migrations:
            try:
                self.apply_migration(migration)
                applied_count += 1
            except Exception as e:
                logger.error(f"Migration failed. Stopping at version {migration.version}")
                raise

        logger.info(f"✅ Successfully applied {applied_count} migration(s)")
        return applied_count

    def info(self) -> Dict:
        """Get migration status information"""
        applied = self.get_applied_migrations()
        discovered = self.discover_migrations()
        applied_versions = {m['version'] for m in applied if m['success']}

        pending = [m for m in discovered if m.version not in applied_versions]

        current_version = None
        if applied:
            successful = [m for m in applied if m['success']]
            if successful:
                current_version = successful[-1]['version']

        return {
            'current_version': current_version,
            'applied_count': len(applied_versions),
            'pending_count': len(pending),
            'total_migrations': len(discovered),
            'applied_migrations': applied,
            'pending_migrations': [
                {'version': m.version, 'description': m.description}
                for m in pending
            ]
        }