#!/usr/bin/env bash
set -euo pipefail

echo ""
echo " Product Quality Report"
echo " ========================"
echo ""

# Check .NET
if ! command -v dotnet &> /dev/null; then
    echo "[ERROR] .NET SDK not found. Install from https://dotnet.microsoft.com/download"
    exit 1
fi

# Check Node
if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js not found. Install from https://nodejs.org"
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Install frontend deps if needed
if [ ! -d "$SCRIPT_DIR/frontend/node_modules" ]; then
    echo "Installing frontend dependencies..."
    (cd "$SCRIPT_DIR/frontend" && npm install)
fi

# Start backend in background
echo "Starting backend on http://localhost:5000 ..."
(cd "$SCRIPT_DIR/backend/src/ProductQualityReport.Api" && dotnet run) &
BACKEND_PID=$!

echo "Waiting for backend to start..."
sleep 6

# Start frontend in background
echo "Starting frontend on http://localhost:4200 ..."
(cd "$SCRIPT_DIR/frontend" && npx ng serve) &
FRONTEND_PID=$!

echo "Waiting for frontend to compile..."
sleep 15

# Open browser
echo "Opening browser..."
if [[ "$OSTYPE" == "darwin"* ]]; then
    open "http://localhost:4200"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    xdg-open "http://localhost:4200" &>/dev/null || true
fi

echo ""
echo " App is running at http://localhost:4200"
echo " Press Ctrl+C to stop."
echo ""

# Keep alive and forward signals
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM
wait $BACKEND_PID $FRONTEND_PID
