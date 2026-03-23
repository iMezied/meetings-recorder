import { Tray, Menu, nativeImage, MenuItemConstructorOptions } from 'electron';

// ── State ────────────────────────────────────────────────────────────────────

let tray: Tray | null = null;
let trayCallbacks: TrayCallbacks | null = null;
let currentState: TrayState = {
  isRecording: false,
  isMonitoring: false,
};

// ── Types ────────────────────────────────────────────────────────────────────

export interface TrayState {
  isRecording: boolean;
  isMonitoring: boolean;
}

export interface TrayCallbacks {
  onStartRecording: () => void;
  onStopRecording: () => void;
  onToggleMonitoring: (enabled: boolean) => void;
  onOpenLibrary: () => void;
  onOpenSettings: () => void;
  onQuit: () => void;
}

// ── Icon Generation ──────────────────────────────────────────────────────────

function createMicIcon(isRecording: boolean): nativeImage {
  // Create a 22x22 template image (standard macOS menu bar size)
  // Using a simple mic-shaped icon drawn as raw pixel data
  const size = 22;
  const canvas = Buffer.alloc(size * size * 4, 0); // RGBA

  function setPixel(x: number, y: number, r: number, g: number, b: number, a: number) {
    if (x >= 0 && x < size && y >= 0 && y < size) {
      const offset = (y * size + x) * 4;
      canvas[offset] = r;
      canvas[offset + 1] = g;
      canvas[offset + 2] = b;
      canvas[offset + 3] = a;
    }
  }

  function fillCircle(cx: number, cy: number, radius: number, r: number, g: number, b: number, a: number) {
    for (let y = cy - radius; y <= cy + radius; y++) {
      for (let x = cx - radius; x <= cx + radius; x++) {
        if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= radius * radius) {
          setPixel(Math.round(x), Math.round(y), r, g, b, a);
        }
      }
    }
  }

  function fillRect(x1: number, y1: number, x2: number, y2: number, r: number, g: number, b: number, a: number) {
    for (let y = y1; y <= y2; y++) {
      for (let x = x1; x <= x2; x++) {
        setPixel(x, y, r, g, b, a);
      }
    }
  }

  if (isRecording) {
    // Recording: red filled circle
    fillCircle(11, 11, 8, 255, 59, 48, 255);
    // White mic silhouette on red
    fillRect(9, 4, 13, 11, 255, 255, 255, 255);
    fillCircle(11, 5, 2, 255, 255, 255, 255);
    // Stand
    fillRect(10, 12, 12, 13, 255, 255, 255, 255);
    fillRect(9, 14, 13, 14, 255, 255, 255, 255);
  } else {
    // Normal: black template mic icon
    const c = 0; // black for template images
    const a = 255;
    // Mic head (rounded top)
    fillCircle(11, 5, 3, c, c, c, a);
    // Mic body
    fillRect(8, 5, 14, 11, c, c, c, a);
    // Rounded bottom of mic body
    fillCircle(11, 11, 3, c, c, c, a);
    // Mic cradle (arc)
    for (let angle = 0; angle <= 180; angle += 5) {
      const rad = (angle * Math.PI) / 180;
      const x = 11 + 5 * Math.cos(rad);
      const y = 11 + 5 * Math.sin(rad);
      setPixel(Math.round(x), Math.round(y), c, c, c, a);
    }
    // Stand
    fillRect(10, 16, 12, 18, c, c, c, a);
    // Base
    fillRect(8, 18, 14, 19, c, c, c, a);
  }

  const image = nativeImage.createFromBuffer(canvas, {
    width: size,
    height: size,
  });

  if (!isRecording) {
    image.setTemplateImage(true);
  }

  return image;
}

// ── Tray Management ──────────────────────────────────────────────────────────

export function createTray(callbacks: TrayCallbacks): Tray {
  trayCallbacks = callbacks;

  const icon = createMicIcon(false);
  tray = new Tray(icon);
  tray.setToolTip('Meeting Recorder');

  buildContextMenu();

  return tray;
}

function buildContextMenu(): void {
  if (!tray || !trayCallbacks) return;

  const menuTemplate: MenuItemConstructorOptions[] = [
    {
      label: currentState.isRecording ? 'Stop Recording' : 'Start Recording',
      click: () => {
        if (currentState.isRecording) {
          trayCallbacks?.onStopRecording();
        } else {
          trayCallbacks?.onStartRecording();
        }
      },
    },
    {
      label: `Monitoring: ${currentState.isMonitoring ? 'On' : 'Off'}`,
      click: () => {
        trayCallbacks?.onToggleMonitoring(!currentState.isMonitoring);
      },
    },
    { type: 'separator' },
    {
      label: 'Open Library',
      click: () => {
        trayCallbacks?.onOpenLibrary();
      },
    },
    {
      label: 'Settings',
      click: () => {
        trayCallbacks?.onOpenSettings();
      },
    },
    { type: 'separator' },
    {
      label: 'Quit Meeting Recorder',
      click: () => {
        trayCallbacks?.onQuit();
      },
    },
  ];

  const contextMenu = Menu.buildFromTemplate(menuTemplate);
  tray.setContextMenu(contextMenu);
}

export function updateTrayMenu(state: TrayState): void {
  currentState = { ...state };
  buildContextMenu();
}

export function setRecordingIcon(isRecording: boolean): void {
  if (!tray) return;
  const icon = createMicIcon(isRecording);
  tray.setImage(icon);

  if (isRecording) {
    tray.setToolTip('Meeting Recorder - Recording...');
  } else {
    tray.setToolTip('Meeting Recorder');
  }
}
