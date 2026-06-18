# QuickBeam

High-speed peer-to-peer file sharing for students. Share files and folders directly between PCs without internet, routers, or flash disks.

## Features

- **Direct P2P Transfer**: No internet or router needed
- **Device Discovery**: Auto-scan for nearby QuickBeam users
- **Pairing System**: Secure connection with accept/reject
- **High Speed**: USB-like transfer speeds
- **Dark/Light Theme**: Toggle between themes
- **Transfer History**: Track all transfers

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

1. **Scan**: Click "Scan Devices" to find nearby PCs running QuickBeam
2. **Pair**: Send a pairing request to connect with another device
3. **Transfer**: Select files and send them at high speed

## Project Structure

```
QuickBeam/
├── electron.js              # Main process
├── preload.js               # Preload script
├── src/
│   ├── main/                # Backend modules
│   │   ├── network.js       # Device discovery & pairing
│   │   ├── transfer.js      # File transfer engine
│   │   └── storage.js       # Settings & history
│   ├── renderer/            # UI
│   │   ├── index.html
│   │   ├── styles/
│   │   └── scripts/
│   └── shared/              # Shared utilities
├── QuickBeam_PRD.md         # Product Requirements
└── package.json
```

## Network Protocol

- **Discovery**: UDP broadcast on port 58585
- **Connection**: TCP on port 58586
- **Transfer**: Chunked streaming with SHA-256 verification

## Settings

- **Device Name**: Your PC's display name
- **Download Location**: Where received files are saved
- **Port**: Network port (default: 58586)
- **Auto-Accept**: Skip confirmation for incoming transfers

## Requirements

- Windows 10/11 (primary)
- Both devices on same network (WiFi or Ethernet)

## License

MIT
