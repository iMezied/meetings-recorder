#!/bin/bash
# Setup script for Meeting Recorder
# Installs all dependencies for frontend, electron, and backend

set -e

echo "🎙️ Setting up Meeting Recorder..."

# Check prerequisites
echo "Checking prerequisites..."

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is required. Install via: brew install node"
    exit 1
fi
echo "✅ Node.js $(node --version)"

# Check Python 3.11+
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3.11+ is required. Install via: brew install python@3.11"
    exit 1
fi
PYTHON_VERSION=$(python3 -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
echo "✅ Python $PYTHON_VERSION"

# Check Ollama (optional)
if command -v ollama &> /dev/null; then
    echo "✅ Ollama found"
else
    echo "⚠️  Ollama not found. Install for AI analysis: brew install ollama"
fi

# Install frontend dependencies
echo ""
echo "Installing frontend dependencies..."
cd frontend
npm install
cd ..

# Install electron dependencies
echo ""
echo "Installing Electron dependencies..."
cd electron
npm install
cd ..

# Create Python virtual environment
echo ""
echo "Setting up Python backend..."
cd backend
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
deactivate
cd ..

# Create app data directory
APP_DIR="$HOME/Library/Application Support/MeetingRecorder"
mkdir -p "$APP_DIR/recordings"
mkdir -p "$APP_DIR/models"

echo ""
echo "✅ Setup complete!"
echo ""
echo "To start development:"
echo "  npm run dev"
echo ""
echo "Optional setup:"
echo "  - Install Ollama: brew install ollama && ollama pull qwen2.5"
echo "  - Install BlackHole for system audio: brew install blackhole-2ch"
echo "  - Get HuggingFace token for speaker diarization: https://huggingface.co/settings/tokens"
