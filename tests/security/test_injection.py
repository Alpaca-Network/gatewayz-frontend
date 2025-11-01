"""
Tests for Injection Attack Prevention

Covers:
- SQL injection prevention
- XSS (Cross-Site Scripting) prevention
- Command injection prevention
- LDAP injection prevention
- Path traversal prevention
"""

import os
import pytest
from fastapi.testclient import TestClient

# Set test environment
os.environ['APP_ENV'] = 'testing'
os.environ['TESTING'] = 'true'
os.environ['SUPABASE_URL'] = 'https://test.supabase.co'
os.environ['SUPABASE_KEY'] = 'test-key'
os.environ['ENCRYPTION_KEY'] = 'test-encryption-key-32-bytes-long!'

from src.main import app


@pytest.fixture
def client():
    """FastAPI test client"""
    return TestClient(app)


class TestSQLInjectionPrevention:
    """Test SQL injection prevention in all endpoints"""

    def test_sql_injection_in_username(self, client):
        """SQL injection attempt in username parameter"""
        sql_payload = "admin' OR '1'='1"

        response = client.post('/admin/create', json={
            'username': sql_payload,
            'email': 'test@example.com',
            'auth_method': 'privy',
            'environment_tag': 'live'
        })

        # Should either reject or sanitize, not expose DB error
        assert response.status_code in [200, 400, 422, 500]
        if response.status_code == 500:
            # Should not expose SQL errors
            assert 'SQL' not in response.text
            assert 'database' not in response.text.lower()

    def test_sql_injection_in_email(self, client):
        """SQL injection attempt in email parameter"""
        sql_payload = "test@example.com'; DROP TABLE users; --"

        response = client.post('/admin/create', json={
            'username': 'testuser',
            'email': sql_payload,
            'auth_method': 'privy',
            'environment_tag': 'live'
        })

        # Should reject invalid email format
        assert response.status_code in [400, 422]

    def test_sql_injection_in_search(self, client):
        """SQL injection attempt in search parameters"""
        sql_payload = "' OR 1=1 --"

        response = client.get(f'/models?search={sql_payload}')

        # Should handle safely
        assert response.status_code in [200, 400, 422]
        if response.status_code == 200:
            # Should return empty or safe results, not expose data
            data = response.json()
            assert isinstance(data, (list, dict))

    def test_sql_injection_union_attack(self, client):
        """SQL injection UNION attack attempt"""
        union_payload = "' UNION SELECT * FROM users --"

        response = client.get(f'/models?search={union_payload}')

        assert response.status_code in [200, 400, 422]

    def test_sql_injection_in_api_key_lookup(self, client):
        """SQL injection in API key lookup"""
        sql_payload = "gw_test' OR '1'='1"

        headers = {'Authorization': f'Bearer {sql_payload}'}
        response = client.get('/users/me', headers=headers)

        # Should return unauthorized, not SQL error
        assert response.status_code in [401, 403]
        assert 'SQL' not in response.text
        assert 'database' not in response.text.lower()


class TestXSSPrevention:
    """Test XSS (Cross-Site Scripting) prevention"""

    def test_xss_in_username(self, client):
        """XSS attempt in username"""
        xss_payload = "<script>alert('XSS')</script>"

        response = client.post('/admin/create', json={
            'username': xss_payload,
            'email': 'test@example.com',
            'auth_method': 'privy',
            'environment_tag': 'live'
        })

        # Should either sanitize or reject
        assert response.status_code in [200, 400, 422]
        if response.status_code == 200:
            data = response.json()
            # Script tags should be escaped or removed
            assert '<script>' not in str(data).lower()

    def test_xss_in_chat_message(self, client):
        """XSS attempt in chat message"""
        xss_payload = "<img src=x onerror=alert('XSS')>"

        response = client.post('/v1/chat/completions', json={
            'model': 'gpt-3.5-turbo',
            'messages': [
                {'role': 'user', 'content': xss_payload}
            ]
        }, headers={'Authorization': 'Bearer gw_test_key'})

        # Should process safely
        assert response.status_code in [200, 401, 403, 422]

    def test_xss_in_json_response(self, client):
        """Verify JSON responses don't contain unescaped HTML"""
        response = client.get('/health')

        assert response.status_code == 200
        # JSON should not contain unescaped HTML
        assert '<script>' not in response.text.lower()
        assert '<img' not in response.text.lower()

    def test_xss_svg_attack(self, client):
        """XSS via SVG payload"""
        svg_payload = '<svg/onload=alert("XSS")>'

        response = client.post('/admin/create', json={
            'username': svg_payload,
            'email': 'test@example.com',
            'auth_method': 'privy',
            'environment_tag': 'live'
        })

        assert response.status_code in [200, 400, 422]


