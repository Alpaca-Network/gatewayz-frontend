#!/bin/bash
# Stop Production Server
#
# Stops the production Next.js server started by start-production-server.sh
#
# Usage:
#   ./scripts/stop-production-server.sh

PID_FILE=".next-server.pid"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

if [ ! -f "$PID_FILE" ]; then
    echo -e "${YELLOW}⚠️  No PID file found. Server may not be running.${NC}"
    exit 0
fi

PID=$(cat "$PID_FILE")

if ps -p "$PID" > /dev/null 2>&1; then
    echo -e "${YELLOW}🛑 Stopping server (PID $PID)...${NC}"
    kill "$PID"

    # Wait for graceful shutdown
    sleep 2

    # Force kill if still running
    if ps -p "$PID" > /dev/null 2>&1; then
        echo -e "${YELLOW}   Forcing shutdown...${NC}"
        kill -9 "$PID"
    fi

    echo -e "${GREEN}✅ Server stopped${NC}"
else
    echo -e "${YELLOW}⚠️  Server not running (PID $PID not found)${NC}"
fi

rm "$PID_FILE"
