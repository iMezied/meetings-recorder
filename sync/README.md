# Meeting Recorder - Sync Setup Guide

Meeting Recorder supports syncing recordings and metadata across multiple Macs. There are three sync options, each with different tradeoffs.

**Important notes before choosing:**

- Audio files are large (~115 MB per hour of recording). By default, only metadata (transcripts, summaries, speaker labels) is synced. Audio sync can be enabled per-device in settings.
- Each device maintains its own local SQLite database. Sync transfers the underlying data files, not the database itself.
- Conflict resolution uses a last-write-wins strategy based on file modification timestamps.
- Deletes are always soft deletes. A deleted recording is hidden from the UI but remains on disk until you explicitly purge it.

---

## Option A: iCloud Drive (Automatic, Zero Setup)

The simplest option. Meeting Recorder stores its data in a folder that iCloud can sync automatically.

### Setup

1. Open Meeting Recorder > Settings > Sync.
2. Enable "Sync via iCloud Drive."
3. That's it. The app moves its data directory under `~/Library/Mobile Documents/` where iCloud picks it up.

### Pros

- No extra software or configuration required.
- Works automatically in the background.
- Handles offline/online transitions gracefully.

### Cons

- Requires iCloud storage (the free 5 GB tier may not be enough if syncing audio).
- Sync speed depends on Apple's servers.
- Only works across Macs signed into the same Apple ID.

---

## Option B: Shared Network Folder (NAS / SMB)

Use a mounted network share as the sync target. Good for teams or home labs with a NAS.

### Setup

1. Mount the network share (e.g., `smb://nas.local/meetings`).
2. Open Meeting Recorder > Settings > Sync.
3. Select "Network Folder" and specify the mount path (e.g., `/Volumes/meetings`).
4. Repeat on each Mac that should participate in sync.

### Pros

- Full control over storage location and capacity.
- No cloud dependency; data stays on your network.
- Works with any SMB/NFS/AFP share.

### Cons

- The share must be mounted for sync to work.
- No automatic sync when off the local network.
- You are responsible for backups of the NAS itself.

---

## Option C: Syncthing (Peer-to-Peer)

Syncthing syncs folders directly between devices with no central server. Encrypted and open source.

### Setup

1. Install Syncthing on each Mac:
   ```
   brew install syncthing
   brew services start syncthing
   ```
2. Open the Syncthing web UI at `http://127.0.0.1:8384`.
3. Add the Meeting Recorder data directory as a shared folder:
   ```
   ~/Library/Application Support/MeetingRecorder
   ```
4. Pair each device by exchanging device IDs in the Syncthing UI.
5. In Meeting Recorder > Settings > Sync, select "External (manual)" so the app knows another tool is handling file sync.

### Pros

- No cloud account or server required.
- End-to-end encrypted transfers.
- Works across any network, including over the internet with relay servers.

### Cons

- Requires installing and running Syncthing on every device.
- Both devices must be online at the same time (or use Syncthing relay/discovery servers).
- Initial setup is more involved than the other options.

---

## Troubleshooting

- **Missing recordings on another device:** Check that sync is enabled on both devices and that the sync backend (iCloud, NAS mount, Syncthing) is running.
- **Duplicate entries after sync:** The app deduplicates by recording ID on import. If you see duplicates, open Settings > Sync > "Re-index" to rebuild the local database from synced files.
- **Large storage usage:** Disable audio sync to reduce bandwidth. Metadata-only sync typically uses less than 1 MB per recording.
