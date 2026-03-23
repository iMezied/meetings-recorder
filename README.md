# Meeting Recorder

Local-first meeting recording and analysis tool for macOS. Menu bar app that auto-detects Zoom/Meet/Teams calls, records audio, transcribes with speaker diarization (faster-whisper + pyannote), and generates AI summaries and sentiment analysis (Ollama). All data stays on your machine.

## How It Works

```
Electron (menu bar tray + React UI)
       │
       │  HTTP + SSE on localhost:8765
       ▼
Python FastAPI backend
       │
       ├─ sounddevice ──────────► 16kHz WAV recording
       ├─ psutil + AppleScript ─► meeting auto-detection
       ├─ faster-whisper ───────► transcription (Metal GPU)
       ├─ pyannote-audio ──────► speaker diarization
       ├─ Ollama (qwen2.5) ────► summaries + sentiment
       └─ SQLite + FTS5 ───────► storage + full-text search
```

The Electron app spawns the Python backend as a child process on launch, finds a free port, and waits for the `/health` endpoint before showing the UI. The React frontend talks to the backend over HTTP; real-time events (audio levels, transcription progress, meeting detection) stream via SSE.

## Prerequisites

| Requirement | Install |
|-------------|---------|
| macOS (Apple Silicon or Intel) | — |
| Node.js 18+ | `brew install node` |
| Python 3.11+ | `brew install python@3.11` |
| Ollama (optional, for AI analysis) | `brew install ollama && ollama pull qwen2.5` |

## Quick Start

```bash
git clone <repo-url> && cd meeting-recorder

# 1. Install everything (Node deps + Python venv + app directories)
./scripts/setup.sh

# 2. Run all three services together
npm run dev
```

That's it. `npm run dev` starts:
1. **Python backend** on `http://localhost:8765` (waits for health check)
2. **React dev server** on `http://localhost:5173` (Vite HMR)
3. **Electron app** (loads the React UI, connects to the backend)

The app appears as a menu bar icon — there's no Dock icon.

### Running Services Individually

If you need to restart just one part:

```bash
# Terminal 1 — backend
cd backend
source venv/bin/activate
python -m uvicorn app.main:app --reload --port 8765

# Terminal 2 — frontend
cd frontend
npm run dev

# Terminal 3 — electron
cd electron
npm run dev
```

## Building for Distribution

```bash
npm run build
```

This runs three steps:
1. `cd frontend && npm run build` — Vite bundles the React app to `frontend/dist/`
2. `cd electron && npm run build` — TypeScript compiles to `electron/dist/`
3. `npx electron-builder --mac` — packages everything into a `.dmg`

The Python backend is bundled inside the `.app` under `Resources/backend/`. On launch, Electron spawns `venv/bin/python -m uvicorn app.main:app` from that directory.

Output: `dist/Meeting Recorder-*.dmg`

### What Gets Bundled

```
Meeting Recorder.app/
└── Contents/
    └── Resources/
        ├── frontend/dist/     # Built React app (served via file://)
        ├── electron/dist/     # Compiled Electron main + preload
        └── backend/           # Full Python backend + venv
            ├── app/
            ├── venv/
            └── requirements.txt
```

## Setup Details

### `./scripts/setup.sh` Does the Following

1. Checks that `node` and `python3` are installed
2. Runs `npm install` in `frontend/` and `electron/`
3. Creates `backend/venv` and runs `pip install -r requirements.txt`
4. Creates `~/Library/Application Support/MeetingRecorder/{recordings,models}`

### Optional: Speaker Diarization

To get speaker labels (who said what), you need a HuggingFace token for pyannote-audio:

1. Sign up at https://huggingface.co
2. Accept the license at https://huggingface.co/pyannote/speaker-diarization-3.1
3. Create a token at https://huggingface.co/settings/tokens
4. Enter it in the app under Settings > Transcription

### Optional: System Audio Capture

To record meeting audio (not just your mic), install BlackHole:

```bash
brew install blackhole-2ch
```

Then open Audio MIDI Setup, create an Aggregate Device combining your mic + BlackHole, and select it in Settings > Audio.

## Project Structure

```
meeting-recorder/
├── frontend/          React 19 + Tailwind 4 + Zustand (Vite build)
├── electron/          Electron main process + tray (TypeScript)
├── backend/           Python FastAPI (audio, detection, ML, storage)
│   └── app/
│       ├── main.py        FastAPI app, SSE event bus
│       ├── routers/       API endpoints (recording, meetings, transcription, analysis, sync)
│       ├── services/      Business logic (audio, detector, whisper, ollama, storage, sync)
│       └── db/            SQLAlchemy + SQLite (WAL mode, FTS5)
├── scripts/
│   ├── setup.sh       Install all dependencies
│   ├── dev.sh         Start backend + frontend + Electron together
│   └── build.sh       Build and package into .dmg
└── sync/
    └── README.md      Multi-device sync setup (iCloud / NAS / Syncthing)
```

## Data Location

All app data lives in `~/Library/Application Support/MeetingRecorder/`:

```
MeetingRecorder/
├── meetings.db           SQLite database
├── settings.json         User preferences
├── device.json           Unique device ID (for sync)
├── models/               Downloaded whisper models
└── recordings/
    └── 2026-03-23/
        └── zoom-143022/
            ├── audio.wav
            ├── transcript.json
            ├── summary.json
            └── sentiment.json
```

## License

MIT
