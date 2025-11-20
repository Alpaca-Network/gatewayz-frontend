"""
Comprehensive tests for src/config/db_config.py
"""
import os
import pytest
from unittest.mock import Mock, MagicMock, patch, call


class TestDatabaseConfig:
    """Test DatabaseConfig class initialization and configuration"""

    def test_default_configuration(self, monkeypatch):
        """Test default database configuration values"""
        # Clear environment variables
        for key in ["DB_HOST", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASSWORD",
                    "DB_MIN_CONNECTIONS", "DB_MAX_CONNECTIONS"]:
            monkeypatch.delenv(key, raising=False)

        from src.config.db_config import DatabaseConfig

        config = DatabaseConfig()
        assert config.db_host == "localhost"
        assert config.db_port == 5432
        assert config.db_name == "gatewayz_db"
        assert config.db_user == "gatewayz"
        assert config.db_password == "gatewayz_dev_password"
        assert config.db_min_connections == 1
        assert config.db_max_connections == 10

    def test_custom_configuration(self, monkeypatch):
        """Test custom database configuration from environment"""
        monkeypatch.setenv("DB_HOST", "db.example.com")
        monkeypatch.setenv("DB_PORT", "5433")
        monkeypatch.setenv("DB_NAME", "custom_db")
        monkeypatch.setenv("DB_USER", "custom_user")
        monkeypatch.setenv("DB_PASSWORD", "custom_password")
        monkeypatch.setenv("DB_MIN_CONNECTIONS", "2")
        monkeypatch.setenv("DB_MAX_CONNECTIONS", "20")

        # Reload module to pick up new env vars
        import importlib
        import src.config.db_config as db_config_mod
        importlib.reload(db_config_mod)

        config = db_config_mod.DatabaseConfig()
        assert config.db_host == "db.example.com"
        assert config.db_port == 5433
        assert config.db_name == "custom_db"
        assert config.db_user == "custom_user"
        assert config.db_password == "custom_password"
        assert config.db_min_connections == 2
        assert config.db_max_connections == 20

    def test_psycopg2_not_available(self, monkeypatch):
        """Test configuration when psycopg2 is not installed"""
        # Import after setting up the monkeypatch
        import importlib
        import src.config.db_config as db_config_mod

        # Force PSYCOPG2_AVAILABLE to False
        monkeypatch.setattr(db_config_mod, "PSYCOPG2_AVAILABLE", False)

        config = db_config_mod.DatabaseConfig()
        assert config.enabled is False

    def test_get_connection_string(self):
        """Test connection string generation"""
        from src.config.db_config import DatabaseConfig

        config = DatabaseConfig()
        conn_str = config.get_connection_string()

        assert "host=localhost" in conn_str
        assert "port=5432" in conn_str
        assert "dbname=gatewayz_db" in conn_str
        assert "user=gatewayz" in conn_str
        assert "password=gatewayz_dev_password" in conn_str

    def test_get_connection_dict(self):
        """Test connection dictionary generation"""
        from src.config.db_config import DatabaseConfig

        config = DatabaseConfig()
        conn_dict = config.get_connection_dict()

        assert conn_dict["host"] == "localhost"
        assert conn_dict["port"] == 5432
        assert conn_dict["database"] == "gatewayz_db"
        assert conn_dict["user"] == "gatewayz"
        assert conn_dict["password"] == "gatewayz_dev_password"


