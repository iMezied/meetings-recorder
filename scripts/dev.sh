#!/bin/bash
# Development mode: starts backend, frontend, and electron concurrently
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

cleanup() {
    echo ""
    echo "Shutting down..."
    kill $BACKEND_PID 2>/dev/null || true
    kill $FRONTEND_PID 2>/dev/null || true
    exit 0
}

trap cleanup SIGINT SIGTERM

# Start Python backend
echo -e "${BLUE}Starting Python backend...${NC}"
cd "$PROJECT_DIR/backend"
if [ -d "venv" ]; then
    source venv/bin/activate
fi
python -m uvicorn app.main:app --reload --port 8765 &
BACKEND_PID=$!
cd "$PROJECT_DIR"

# Wait for backend
echo "Waiting for backend..."
for i in {1..30}; do
    if curl -s http://localhost:8765/health > /dev/null 2>&1; then
        echo -e "${GREEN}Backend ready!${NC}"
        break
    fi
    sleep 1
done

# Start React frontend dev server
echo -e "${BLUE}Starting frontend dev server...${NC}"
cd "$PROJECT_DIR/frontend"
npm run dev &
FRONTEND_PID=$!
cd "$PROJECT_DIR"

# Wait for frontend
sleep 3

# Start Electron
echo -e "${BLUE}Starting Electron...${NC}"
cd "$PROJECT_DIR/electron"
npm run dev
cd "$PROJECT_DIR"

cleanup
