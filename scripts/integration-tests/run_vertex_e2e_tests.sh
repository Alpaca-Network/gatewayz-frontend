#!/bin/bash
#
# Google Vertex AI E2E Test Runner
#
# This script helps run Google Vertex AI integration tests with proper configuration.
#
# Usage:
#   ./scripts/integration-tests/run_vertex_e2e_tests.sh [options]
#
# Options:
#   --all               Run all tests (default)
#   --models            Run model tests only
#   --streaming         Run streaming tests only
#   --direct            Run direct API tests only
#   --verbose           Enable verbose output
#   --debug             Enable debug logging
#   --help              Show this help message
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
TEST_FILE="$REPO_ROOT/tests/integration/test_google_vertex_e2e.py"

# Default options
TEST_PATTERN="TestGoogleVertexE2E"
VERBOSE=""
DEBUG=""

# Function to print colored output
print_header() {
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# Function to check prerequisites
check_prerequisites() {
    print_header "Checking Prerequisites"

    # Check if pytest is installed
    if ! command -v pytest &> /dev/null; then
        print_error "pytest not found. Please install: pip install pytest"
        exit 1
    fi
    print_success "pytest is installed"

    # Check if in repo root
    if [ ! -f "$TEST_FILE" ]; then
        print_error "Test file not found: $TEST_FILE"
        print_error "Please run this script from the repository root or scripts directory"
        exit 1
    fi
    print_success "Test file found"

    # Check for Google Vertex credentials
    if [ -z "$GOOGLE_VERTEX_CREDENTIALS_JSON" ]; then
        print_warning "GOOGLE_VERTEX_CREDENTIALS_JSON not set"
        echo ""
        echo "To run these tests, you need to set Google Vertex AI credentials:"
        echo ""
        echo "  Option 1: From file"
        echo "    export GOOGLE_VERTEX_CREDENTIALS_JSON=\$(cat path/to/credentials.json)"
        echo ""
        echo "  Option 2: Base64 encoded"
        echo "    export GOOGLE_VERTEX_CREDENTIALS_JSON=\$(cat credentials.json | base64)"
        echo ""
        echo "  Option 3: Raw JSON"
        echo "    export GOOGLE_VERTEX_CREDENTIALS_JSON='{\"type\":\"service_account\",...}'"
        echo ""
        print_error "Tests will be skipped without credentials"
        exit 1
    fi
    print_success "GOOGLE_VERTEX_CREDENTIALS_JSON is set"

    # Validate credentials format
    if echo "$GOOGLE_VERTEX_CREDENTIALS_JSON" | python3 -m json.tool &> /dev/null; then
        print_success "Credentials are valid JSON"
    elif echo "$GOOGLE_VERTEX_CREDENTIALS_JSON" | base64 -d | python3 -m json.tool &> /dev/null 2>&1; then
        print_success "Credentials are valid base64-encoded JSON"
    else
        print_warning "Could not validate credentials format"
    fi

    echo ""
}

# Function to show help
show_help() {
    cat << EOF
Google Vertex AI E2E Test Runner

Usage:
  $0 [options]

Options:
  --all               Run all tests (default)
  --models            Run model tests only
  --streaming         Run streaming tests only
  --direct            Run direct API tests only
  --credentials       Run credentials test only
  --verbose           Enable verbose output (-v -s)
  --debug             Enable debug logging (--log-cli-level=DEBUG)
  --help              Show this help message

Examples:
  # Run all tests with verbose output
  $0 --all --verbose

  # Run only model tests with debug logging
  $0 --models --debug

  # Run streaming tests
  $0 --streaming --verbose

Environment Variables:
  GOOGLE_VERTEX_CREDENTIALS_JSON  Google service account credentials (required)

For more information, see:
  tests/integration/README_VERTEX_E2E.md

EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --all)
            TEST_PATTERN="TestGoogleVertexE2E"
            shift
            ;;
        --models)
            TEST_PATTERN="TestGoogleVertexE2E::test_03_call_all_gemini_models"
            shift
            ;;
        --streaming)
            TEST_PATTERN="TestGoogleVertexE2E::test_04_verify_streaming_support"
            shift
            ;;
        --direct)
            TEST_PATTERN="TestVertexAIDirectCall"
            shift
            ;;
        --credentials)
            TEST_PATTERN="TestGoogleVertexE2E::test_01_vertex_credentials_available"
            shift
            ;;
        --verbose)
            VERBOSE="-v -s"
            shift
            ;;
        --debug)
            DEBUG="--log-cli-level=DEBUG"
            shift
            ;;
        --help)
            show_help
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Main execution
main() {
    print_header "Google Vertex AI E2E Tests"
    echo ""

    # Check prerequisites
    check_prerequisites

    # Build pytest command
    PYTEST_CMD="pytest ${TEST_FILE}::${TEST_PATTERN} ${VERBOSE} ${DEBUG}"

    print_header "Running Tests"
    print_info "Test pattern: $TEST_PATTERN"
    print_info "Command: $PYTEST_CMD"
    echo ""

    # Change to repo root
    cd "$REPO_ROOT"

    # Run tests
    if eval "$PYTEST_CMD"; then
        echo ""
        print_header "Test Results"
        print_success "All tests passed!"
        exit 0
    else
        echo ""
        print_header "Test Results"
        print_error "Some tests failed. Check output above for details."
        exit 1
    fi
}

# Run main function
main