class TestConnectionPool:
    """Test connection pool management"""

    @patch('src.config.db_config.PSYCOPG2_AVAILABLE', True)
    @patch('src.config.db_config.pool')
    def test_get_connection_pool_success(self, mock_pool):
        """Test successful connection pool creation"""
        from src.config.db_config import DatabaseConfig

        mock_pool_instance = Mock()
        mock_pool.ThreadedConnectionPool = Mock(return_value=mock_pool_instance)

        config = DatabaseConfig()
        pool = config.get_connection_pool()

        assert pool == mock_pool_instance
        assert config._connection_pool == mock_pool_instance
        mock_pool.ThreadedConnectionPool.assert_called_once()

    @patch('src.config.db_config.PSYCOPG2_AVAILABLE', True)
    @patch('src.config.db_config.pool')
    def test_get_connection_pool_reuses_existing(self, mock_pool):
        """Test connection pool reuse"""
        from src.config.db_config import DatabaseConfig

        mock_pool_instance = Mock()
        mock_pool.ThreadedConnectionPool = Mock(return_value=mock_pool_instance)

        config = DatabaseConfig()
        pool1 = config.get_connection_pool()
        pool2 = config.get_connection_pool()

        assert pool1 == pool2
        # Should only be called once
        assert mock_pool.ThreadedConnectionPool.call_count == 1

    @patch('src.config.db_config.PSYCOPG2_AVAILABLE', False)
    def test_get_connection_pool_not_available(self):
        """Test connection pool when psycopg2 not available"""
        from src.config.db_config import DatabaseConfig

        config = DatabaseConfig()

        with pytest.raises(RuntimeError, match="PostgreSQL support not available"):
            config.get_connection_pool()

    @patch('src.config.db_config.PSYCOPG2_AVAILABLE', True)
    @patch('src.config.db_config.pool')
    def test_get_connection_pool_failure(self, mock_pool):
        """Test connection pool creation failure"""
        from src.config.db_config import DatabaseConfig

        mock_pool.ThreadedConnectionPool = Mock(side_effect=Exception("Connection failed"))

        config = DatabaseConfig()

        with pytest.raises(RuntimeError, match="Database connection pool creation failed"):
            config.get_connection_pool()

    @patch('src.config.db_config.PSYCOPG2_AVAILABLE', True)
    @patch('src.config.db_config.pool')
    def test_close_all_connections(self, mock_pool):
        """Test closing all connections in pool"""
        from src.config.db_config import DatabaseConfig

        mock_pool_instance = Mock()
        mock_pool.ThreadedConnectionPool = Mock(return_value=mock_pool_instance)

        config = DatabaseConfig()
        config.get_connection_pool()
        config.close_all_connections()

        mock_pool_instance.closeall.assert_called_once()
        assert config._connection_pool is None

    @patch('src.config.db_config.PSYCOPG2_AVAILABLE', True)
    def test_close_all_connections_when_none(self):
        """Test closing connections when pool is None"""
        from src.config.db_config import DatabaseConfig

        config = DatabaseConfig()
        config._connection_pool = None
        config.close_all_connections()  # Should not raise

    @patch('src.config.db_config.PSYCOPG2_AVAILABLE', True)
    @patch('src.config.db_config.pool')
    def test_close_all_connections_error(self, mock_pool):
        """Test error handling when closing connections"""
        from src.config.db_config import DatabaseConfig

        mock_pool_instance = Mock()
        mock_pool_instance.closeall = Mock(side_effect=Exception("Close failed"))
        mock_pool.ThreadedConnectionPool = Mock(return_value=mock_pool_instance)

        config = DatabaseConfig()
        config.get_connection_pool()
        config.close_all_connections()  # Should not raise


