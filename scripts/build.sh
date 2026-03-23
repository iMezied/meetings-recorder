#!/bin/bash
# Build script: builds frontend, electron, and packages the app
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "🔨 Building Meeting Recorder..."

# Build frontend
echo "Building frontend..."
cd "$PROJECT_DIR/frontend"
npm run build
cd "$PROJECT_DIR"

# Build electron
echo "Building Electron..."
cd "$PROJECT_DIR/electron"
npm run build
cd "$PROJECT_DIR"

# Package with electron-builder
echo "Packaging app..."
npx electron-builder --mac

echo "✅ Build complete! Check dist/ for the .dmg file."
