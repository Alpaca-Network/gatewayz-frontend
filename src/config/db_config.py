#!/usr/bin/env python3
"""
Database Configuration
PostgreSQL connection management for Docker-based database
"""

from typing import Optional
import logging
import os
from contextlib import contextmanager

# Conditional imports
try:
    import psycopg2
    from psycopg2 import extras, pool

    PSYCOPG2_AVAILABLE = True
except ImportError:
    PSYCOPG2_AVAILABLE = False
    psycopg2 = None
    pool = None
    extras = None
    logging.warning("psycopg2 not installed. PostgreSQL features will be unavailable.")

logger = logging.getLogger(__name__)


class DatabaseConfig:
    """PostgreSQL database configuration and connection management"""

    def __init__(self):
        # Database connection parameters
        self.db_host = os.environ.get("DB_HOST", "localhost")
        self.db_port = int(os.environ.get("DB_PORT", "5432"))
        self.db_name = os.environ.get("DB_NAME", "gatewayz_db")
        self.db_user = os.environ.get("DB_USER", "gatewayz")
        self.db_password = os.environ.get("DB_PASSWORD", "gatewayz_dev_password")

        # Connection pool settings
        self.db_min_connections = int(os.environ.get("DB_MIN_CONNECTIONS", "1"))
        self.db_max_connections = int(os.environ.get("DB_MAX_CONNECTIONS", "10"))

        # Connection pool instance (type hint is Optional[Any] when psycopg2 not available)
        self._connection_pool = None

        # Feature flag
        self.enabled = PSYCOPG2_AVAILABLE

    def get_connection_string(self) -> str:
        """Get PostgreSQL connection string"""
        return (
            f"host={self.db_host} "
            f"port={self.db_port} "
            f"dbname={self.db_name} "
            f"user={self.db_user} "
            f"password={self.db_password}"
        )

    def get_connection_dict(self) -> dict:
        """Get connection parameters as dictionary"""
        return {
            "host": self.db_host,
            "port": self.db_port,
            "database": self.db_name,
            "user": self.db_user,
            "password": self.db_password,
        }

    def get_connection_pool(self):
        """
        Get or create database connection pool.
        Uses connection pooling for better performance.

        Returns:
            psycopg2.pool.ThreadedConnectionPool instance
        """
        if not self.enabled:
            raise RuntimeError(
                "PostgreSQL support not available. "
                "Install psycopg2-binary: pip install psycopg2-binary"
            )

        if self._connection_pool is None:
            try:
                self._connection_pool = pool.ThreadedConnectionPool(
                    self.db_min_connections,
                    self.db_max_connections,
                    host=self.db_host,
                    port=self.db_port,
                    database=self.db_name,
                    user=self.db_user,
                    password=self.db_password,
                    # Connection options
                    connect_timeout=10,
                    options="-c timezone=UTC",
                )
                logger.info(
                    f"Database connection pool created: "
                    f"{self.db_host}:{self.db_port}/{self.db_name} "
                    f"(min={self.db_min_connections}, max={self.db_max_connections})"
                )
            except Exception as e:
                logger.error(f"Failed to create database connection pool: {e}")
                raise RuntimeError(f"Database connection pool creation failed: {e}") from e

        return self._connection_pool

    @contextmanager
    def get_connection(self):
        """
        Context manager for database connections.
        Automatically handles connection checkout, commit, rollback, and return.

        Usage:
            with db_config.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT * FROM users")
                results = cursor.fetchall()
                cursor.close()
        """
        if not self.enabled:
            raise RuntimeError(
                "PostgreSQL support not available. "
                "Install psycopg2-binary: pip install psycopg2-binary"
            )

        conn = None
        pool_instance = None

        try:
            # Get connection from pool
            pool_instance = self.get_connection_pool()
            conn = pool_instance.getconn()

            if conn is None:
                raise RuntimeError("Failed to get connection from pool")

            # Yield connection to caller
            yield conn

            # Commit transaction if no exception occurred
            conn.commit()

        except Exception as e:
            # Rollback on error
            if conn:
                try:
                    conn.rollback()
                    logger.warning(f"Transaction rolled back due to error: {e}")
                except Exception as rollback_error:
                    logger.error(f"Failed to rollback transaction: {rollback_error}")

            logger.error(f"Database operation failed: {e}")
            raise

        finally:
            # Return connection to pool
            if conn and pool_instance:
                try:
                    pool_instance.putconn(conn)
                except Exception as putconn_error:
                    logger.error(f"Failed to return connection to pool: {putconn_error}")

    def test_connection(self) -> bool:
        """
        Test database connectivity.
        Returns True if connection successful, False otherwise.
        """
        if not self.enabled:
            logger.warning("PostgreSQL support not available")
            return False

        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT 1 as test")
                result = cursor.fetchone()
                cursor.close()

                if result and result[0] == 1:
                    logger.info("Database connection test successful")
                    return True
                else:
                    logger.error("Database connection test failed: unexpected result")
                    return False

        except Exception as e:
            logger.error(f"Database connection test failed: {e}")
            return False

    def get_database_info(self) -> dict:
        """
        Get information about the database server.
        Returns dict with version, name, etc.
        """
        if not self.enabled:
            return {"error": "PostgreSQL support not available"}

        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()

                # Get PostgreSQL version
                cursor.execute("SELECT version();")
                version = cursor.fetchone()[0]

                # Get current database
                cursor.execute("SELECT current_database();")
                current_db = cursor.fetchone()[0]

                # Get current user
                cursor.execute("SELECT current_user;")
                current_user = cursor.fetchone()[0]

                # Get database size
                cursor.execute(
                    """
                    SELECT pg_size_pretty(pg_database_size(current_database()));
                """
                )
                db_size = cursor.fetchone()[0]

                cursor.close()

                return {
                    "version": version,
                    "database": current_db,
                    "user": current_user,
                    "size": db_size,
                    "host": self.db_host,
                    "port": self.db_port,
                }

        except Exception as e:
            logger.error(f"Failed to get database info: {e}")
            return {"error": str(e)}

    def close_all_connections(self):
        """
        Close all connections in the pool.
        Call this when shutting down the application.
        """
        if self._connection_pool:
            try:
                self._connection_pool.closeall()
                logger.info("All database connections closed")
                self._connection_pool = None
            except Exception as e:
                logger.error(f"Error closing connection pool: {e}")

    def execute_query(self, query: str, params: tuple = None, fetch_one: bool = False):
        """
        Helper method to execute a query and return results.

        Args:
            query: SQL query to execute
            params: Query parameters (optional)
            fetch_one: If True, return only first row

        Returns:
            Query results (list of tuples or single tuple if fetch_one=True)
        """
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()

                if params:
                    cursor.execute(query, params)
                else:
                    cursor.execute(query)

                if fetch_one:
                    result = cursor.fetchone()
                else:
                    result = cursor.fetchall()

                cursor.close()
                return result

        except Exception as e:
            logger.error(f"Query execution failed: {e}")
            raise

    def execute_many(self, query: str, params_list: list):
        """
        Execute a query with multiple parameter sets (batch insert/update).

        Args:
            query: SQL query with placeholders
            params_list: List of parameter tuples

        Returns:
            Number of rows affected
        """
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.executemany(query, params_list)
                row_count = cursor.rowcount
                cursor.close()
                return row_count

        except Exception as e:
            logger.error(f"Batch execution failed: {e}")
            raise


# Global database configuration instance
_db_config: Optional[DatabaseConfig] = None


def get_db_config() -> DatabaseConfig:
    """
    Get the global database configuration instance (singleton pattern).

    Returns:
        DatabaseConfig instance
    """
    global _db_config
    if _db_config is None:
        _db_config = DatabaseConfig()
    return _db_config


def get_db_connection():
    """
    Get database connection context manager.
    This is the primary function to use for database operations.

    Usage:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM users")
            results = cursor.fetchall()

    Returns:
        Context manager for database connection
    """
    config = get_db_config()
    return config.get_connection()


def test_db_connection() -> bool:
    """
    Test database connection.
    Convenience function for quick connection testing.

    Returns:
        True if connection successful, False otherwise
    """
    config = get_db_config()
    return config.test_connection()


def close_db_connections():
    """
    Close all database connections.
    Call this on application shutdown.
    """
    config = get_db_config()
    config.close_all_connections()


def is_db_available() -> bool:
    """
    Check if PostgreSQL database is available.

    Returns:
        True if psycopg2 is installed and database is configured
    """
    config = get_db_config()
    return config.enabled