class TestConnectionContextManager:
    """Test get_connection context manager"""

    @patch('src.config.db_config.PSYCOPG2_AVAILABLE', False)
    def test_get_connection_not_available(self):
        """Test get_connection when psycopg2 not available"""
        from src.config.db_config import DatabaseConfig

        config = DatabaseConfig()

        with pytest.raises(RuntimeError, match="PostgreSQL support not available"):
            with config.get_connection():
                pass

    @patch('src.config.db_config.PSYCOPG2_AVAILABLE', True)
    @patch('src.config.db_config.pool')
    def test_get_connection_success(self, mock_pool):
        """Test successful connection retrieval"""
        from src.config.db_config import DatabaseConfig

        mock_conn = Mock()
        mock_pool_instance = Mock()
        mock_pool_instance.getconn = Mock(return_value=mock_conn)
        mock_pool_instance.putconn = Mock()
        mock_pool.ThreadedConnectionPool = Mock(return_value=mock_pool_instance)

        config = DatabaseConfig()

        with config.get_connection() as conn:
            assert conn == mock_conn

        mock_conn.commit.assert_called_once()
        mock_pool_instance.putconn.assert_called_once_with(mock_conn)

    @patch('src.config.db_config.PSYCOPG2_AVAILABLE', True)
    @patch('src.config.db_config.pool')
    def test_get_connection_getconn_returns_none(self, mock_pool):
        """Test when getconn returns None"""
        from src.config.db_config import DatabaseConfig

        mock_pool_instance = Mock()
        mock_pool_instance.getconn = Mock(return_value=None)
        mock_pool.ThreadedConnectionPool = Mock(return_value=mock_pool_instance)

        config = DatabaseConfig()

        with pytest.raises(RuntimeError, match="Failed to get connection from pool"):
            with config.get_connection():
                pass

    @patch('src.config.db_config.PSYCOPG2_AVAILABLE', True)
    @patch('src.config.db_config.pool')
    def test_get_connection_with_exception(self, mock_pool):
        """Test connection rollback on exception"""
        from src.config.db_config import DatabaseConfig

        mock_conn = Mock()
        mock_pool_instance = Mock()
        mock_pool_instance.getconn = Mock(return_value=mock_conn)
        mock_pool_instance.putconn = Mock()
        mock_pool.ThreadedConnectionPool = Mock(return_value=mock_pool_instance)

        config = DatabaseConfig()

        with pytest.raises(ValueError):
            with config.get_connection() as conn:
                raise ValueError("Test error")

        mock_conn.rollback.assert_called_once()
        mock_pool_instance.putconn.assert_called_once_with(mock_conn)

    @patch('src.config.db_config.PSYCOPG2_AVAILABLE', True)
    @patch('src.config.db_config.pool')
    def test_get_connection_rollback_fails(self, mock_pool):
        """Test when rollback itself fails"""
        from src.config.db_config import DatabaseConfig

        mock_conn = Mock()
        mock_conn.rollback = Mock(side_effect=Exception("Rollback failed"))
        mock_pool_instance = Mock()
        mock_pool_instance.getconn = Mock(return_value=mock_conn)
        mock_pool_instance.putconn = Mock()
        mock_pool.ThreadedConnectionPool = Mock(return_value=mock_pool_instance)

        config = DatabaseConfig()

        with pytest.raises(ValueError):
            with config.get_connection() as conn:
                raise ValueError("Test error")

    @patch('src.config.db_config.PSYCOPG2_AVAILABLE', True)
    @patch('src.config.db_config.pool')
    def test_get_connection_putconn_fails(self, mock_pool):
        """Test when putconn fails"""
        from src.config.db_config import DatabaseConfig

        mock_conn = Mock()
        mock_pool_instance = Mock()
        mock_pool_instance.getconn = Mock(return_value=mock_conn)
        mock_pool_instance.putconn = Mock(side_effect=Exception("Putconn failed"))
        mock_pool.ThreadedConnectionPool = Mock(return_value=mock_pool_instance)

        config = DatabaseConfig()

        # Should not raise even if putconn fails
        with config.get_connection() as conn:
            pass