class TestCommandInjection:
    """Test command injection prevention"""

    def test_command_injection_in_model_name(self, client):
        """Command injection via model name"""
        cmd_payload = "gpt-3.5-turbo; rm -rf /"

        response = client.post('/v1/chat/completions', json={
            'model': cmd_payload,
            'messages': [{'role': 'user', 'content': 'test'}]
        }, headers={'Authorization': 'Bearer gw_test_key'})

        # Should reject or sanitize
        assert response.status_code in [400, 401, 403, 422, 404]

    def test_command_injection_backticks(self, client):
        """Command injection using backticks"""
        cmd_payload = "`whoami`"

        response = client.get(f'/models?search={cmd_payload}')

        assert response.status_code in [200, 400, 422]

    def test_command_injection_pipe(self, client):
        """Command injection using pipe operator"""
        cmd_payload = "test | cat /etc/passwd"

        response = client.get(f'/models?search={cmd_payload}')

        assert response.status_code in [200, 400, 422]


class TestPathTraversal:
    """Test path traversal prevention"""

    def test_path_traversal_in_filename(self, client):
        """Path traversal attempt in filename parameter"""
        traversal_payload = "../../../../etc/passwd"

        response = client.get(f'/file?path={traversal_payload}')

        # Should reject or return 404
        assert response.status_code in [404, 400, 422]

    def test_path_traversal_encoded(self, client):
        """Path traversal with URL encoding"""
        traversal_payload = "..%2F..%2F..%2Fetc%2Fpasswd"

        response = client.get(f'/file?path={traversal_payload}')

        assert response.status_code in [404, 400, 422]

    def test_path_traversal_windows_style(self, client):
        """Path traversal with Windows path separators"""
        traversal_payload = "..\\..\\..\\windows\\system32\\config\\sam"

        response = client.get(f'/file?path={traversal_payload}')

        assert response.status_code in [404, 400, 422]


class TestLDAPInjection:
    """Test LDAP injection prevention"""

    def test_ldap_injection_in_username(self, client):
        """LDAP injection attempt"""
        ldap_payload = "admin)(&(password=*))"

        response = client.post('/admin/create', json={
            'username': ldap_payload,
            'email': 'test@example.com',
            'auth_method': 'privy',
            'environment_tag': 'live'
        })

        assert response.status_code in [200, 400, 422]

    def test_ldap_wildcard_injection(self, client):
        """LDAP wildcard injection"""
        ldap_payload = "*)(uid=*))(|(uid=*"

        response = client.post('/admin/create', json={
            'username': ldap_payload,
            'email': 'test@example.com',
            'auth_method': 'privy',
            'environment_tag': 'live'
        })

        assert response.status_code in [200, 400, 422]


class TestHeaderInjection:
    """Test HTTP header injection prevention"""

    def test_crlf_injection_in_header(self, client):
        """CRLF injection attempt in custom header"""
        malicious_header = "test\r\nX-Injected: malicious"

        headers = {
            'X-Custom-Header': malicious_header,
            'Authorization': 'Bearer gw_test_key'
        }

        response = client.get('/health', headers=headers)

        # Should handle safely
        assert response.status_code in [200, 400]

        # Verify no injected headers in response
        assert 'X-Injected' not in response.headers


