# QuickBeam

High-speed peer-to-peer file sharing for students. Share files and folders directly between PCs **without internet, routers, or flash disks** using WiFi Direct.

## Features

- **WiFi Direct Connection**: No internet or router needed - PCs connect directly
- **Easy Room System**: Create Room / Join Room with simple codes
- **Device Discovery**: Auto-discover paired devices on the network
- **Pairing System**: Secure connection with accept/reject
- **High Speed**: WiFi Direct speeds (50-150 Mbps)
- **File & Folder Transfer**: Send single files or entire folders
- **Drag & Drop**: Drag files onto the app to send
- **Dark/Light Theme**: Toggle between themes
- **Transfer History**: Track all transfers
- **Progress Tracking**: Real-time speed and ETA

## Quick Start

```bash
# Install dependencies
npm install

# Run the app
npm start

# Run in development mode
npm run dev
```

## How It Works

### Step 1: Connect Two PCs (No Internet Required)

**PC A (Host):**
1. Open QuickBeam
2. Click **"Create Room"**
3. WiFi Direct network created automatically
4. Share the room code with PC B

**PC B (Joiner):**
1. Open QuickBeam
2. Click **"Join Room"**
3. Enter the code from PC A
4. Connects automatically

### Step 2: Transfer Files
1. Both PCs auto-discover each other
2. Select files or drag & drop
3. Click Send
4. Receiver accepts → Transfer starts!

## WiFi Direct Connection

QuickBeam uses **WiFi Direct Legacy Hosted Network** - a Windows feature that creates a WiFi access point without internet:

```bash
# App runs these commands automatically (no user action needed):
netsh wlan set hostednetwork mode=allow ssid="QB_Laptop1_XYZ" key="qb12345"
netsh wlan start hostednetwork
```

**Why WiFi Direct?**
- ✅ Works without internet
- ✅ Works without router
- ✅ Fully automatic - user never leaves the app
- ✅ Fast WiFi speeds

## Project Structure

```
QuickBeam/
├── electron.js              # Main process, IPC handlers
├── preload.js               # Secure bridge to renderer
├── src/
│   ├── main/                # Backend modules
│   │   ├── network.js       # UDP device discovery & TCP pairing
│   │   ├── transfer.js      # File transfer engine (length-prefixed)
│   │   ├── storage.js       # Settings & history persistence
│   │   ├── wifi-commands.js # netsh command wrappers
│   │   └── wifi-direct.js   # WiFi Direct manager
│   ├── renderer/            # UI
│   │   ├── index.html       # Main HTML with all views
│   │   ├── styles/
│   │   │   ├── main.css     # Base styles
│   │   │   ├── dark.css     # Dark theme
│   │   │   └── light.css    # Light theme
│   │   └── scripts/
│   │       └── app.js       # Frontend logic
│   └── shared/              # Shared utilities
│       ├── constants.js     # Protocol constants
│       └── utils.js         # Helper functions
├── QuickBeam_PRD.md         # Product Requirements
├── WIFI_CONNECTION_REPORT.md # Connection methods analysis
└── package.json
```

## Network Protocol

- **WiFi Direct**: Legacy Hosted Network (no internet required)
- **Discovery**: UDP broadcast on port 58585
- **Connection**: TCP on port 58586
- **Transfer**: Length-prefixed binary protocol with SHA-256 verification

## Settings

- **Device Name**: Your PC's display name
- **Download Location**: Where received files are saved (default: Downloads/QuickBeam)
- **Port**: Network port (default: 58586)
- **Auto-Accept**: Skip confirmation for incoming transfers
- **Theme**: Dark or Light mode

## Requirements

- Windows 10/11
- WiFi adapter that supports hosted network
- No internet connection required

## Running on Two PCs

1. Connect both PCs to the same WiFi network (or use QuickBeam's WiFi Direct)
2. Run `npm start` on both PCs
3. PC A: Click "Create Room" → Note the code
4. PC B: Click "Join Room" → Enter the code
5. Transfer files!

## License

MIT