class TestDatabaseOperations:
    """Test database operation methods"""

    @patch('src.config.db_config.PSYCOPG2_AVAILABLE', False)
    def test_test_connection_not_available(self):
        """Test test_connection when psycopg2 not available"""
        from src.config.db_config import DatabaseConfig

        config = DatabaseConfig()
        result = config.test_connection()

        assert result is False

    @patch('src.config.db_config.PSYCOPG2_AVAILABLE', True)
    @patch('src.config.db_config.pool')
    def test_test_connection_success(self, mock_pool):
        """Test successful connection test"""
        from src.config.db_config import DatabaseConfig

        mock_cursor = Mock()
        mock_cursor.fetchone = Mock(return_value=(1,))
        mock_conn = Mock()
        mock_conn.cursor = Mock(return_value=mock_cursor)
        mock_pool_instance = Mock()
        mock_pool_instance.getconn = Mock(return_value=mock_conn)
        mock_pool_instance.putconn = Mock()
        mock_pool.ThreadedConnectionPool = Mock(return_value=mock_pool_instance)

        config = DatabaseConfig()
        result = config.test_connection()

        assert result is True

    @patch('src.config.db_config.PSYCOPG2_AVAILABLE', True)
    @patch('src.config.db_config.pool')
    def test_test_connection_failure(self, mock_pool):
        """Test failed connection test"""
        from src.config.db_config import DatabaseConfig

        mock_pool_instance = Mock()
        mock_pool_instance.getconn = Mock(side_effect=Exception("Connection failed"))
        mock_pool.ThreadedConnectionPool = Mock(return_value=mock_pool_instance)

        config = DatabaseConfig()
        result = config.test_connection()

        assert result is False

    @patch('src.config.db_config.PSYCOPG2_AVAILABLE', False)
    def test_get_database_info_not_available(self):
        """Test get_database_info when psycopg2 not available"""
        from src.config.db_config import DatabaseConfig

        config = DatabaseConfig()
        result = config.get_database_info()

        assert "error" in result
        assert result["error"] == "PostgreSQL support not available"

    @patch('src.config.db_config.PSYCOPG2_AVAILABLE', True)
    @patch('src.config.db_config.pool')
    def test_get_database_info_success(self, mock_pool):
        """Test successful database info retrieval"""
        from src.config.db_config import DatabaseConfig

        mock_cursor = Mock()
        mock_cursor.fetchone = Mock(side_effect=[
            ("PostgreSQL 14.0",),
            ("gatewayz_db",),
            ("gatewayz",),
            ("10 MB",),
        ])
        mock_conn = Mock()
        mock_conn.cursor = Mock(return_value=mock_cursor)
        mock_pool_instance = Mock()
        mock_pool_instance.getconn = Mock(return_value=mock_conn)
        mock_pool_instance.putconn = Mock()
        mock_pool.ThreadedConnectionPool = Mock(return_value=mock_pool_instance)

        config = DatabaseConfig()
        result = config.get_database_info()

        assert result["version"] == "PostgreSQL 14.0"
        assert result["database"] == "gatewayz_db"
        assert result["user"] == "gatewayz"
        assert result["size"] == "10 MB"

    @patch('src.config.db_config.PSYCOPG2_AVAILABLE', True)
    @patch('src.config.db_config.pool')
    def test_execute_query_success(self, mock_pool):
        """Test successful query execution"""
        from src.config.db_config import DatabaseConfig

        mock_cursor = Mock()
        mock_cursor.fetchall = Mock(return_value=[(1, "test"), (2, "data")])
        mock_conn = Mock()
        mock_conn.cursor = Mock(return_value=mock_cursor)
        mock_pool_instance = Mock()
        mock_pool_instance.getconn = Mock(return_value=mock_conn)
        mock_pool_instance.putconn = Mock()
        mock_pool.ThreadedConnectionPool = Mock(return_value=mock_pool_instance)

        config = DatabaseConfig()
        result = config.execute_query("SELECT * FROM users")

        assert result == [(1, "test"), (2, "data")]

    @patch('src.config.db_config.PSYCOPG2_AVAILABLE', True)
    @patch('src.config.db_config.pool')
    def test_execute_query_with_params(self, mock_pool):
        """Test query execution with parameters"""
        from src.config.db_config import DatabaseConfig

        mock_cursor = Mock()
        mock_cursor.fetchall = Mock(return_value=[(1, "test")])
        mock_conn = Mock()
        mock_conn.cursor = Mock(return_value=mock_cursor)
        mock_pool_instance = Mock()
        mock_pool_instance.getconn = Mock(return_value=mock_conn)
        mock_pool_instance.putconn = Mock()
        mock_pool.ThreadedConnectionPool = Mock(return_value=mock_pool_instance)

        config = DatabaseConfig()
        result = config.execute_query("SELECT * FROM users WHERE id = %s", (1,))

        assert result == [(1, "test")]
        mock_cursor.execute.assert_called_with("SELECT * FROM users WHERE id = %s", (1,))

    @patch('src.config.db_config.PSYCOPG2_AVAILABLE', True)
    @patch('src.config.db_config.pool')
    def test_execute_query_fetch_one(self, mock_pool):
        """Test query execution with fetch_one=True"""
        from src.config.db_config import DatabaseConfig

        mock_cursor = Mock()
        mock_cursor.fetchone = Mock(return_value=(1, "test"))
        mock_conn = Mock()
        mock_conn.cursor = Mock(return_value=mock_cursor)
        mock_pool_instance = Mock()
        mock_pool_instance.getconn = Mock(return_value=mock_conn)
        mock_pool_instance.putconn = Mock()
        mock_pool.ThreadedConnectionPool = Mock(return_value=mock_pool_instance)

        config = DatabaseConfig()
        result = config.execute_query("SELECT * FROM users LIMIT 1", fetch_one=True)

        assert result == (1, "test")

    @patch('src.config.db_config.PSYCOPG2_AVAILABLE', True)
    @patch('src.config.db_config.pool')
    def test_execute_many_success(self, mock_pool):
        """Test batch execution success"""
        from src.config.db_config import DatabaseConfig

        mock_cursor = Mock()
        mock_cursor.rowcount = 3
        mock_conn = Mock()
        mock_conn.cursor = Mock(return_value=mock_cursor)
        mock_pool_instance = Mock()
        mock_pool_instance.getconn = Mock(return_value=mock_conn)
        mock_pool_instance.putconn = Mock()
        mock_pool.ThreadedConnectionPool = Mock(return_value=mock_pool_instance)

        config = DatabaseConfig()
        params_list = [(1, "a"), (2, "b"), (3, "c")]
        result = config.execute_many("INSERT INTO test VALUES (%s, %s)", params_list)

        assert result == 3


