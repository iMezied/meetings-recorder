# Meeting Recorder

A local-first, privacy-focused meeting recording and analysis tool for macOS. Runs as a menu bar app that automatically detects meetings (Zoom, Google Meet, Teams), records audio, transcribes with speaker diarization, and generates AI-powered summaries and sentiment analysis. All data stays on your device.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Electron App (React)                      │
│  Menu Bar Tray ─── Main Window (React + Tailwind)           │
│  ┌──────────┐  ┌──────────────────────────────────────────┐ │
│  │ Tray Menu │  │  Sidebar  │  Detail (4 tabs)            │ │
│  │ Record    │  │  Search   │  Transcript (timestamped)   │ │
│  │ Status    │  │  Filters  │  Summary + Action Items     │ │
│  │ Library   │  │  Meetings │  Speaker Sentiment          │ │
│  │ Settings  │  │  Preview  │  Info / Metadata            │ │
│  └──────────┘  └──────────────────────────────────────────┘ │
│                                                              │
│  IPC Bridge (Electron ↔ Python via localhost HTTP)           │
├──────────────────────────────────────────────────────────────┤
│                    Python Backend (FastAPI)                   │
│  ┌──────────────┐ ┌─────────────────┐ ┌──────────────────┐ │
│  │ Audio Capture │ │ Meeting Detector│ │ faster-whisper   │ │
│  │ sounddevice   │ │ psutil +        │ │ CTranslate2      │ │
│  │ 16kHz WAV     │ │ AppleScript     │ │ large-v3 (Arabic)│ │
│  └──────────────┘ └─────────────────┘ └──────────────────┘ │
│  ┌──────────────┐ ┌─────────────────┐ ┌──────────────────┐ │
│  │ pyannote-    │ │ Ollama Client   │ │ Storage          │ │
│  │ audio        │ │ localhost:11434 │ │ SQLite + Files   │ │
│  │ Speaker      │ │ qwen2.5         │ │ + Optional Sync  │ │
│  │ Diarization  │ │ Summary/Sentim. │ │                  │ │
│  └──────────────┘ └─────────────────┘ └──────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Desktop shell | Electron | Menu bar tray app, window management, IPC bridge |
| Frontend | React 19 + Tailwind CSS 4 | Library UI, settings panel, dark theme |
| State management | Zustand | Lightweight store, no boilerplate |
| Backend | Python FastAPI | REST API + SSE for real-time events |
| Audio capture | sounddevice + soundfile | 16kHz mono WAV recording |
| Meeting detection | psutil + AppleScript | Zoom, Teams, Google Meet auto-detection |
| Transcription | faster-whisper (CTranslate2) | 4x faster than whisper.cpp, Metal acceleration on Apple Silicon |
| Speaker diarization | pyannote-audio 3.1 | Voice-based speaker identification |
| LLM analysis | Ollama (qwen2.5) | Meeting summaries, action items, sentiment analysis |
| Database | SQLite (WAL mode) + FTS5 | Structured queries, full-text transcript search |
| Sync | File-based (iCloud / folder / Syncthing) | Optional multi-device sync |

### Project Structure

```
meeting-recorder/
├── electron/                   # Electron shell
│   └── src/
│       ├── main.ts             # Main process (tray, window, backend lifecycle)
│       ├── preload.ts          # Context bridge (IPC)
│       └── tray.ts             # Menu bar tray setup
├── frontend/                   # React app
│   └── src/
│       ├── App.tsx             # Root layout
│       ├── components/         # UI components (12 files)
│       │   ├── TopBar.tsx      # Title bar, record/monitor controls
│       │   ├── Sidebar.tsx     # Meeting list, search, filters
│       │   ├── DetailView.tsx  # Tab container
│       │   ├── TranscriptTab.tsx
│       │   ├── SummaryTab.tsx
│       │   ├── SentimentTab.tsx
│       │   ├── InfoTab.tsx
│       │   ├── SettingsView.tsx # 5-tab settings panel
│       │   └── ModelManager.tsx # Whisper model download GUI
│       ├── hooks/
│       │   ├── useBackend.ts   # HTTP + SSE client for Python API
│       │   └── useStore.ts     # Zustand global state
│       └── types/
│           └── index.ts        # TypeScript interfaces
├── backend/                    # Python FastAPI
│   └── app/
│       ├── main.py             # FastAPI app, SSE event bus, lifespan
│       ├── config.py           # Settings, device ID, persistent config
│       ├── models.py           # Pydantic schemas (camelCase JSON)
│       ├── routers/            # API endpoints
│       │   ├── recording.py    # Start/stop/status
│       │   ├── transcription.py # Transcribe, model management
│       │   ├── analysis.py     # Summary + sentiment via Ollama
│       │   ├── meetings.py     # CRUD, transcript/summary/sentiment retrieval
│       │   └── sync.py         # Multi-device sync
│       ├── services/           # Business logic
│       │   ├── audio_service.py
│       │   ├── detector_service.py
│       │   ├── transcription_service.py
│       │   ├── ollama_service.py
│       │   ├── storage_service.py
│       │   └── sync_service.py
│       └── db/
│           ├── database.py     # Async SQLAlchemy + SQLite WAL
│           └── models.py       # ORM models (UUID primary keys)
├── scripts/
│   ├── setup.sh                # Install all dependencies
│   ├── dev.sh                  # Run backend + frontend + Electron
│   └── build.sh                # Package into .app / .dmg
└── sync/
    └── README.md               # Multi-device sync setup guide
```

## Prerequisites

- **macOS** (Apple Silicon or Intel)
- **Node.js** 18+
- **Python** 3.11+
- **Ollama** (for AI analysis) — optional but recommended

## Setup