class TestJSONInjection:
    """Test JSON injection and manipulation"""

    def test_json_injection_nested_objects(self, client):
        """Attempt to inject malicious JSON structures"""
        malicious_json = {
            'model': 'gpt-3.5-turbo',
            'messages': [{'role': 'user', 'content': 'test'}],
            '__proto__': {'isAdmin': True}  # Prototype pollution attempt
        }

        response = client.post('/v1/chat/completions',
                              json=malicious_json,
                              headers={'Authorization': 'Bearer gw_test_key'})

        assert response.status_code in [200, 400, 401, 403, 422]

    def test_json_with_null_bytes(self, client):
        """JSON with null bytes"""
        response = client.post('/admin/create', json={
            'username': 'test\x00user',
            'email': 'test@example.com',
            'auth_method': 'privy',
            'environment_tag': 'live'
        })

        assert response.status_code in [200, 400, 422]


class TestInputValidation:
    """Test general input validation"""

    def test_oversized_input(self, client):
        """Reject or handle oversized inputs"""
        large_string = "A" * 1000000  # 1MB string

        response = client.post('/admin/create', json={
            'username': large_string,
            'email': 'test@example.com',
            'auth_method': 'privy',
            'environment_tag': 'live'
        })

        # Should reject or handle gracefully
        assert response.status_code in [400, 413, 422]

    def test_special_unicode_characters(self, client):
        """Handle special Unicode characters safely"""
        unicode_payload = "test\u202E\u202Duser"  # Right-to-left override

        response = client.post('/admin/create', json={
            'username': unicode_payload,
            'email': 'test@example.com',
            'auth_method': 'privy',
            'environment_tag': 'live'
        })

        assert response.status_code in [200, 400, 422]

    def test_null_character_injection(self, client):
        """Null character injection attempt"""
        null_payload = "admin\0user"

        response = client.post('/admin/create', json={
            'username': null_payload,
            'email': 'test@example.com',
            'auth_method': 'privy',
            'environment_tag': 'live'
        })

        assert response.status_code in [200, 400, 422]


class TestAPIKeyValidation:
    """Test API key validation against injection"""

    def test_api_key_format_validation(self, client):
        """Validate API key format"""
        invalid_keys = [
            "'; DROP TABLE users; --",
            "<script>alert('xss')</script>",
            "../../../etc/passwd",
            "gw_test\x00key",
            "gw_test\r\nkey"
        ]

        for invalid_key in invalid_keys:
            headers = {'Authorization': f'Bearer {invalid_key}'}
            response = client.get('/users/me', headers=headers)

            # Should reject invalid API keys
            assert response.status_code in [401, 403, 400, 422]

    def test_api_key_length_validation(self, client):
        """API key length should be validated"""
        # Too short
        short_key = "gw_123"
        headers = {'Authorization': f'Bearer {short_key}'}
        response = client.get('/users/me', headers=headers)
        assert response.status_code in [401, 403]

        # Too long
        long_key = "gw_" + "x" * 10000
        headers = {'Authorization': f'Bearer {long_key}'}
        response = client.get('/users/me', headers=headers)
        assert response.status_code in [401, 403, 413]


class TestErrorMessagesSecurity:
    """Test that error messages don't expose sensitive information"""

    def test_database_errors_not_exposed(self, client):
        """Database errors should not expose internal details"""
        response = client.post('/admin/create', json={
            'username': "' OR '1'='1",
            'email': 'invalid-email',
            'auth_method': 'invalid',
            'environment_tag': 'invalid'
        })

        error_text = response.text.lower()

        # Should not expose database details
        assert 'sql' not in error_text
        assert 'postgresql' not in error_text
        assert 'supabase' not in error_text
        assert 'table' not in error_text or response.status_code == 422
        assert 'column' not in error_text or response.status_code == 422

    def test_stack_traces_not_exposed(self, client):
        """Stack traces should not be exposed to clients"""
        # Trigger potential error
        response = client.post('/admin/create', json={
            'username': 'test',
            'email': 'test@example.com',
            'auth_method': 'privy',
            'environment_tag': 'invalid_env'
        })

        error_text = response.text.lower()

        # Should not contain stack trace information
        assert 'traceback' not in error_text
        assert 'file "' not in error_text
        assert 'line ' not in error_text or 'line-length' in error_text

    def test_file_paths_not_exposed(self, client):
        """File paths should not be exposed in errors"""
        response = client.get('/nonexistent-endpoint')

        error_text = response.text

        # Should not expose internal file paths
        assert '/src/' not in error_text
        assert '/home/' not in error_text
        assert '/var/' not in error_text