class TestGlobalFunctions:
    """Test global helper functions"""

    def test_get_db_config_singleton(self):
        """Test get_db_config returns singleton"""
        from src.config import db_config

        # Reset global
        db_config._db_config = None

        config1 = db_config.get_db_config()
        config2 = db_config.get_db_config()

        assert config1 is config2

    @patch('src.config.db_config.PSYCOPG2_AVAILABLE', True)
    @patch('src.config.db_config.pool')
    def test_get_db_connection(self, mock_pool):
        """Test get_db_connection helper"""
        from src.config import db_config

        mock_conn = Mock()
        mock_pool_instance = Mock()
        mock_pool_instance.getconn = Mock(return_value=mock_conn)
        mock_pool_instance.putconn = Mock()
        mock_pool.ThreadedConnectionPool = Mock(return_value=mock_pool_instance)

        # Reset global
        db_config._db_config = None

        with db_config.get_db_connection() as conn:
            assert conn == mock_conn

    @patch('src.config.db_config.PSYCOPG2_AVAILABLE', True)
    @patch('src.config.db_config.pool')
    def test_test_db_connection(self, mock_pool):
        """Test test_db_connection helper"""
        from src.config import db_config

        mock_cursor = Mock()
        mock_cursor.fetchone = Mock(return_value=(1,))
        mock_conn = Mock()
        mock_conn.cursor = Mock(return_value=mock_cursor)
        mock_pool_instance = Mock()
        mock_pool_instance.getconn = Mock(return_value=mock_conn)
        mock_pool_instance.putconn = Mock()
        mock_pool.ThreadedConnectionPool = Mock(return_value=mock_pool_instance)

        # Reset global
        db_config._db_config = None

        result = db_config.test_db_connection()
        assert result is True

    def test_close_db_connections(self):
        """Test close_db_connections helper"""
        from src.config import db_config

        # Reset global
        db_config._db_config = None

        # Should not raise
        db_config.close_db_connections()

    def test_is_db_available(self):
        """Test is_db_available helper"""
        from src.config import db_config

        # Reset global
        db_config._db_config = None

        result = db_config.is_db_available()
        # Result depends on whether psycopg2 is installed
        assert isinstance(result, bool)