```bash
# Clone the repository
git clone <repo-url> && cd meeting-recorder

# Run the setup script (installs Node + Python dependencies, creates app directories)
./scripts/setup.sh
```

The setup script will:
1. Verify Node.js and Python are installed
2. Install frontend npm dependencies
3. Install Electron npm dependencies
4. Create a Python virtual environment and install backend packages
5. Create `~/Library/Application Support/MeetingRecorder/` directories

### Optional Setup

```bash
# Install Ollama for AI-powered summaries and sentiment analysis
brew install ollama
ollama pull qwen2.5

# Install BlackHole for system audio capture (records app audio, not just mic)
brew install blackhole-2ch
# Then create an Aggregate Device in Audio MIDI Setup combining your mic + BlackHole

# Get a HuggingFace token for speaker diarization (pyannote-audio)
# 1. Create account at https://huggingface.co
# 2. Accept the model license at https://huggingface.co/pyannote/speaker-diarization-3.1
# 3. Generate a token at https://huggingface.co/settings/tokens
# 4. Enter it in Settings > Transcription in the app
```

## Development

```bash
# Start all services (backend on :8765, frontend on :5173, then Electron)
npm run dev

# Or run each component individually:
npm run dev:backend    # Python FastAPI on http://localhost:8765
npm run dev:frontend   # React dev server on http://localhost:5173
npm run dev:electron   # Electron app (requires backend + frontend running)
```

The dev script starts the Python backend first, waits for its health check to pass, then launches the React dev server and Electron.

## Build

```bash
# Package into a macOS .dmg
npm run build
```

This builds the React frontend, compiles the Electron TypeScript, and packages everything into a distributable `.app` using electron-builder. The Python backend is bundled inside the app resources.

## Usage

### Recording

The app runs as a **menu bar icon** (no Dock icon). Click the tray icon to:

- **Start/Stop Recording** — manually control audio capture
- **Toggle Monitoring** — auto-detect meetings and start recording
- **Open Library** — browse and search all recorded meetings
- **Settings** — configure audio devices, models, sync

### Automatic Meeting Detection

When monitoring is enabled, the app polls every 3 seconds for:
- **Zoom** — detects `zoom.us` or `CptHost` processes
- **Microsoft Teams** — detects `Microsoft Teams` or `MSTeams` processes
- **Google Meet** — queries Chrome, Safari, or Arc for `meet.google.com` tabs via AppleScript

Recording starts automatically when a meeting is detected and stops ~6 seconds after the meeting ends (2-poll debounce).

### Analysis Pipeline

After recording, click **Analyze** on a meeting to run:

1. **Transcription** — faster-whisper converts audio to timestamped text segments (auto-detects language, uses large-v3 for Arabic)
2. **Speaker Diarization** — pyannote-audio identifies distinct speakers by voice fingerprint (requires HuggingFace token)
3. **Summary** — Ollama generates title, key points, action items, decisions, and open questions
4. **Sentiment** — Ollama analyzes per-speaker tone, engagement, and communication style

### Multi-Device Sync

Record on one MacBook, review on another. See [sync/README.md](sync/README.md) for setup options:

- **iCloud Drive** — zero setup, automatic sync
- **Shared folder** — NAS or SMB mount
- **Syncthing** — peer-to-peer, no cloud

Each device maintains its own SQLite database, rebuilt from synced JSON metadata. Audio files are large (~115 MB/hour) so only metadata and transcripts sync by default.

## API Reference

The Python backend exposes a REST API on `http://localhost:8765`:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/api/events` | SSE stream for real-time events |
| POST | `/api/recording/start` | Start audio recording |
| POST | `/api/recording/stop` | Stop recording |
| GET | `/api/recording/status` | Recording state, duration, audio level |
| POST | `/api/detector/start` | Start meeting monitoring |
| POST | `/api/detector/stop` | Stop monitoring |
| GET | `/api/detector/status` | Monitoring state, detected meeting |
| GET | `/api/meetings` | List meetings (`?source=zoom&search=keyword`) |
| GET | `/api/meetings/{id}` | Get meeting details |
| DELETE | `/api/meetings/{id}` | Soft-delete a meeting |
| GET | `/api/meetings/{id}/transcript` | Get transcript |
| GET | `/api/meetings/{id}/summary` | Get summary |
| GET | `/api/meetings/{id}/sentiment` | Get sentiment analysis |
| POST | `/api/transcribe/{id}` | Trigger transcription |
| POST | `/api/analyze/{id}` | Run summary + sentiment |
| GET | `/api/models` | List whisper models |
| POST | `/api/models/download` | Download a whisper model |
| GET | `/api/ollama/status` | Check Ollama availability |
| GET | `/api/settings` | Get app settings |
| PUT | `/api/settings` | Update settings |
| GET | `/api/audio/devices` | List input audio devices |
| GET | `/api/sync/status` | Sync state |
| POST | `/api/sync/push` | Push to sync directory |
| POST | `/api/sync/pull` | Pull from sync directory |
| POST | `/api/sync/configure` | Configure sync method |

## Data Storage

All data is stored locally in `~/Library/Application Support/MeetingRecorder/`:

```
MeetingRecorder/
├── meetings.db              # SQLite database (WAL mode)
├── device.json              # Unique device ID
├── settings.json            # Persistent user settings
├── models/                  # Downloaded whisper models
│   └── large-v3/            # CTranslate2 model directory
└── recordings/
    └── 2026-03-23/
        └── zoom-143022/
            ├── audio.wav        # Raw recording
            ├── transcript.json  # Timestamped segments with speakers
            ├── summary.json     # Key points, actions, decisions
            └── sentiment.json   # Per-speaker analysis
```

## License

MIT
