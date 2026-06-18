# QuickBeam - Product Requirements Document

## 1. Overview

**QuickBeam** is a peer-to-peer desktop file sharing application built with Electron.js that enables students to share files and folders directly between PCs **without internet, routers, or external storage devices**. The app uses WiFi Direct Legacy Hosted Network for automatic PC-to-PC connection.

---

## 2. Problem Statement

In school environments:
- Flash disks are hard to borrow and often unavailable
- Bluetooth is extremely slow (can take days for large files like movies/games)
- Internet-based solutions require connectivity that may not be available
- Windows Mobile Hotspot requires internet connection
- Students need a fast, reliable way to share notes, songs, videos, and movies

---

## 3. Solution

QuickBeam provides direct PC-to-PC file transfer using **WiFi Direct Legacy Hosted Network** - a Windows feature that creates a WiFi access point without internet. The app handles everything automatically - users just create/join rooms and transfer files.

---

## 4. Goals & Objectives

| Goal | Objective |
|------|-----------|
| Fast Transfer | Achieve WiFi Direct speeds (50-150 Mbps) |
| Easy Discovery | Auto-discover nearby PCs via room codes |
| Secure Transfer | Require room codes and file acceptance |
| No Dependencies | Work without internet, routers, or external hardware |
| User Friendly | Simple 3-step process: Create/Join Room → Select Files → Transfer |

---

## 5. Connection Method: WiFi Direct Legacy Hosted Network

### Why WiFi Direct?

| Method | No Internet? | Auto? | User Action | Works? |
|--------|-------------|-------|-------------|--------|
| Mobile Hotspot | ❌ Needs internet | ❌ Manual | Go to Settings | Limited |
| **WiFi Direct (Hosted Network)** | ✅ No internet | ✅ Automatic | None - app handles it | ✅ Best |
| WiFi Direct (Windows API) | ✅ No internet | ✅ Automatic | None | Complex |
| Ethernet Cable | ✅ No internet | ✅ Plug & play | Plug cable | If cable available |

### How WiFi Direct Works

```
┌─────────────────────────────────────────────────────────────┐
│                    WiFi Direct Flow                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  PC A (Host)                    PC B (Joiner)                │
│  ───────────                    ─────────────                │
│  1. Click "Create Room"         1. Click "Join Room"         │
│           │                              │                   │
│           v                              v                   │
│  2. App runs:                    2. Enter code from PC A     │
│     netsh wlan set hosted                   │                 │
│     network mode=allow                      v                 │
│           │                         3. App runs:              │
│           v                            netsh wlan connect    │
│  3. WiFi Direct network                     │                 │
│     created automatically                   v                 │
│           │                         4. Connected to WiFi      │
│           v                            Direct network         │
│  4. Shows room code                            │                 │
│     (SSID + Password)                          v                 │
│           │                         5. UDP discovery          │
│           v                            finds PC A             │
│  5. Waiting for other PC                     │                 │
│           │                                   v                 │
│           v                         6. Ready to transfer!     │
│  6. Ready to transfer!                                          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Technical Implementation

**Host PC (creates network):**
```bash
# Create hosted network (no internet needed)
netsh wlan set hostednetwork mode=allow ssid="QB_Laptop1_XYZ" key="qb12345"
netsh wlan start hostednetwork
```

**Joiner PC (connects to network):**
```bash
# Connect to the hosted network
netsh wlan connect name="QB_Laptop1_XYZ"
```

**Cleanup (on app exit):**
```bash
# Stop hosted network
netsh wlan stop hostednetwork
```

---

## 6. User Stories

### Host Flow
1. As a student, I want to click "Create Room" so a WiFi Direct network is created automatically
2. As a student, I want to see a room code so I can share it with the other PC
3. As a student, I want to copy the code easily so I can send it via chat/message
4. As a student, I want to see when the other PC joins so I know we're connected

### Joiner Flow
1. As a student, I want to click "Join Room" so I can connect to another PC
2. As a student, I want to enter a simple code so I can connect quickly
3. As a student, I want to see when I'm connected so I know I can transfer files

### Transfer Flow
1. As a student, I want to select files/folders so I can choose what to share
2. As a student, I want to see transfer progress so I know how long it will take
3. As a student, I want to accept/reject incoming files for security

---

## 7. Features

### 7.1 Core Features (Implemented)

| Feature | Description |
|---------|-------------|
| **WiFi Direct Connection** | Automatic PC-to-PC connection without internet |
| **Room System** | Create Room / Join Room with simple codes |
| **Device Discovery** | Auto-discover devices on WiFi Direct network |
| **File Selection** | Browse, select files, or drag & drop |
| **File Transfer** | Length-prefixed binary protocol |
| **Progress Tracking** | Real-time transfer speed and ETA |
| **Transfer History** | Persisted log of completed transfers |
| **Dark/Light Theme** | Toggle between themes |

### 7.2 Secondary Features (Implemented)

| Feature | Description |
|---------|-------------|
| **Resume Transfer** | Retry button when transfer fails |
| **Queue Management** | Queue multiple transfers (max 3 concurrent) |
| **Drag & Drop** | Drag files onto app window |
| **Notifications** | System notifications for events |
| **Connection Quality** | WiFi signal indicator |

### 7.3 Future Features (v2.0+)

| Feature | Description |
|---------|-------------|
| **Pause/Resume** | Pause active transfer and resume later |
| **Folder Recursive** | Recursively send folder contents |
| **Chat** | Text messaging during transfer |
| **Group Sharing** | Share with multiple devices at once |
| **Mobile Support** | Android/iOS companion app |

---

## 8. Technical Architecture

### 8.1 Technology Stack

| Component | Technology |
|-----------|------------|
| **Desktop Framework** | Electron.js |
| **Frontend** | HTML5, CSS3, JavaScript |
| **Backend** | Node.js (Electron main process) |
| **WiFi Direct** | Windows `netsh` commands |
| **Discovery** | UDP broadcast (port 58585) |
| **Transfer** | TCP sockets (port 58586) |
| **Storage** | electron-store for settings/history |

### 8.2 System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    QuickBeam Desktop App                     │
├─────────────────────────────────────────────────────────────┤
│  Renderer Process (UI)                                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │  Connect     │  │  Devices    │  │  Transfer Progress  │ │
│  │  (Room)      │  │    View     │  │       View          │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│  Main Process (Node.js)                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │WiFi Direct  │  │  Network    │  │   File Transfer     │ │
│  │  Manager    │  │  Discovery  │  │      Engine         │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│  Windows OS                                                 │
│  ┌─────────────────────────────────────────────────────────┐│
│  │      netsh wlan (WiFi Direct Hosted Network)            ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### 8.3 Connection Protocol

**WiFi Direct Setup:**
1. Host creates hosted network via `netsh wlan set hostednetwork`
2. Host starts network via `netsh wlan start hostednetwork`
3. Joiner connects via `netsh wlan connect`
4. Both PCs now on same subnet (192.168.x.x or 169.254.x.x)

**Device Discovery:**
1. UDP broadcast on port 58585 every 2 seconds
2. Broadcast contains: deviceId, hostname, IP, port
3. Listeners capture broadcasts and maintain peer list
4. Stale devices removed after 10 seconds

**File Transfer:**
1. Sender connects to receiver on port 58586
2. Sends TRANSFER_INIT with file metadata (length-prefixed)
3. Receiver shows accept/reject dialog
4. On accept, sender sends file chunks (length-prefixed binary)
5. Receiver writes chunks to disk
6. SHA-256 checksum verification on completion

---

## 9. File Structure

```
QuickBeam/
├── electron.js              # Main process, IPC handlers
├── preload.js               # Secure bridge to renderer
├── src/
│   ├── main/
│   │   ├── network.js       # UDP discovery & TCP pairing
│   │   ├── transfer.js      # File transfer engine
│   │   ├── storage.js       # Settings & history
│   │   ├── wifi-commands.js # netsh command wrappers
│   │   └── wifi-direct.js   # WiFi Direct manager
│   ├── renderer/
│   │   ├── index.html       # All views
│   │   ├── styles/
│   │   │   ├── main.css
│   │   │   ├── dark.css
│   │   │   └── light.css
│   │   └── scripts/
│   │       └── app.js       # Frontend logic
│   └── shared/
│       ├── constants.js
│       └── utils.js
├── QuickBeam_PRD.md
├── WIFI_CONNECTION_REPORT.md
├── PROGRESS_REPORT.md
└── package.json
```

---

## 10. Implementation Status

| Component | Status | Notes |
|-----------|--------|-------|
| WiFi Direct | ✅ Implemented | Hosted Network via netsh |
| Room System | ✅ Implemented | Create/Join with codes |
| Device Discovery | ✅ Implemented | UDP broadcast |
| Pairing System | ✅ Implemented | TCP request/accept |
| File Transfer | ✅ Implemented | Length-prefixed binary |
| Progress Tracking | ✅ Implemented | Real-time speed/ETA |
| Transfer History | ✅ Implemented | Persisted to disk |
| Dark/Light Theme | ✅ Implemented | Toggle switch |
| Drag & Drop | ✅ Implemented | File selection |
| Notifications | ✅ Implemented | System notifications |

---

## 11. Testing Checklist

- [ ] WiFi Direct creates network without internet
- [ ] Other PC can connect with room code
- [ ] Both PCs discover each other via UDP
- [ ] Pairing works over WiFi Direct
- [ ] File transfer works at good speed
- [ ] Large files (>1GB) transfer successfully
- [ ] Folders transfer recursively
- [ ] Cancel stops transfer mid-way
- [ ] Retry works after failed transfer
- [ ] Works on Windows 10
- [ ] Works on Windows 11
- [ ] Cleanup works (network stops on app close)

---

## 12. Requirements

- **OS**: Windows 10/11
- **Hardware**: WiFi adapter that supports hosted network
- **Network**: None required (WiFi Direct)
- **Internet**: None required

---

**Document Version**: 2.0  
**Last Updated**: June 18, 2026  
**Connection Method**: WiFi Direct Legacy Hosted Network
