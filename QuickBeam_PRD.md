# QuickBeam - Product Requirements Document

## 1. Overview

**QuickBeam** is a peer-to-peer desktop file sharing application built with Electron.js that enables students to share files and folders directly between PCs without requiring internet, routers, or external storage devices. The app provides high-speed transfer comparable to USB drive speeds.

---

## 2. Problem Statement

In school environments:
- Flash disks are hard to borrow and often unavailable
- Bluetooth is extremely slow (can take days for large files like movies/games)
- Internet-based solutions require connectivity that may not be available
- Students need a fast, reliable way to share notes, songs, videos, and movies

---

## 3. Solution

QuickBeam provides direct PC-to-PC file transfer over local network connections (WiFi Direct or Ethernet), achieving speeds comparable to or faster than USB transfers. No intermediate devices required.

---

## 4. Goals & Objectives

| Goal | Objective |
|------|-----------|
| Fast Transfer | Achieve transfer speeds ≥ USB 3.0 (5 Gbps theoretical, ~400 MB/s practical) |
| Easy Discovery | Auto-discover nearby PCs running QuickBeam |
| Secure Transfer | Require explicit pairing and file acceptance |
| No Dependencies | Work without internet, routers, or external hardware |
| User Friendly | Simple 3-step process: Scan → Pair → Transfer |

---

## 5. User Stories

### Sender Flow
1. As a student, I want to scan for nearby PCs so I can find who to share with
2. As a student, I want to send a pairing request so the receiver knows I want to connect
3. As a student, I want to select files/folders from my PC so I can choose what to share
4. As a student, I want to see transfer progress so I know how long it will take

### Receiver Flow
1. As a student, I want to see incoming pairing requests so I can accept or reject
2. As a student, I want to see incoming file requests so I can accept or reject files
3. As a student, I want to see where files will be saved so I can organize them
4. As a student, I want to see transfer progress so I know when it's complete

---

## 6. Features

### 6.1 Core Features (MVP)

| Feature | Description |
|---------|-------------|
| **Device Discovery** | Auto-scan local network for QuickBeam instances |
| **Pairing System** | Request/accept/reject pairing between devices |
| **File Selection** | Browse and select individual files or entire folders |
| **File Transfer** | High-speed peer-to-peer data transfer |
| **Progress Tracking** | Real-time transfer progress with speed and ETA |
| **Transfer History** | Log of completed transfers |

### 6.2 Secondary Features (v1.1+)

| Feature | Description |
|---------|-------------|
| **Resume Transfer** | Resume interrupted transfers |
| **Queue Management** | Queue multiple transfers |
| **Drag & Drop** | Drag files onto app to send |
| **Notifications** | System notifications for events |
| **Dark/Light Theme** | Toggle between themes (inspired by UI references) |
| **Connection Quality** | Display signal/connection strength |

### 6.3 Future Features (v2.0+)

| Feature | Description |
|---------|-------------|
| **Chat** | Text messaging during transfer |
| **Group Sharing** | Share with multiple devices at once |
| **Clipboard Sync** | Copy/paste between connected devices |
| **Mobile Support** | Android/iOS companion app |

---

## 7. Technical Architecture

### 7.1 Technology Stack

| Component | Technology |
|-----------|------------|
| **Desktop Framework** | Electron.js |
| **Frontend** | HTML5, CSS3, JavaScript |
| **Backend** | Node.js (Electron main process) |
| **Network Discovery** | mDNS/DNS-SD (Bonjour) or UDP broadcast |
| **Data Transfer** | Raw TCP sockets or WebRTC data channels |
| **File System** | Node.js fs module |
| **IPC** | Electron IPC for renderer↔main communication |

### 7.2 System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    QuickBeam Desktop App                     │
├─────────────────────────────────────────────────────────────┤
│  Renderer Process (UI)                                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │  Discovery   │  │   Pairing   │  │  Transfer Progress  │ │
│  │    View      │  │    View     │  │       View          │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│  Main Process (Node.js)                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │  Network     │  │  Pairing    │  │   File Transfer     │ │
│  │  Discovery   │  │  Manager    │  │      Engine         │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│  Operating System                                           │
│  ┌─────────────────────────────────────────────────────────┐│
│  │         Network Interface (WiFi/Ethernet)               ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### 7.3 Connection Method

**Primary: TCP/IP over Local Network**
- Both devices must be on same network (WiFi or Ethernet)
- Use TCP sockets for reliable, ordered data transfer
- Direct connection without router (ad-hoc mode supported)

**Discovery Protocol:**
1. UDP broadcast on port `58585` for device announcement
2. Each device broadcasts its hostname and IP periodically
3. Listeners capture broadcasts and maintain peer list

**Transfer Protocol:**
1. Sender initiates TCP connection to receiver on port `58586`
2. Metadata (file names, sizes, checksums) sent first
3. Receiver confirms acceptance
4. Binary data streamed in chunks (64KB default)
5. Checksum verification on completion

---

## 8. UI/UX Design

### 8.1 Design Principles (from UI Inspiration)

- **Dark/Light Theme**: Toggle support (ui1.png = dark, ui2.png = light)
- **Clean Minimalist Layout**: Sidebar navigation, focused content area
- **Typography**: Clear, readable fonts with proper hierarchy
- **Color Palette**: 
  - Dark theme: #1E1E1E background, #FFFFFF text, #F5C542 accent (gold)
  - Light theme: #F5F5F0 background, #1E1E1E text, same gold accent
- **Spacing**: Generous padding, breathable layout

### 8.2 Screen Layout

```
┌────────────────────────────────────────────────────────────┐
│  ☰ QuickBeam                              🌙 [Theme] ─ □ X│
├──────────────┬─────────────────────────────────────────────┤
│              │                                             │
│   QUICKBEAM  │   [Main Content Area]                       │
│              │                                             │
│  ┌────────┐  │   DISCOVER VIEW:                            │
│  │  LOGO  │  │   ┌─────────────────────────────────────┐  │
│  └────────┘  │   │  Scanning for nearby devices...      │  │
│              │   │  ● ● ● (animation)                    │  │
│  STATS       │   └─────────────────────────────────────┘  │
│  ─────────   │                                             │
│  Sent: 12    │   ┌─────────────────────────────────────┐  │
│  Received: 8 │   │  DEVICES FOUND                       │  │
│              │   │  ┌─────────────────────────────────┐ │  │
│  ─────────   │   │  │ 💻 LAPTOP-ABC      [Connect]    │ │  │
│              │   │  │ 💻 DESKTOP-XYZ     [Connect]    │ │  │
│  QUICK       │   │  │ 💻 STUDENT-PC      [Connect]    │ │  │
│  ACTIONS     │   │  └─────────────────────────────────┘ │  │
│  ─────────   │   └─────────────────────────────────────┘  │
│  [Scan]      │                                             │
│  [History]   │   PAIRING VIEW:                             │
│  [Settings]  │   ┌─────────────────────────────────────┐  │
│              │   │  📱 Pairing Request from USER-123    │  │
│              │   │                                     │  │
│              │   │     [Accept]        [Reject]        │  │
│              │   └─────────────────────────────────────┘  │
│              │                                             │
│              │   TRANSFER VIEW:                            │
│              │   ┌─────────────────────────────────────┐  │
│              │   │  Sending: movie.mp4 (1.2 GB)        │  │
│              │   │  ████████████░░░░░░░░  65%           │  │
│              │   │  Speed: 125 MB/s | ETA: 4s           │  │
│              │   └─────────────────────────────────────┘  │
│              │                                             │
└──────────────┴─────────────────────────────────────────────┘
```

### 8.3 Screens

| Screen | Purpose |
|--------|---------|
| **Discovery** | Show scan button, list discovered devices |
| **Pairing Request** | Accept/reject incoming connection |
| **File Selector** | Browse and select files/folders to send |
| **Transfer Progress** | Show active transfer with progress bar |
| **Settings** | App preferences, download location, themes |
| **History** | Past transfers log |

---

## 9. Data Models

### 9.1 Device
```json
{
  "id": "uuid",
  "hostname": "STUDENT-LAPTOP",
  "ip": "192.168.1.105",
  "mac": "AA:BB:CC:DD:EE:FF",
  "port": 58586,
  "status": "available|paired|transferring",
  "lastSeen": "2026-06-17T10:30:00Z"
}
```

### 9.2 Transfer
```json
{
  "id": "uuid",
  "type": "send|receive",
  "peerId": "device-uuid",
  "files": [
    {
      "name": "movie.mp4",
      "size": 1288490188,
      "path": "/path/to/file",
      "checksum": "sha256-hash"
    }
  ],
  "totalSize": 1288490188,
  "bytesTransferred": 837518622,
  "status": "pending|active|completed|failed|cancelled",
  "speed": 131072000,
  "startTime": "2026-06-17T10:30:00Z",
  "endTime": null
}
```

### 9.3 AppSettings
```json
{
  "hostname": "My Laptop",
  "downloadPath": "C:\\Users\\...\\Downloads\\QuickBeam",
  "theme": "dark",
  "port": 58586,
  "autoAccept": false,
  "maxConcurrentTransfers": 3
}
```

---

## 10. Network Protocol

### 10.1 Discovery Protocol
```
Port: 58585 (UDP Broadcast)

Broadcast Message:
{
  "type": "announce",
  "appId": "quickbeam",
  "version": "1.0.0",
  "hostname": "STUDENT-LAPTOP",
  "ip": "192.168.1.105",
  "port": 58586,
  "timestamp": 1687001400
}
```

### 10.2 Pairing Protocol
```
Port: 58586 (TCP)

1. Sender → Receiver: PAIR_REQUEST { senderHostname, senderIp }
2. Receiver → Sender: PAIR_ACCEPT | PAIR_REJECT
3. Connection established
```

### 10.3 Transfer Protocol
```
1. Sender → Receiver: TRANSFER_INIT { files: [{ name, size, checksum }] }
2. Receiver → Sender: TRANSFER_ACCEPT | TRANSFER_REJECT
3. Sender → Receiver: FILE_DATA { chunk } (64KB chunks)
4. Receiver → Sender: FILE_ACK { bytesReceived }
5. Repeat 3-4 until complete
6. Receiver → Sender: TRANSFER_COMPLETE { checksums }
```

---

## 11. Security Considerations

| Concern | Mitigation |
|---------|------------|
| **Unauthorized Access** | Pairing required before transfer |
| **Malicious Files** | User must explicitly accept incoming files |
| **Data Integrity** | SHA-256 checksums verified after transfer |
| **Privacy** | No data leaves local network |
| **File Overwrite** | Check for existing files, prompt user |

---

## 12. Performance Requirements

| Metric | Target |
|--------|--------|
| **Transfer Speed** | ≥ 100 MB/s (WiFi), ≥ 500 MB/s (Ethernet) |
| **Discovery Time** | < 5 seconds to find nearby devices |
| **Connection Time** | < 2 seconds to establish pairing |
| **Memory Usage** | < 200 MB RAM |
| **CPU Usage** | < 30% during transfer |
| **Max File Size** | No limit (limited by disk space) |

---

## 13. Platform Support

| Platform | Status | Notes |
|----------|--------|-------|
| **Windows** | MVP | Primary target (school laptops) |
| **macOS** | v1.1 | Secondary target |
| **Linux** | v1.1 | Community support |

---

## 14. Project Structure

```
QuickBeam/
├── package.json
├── electron.js              # Main process
├── preload.js               # Preload script
├── src/
│   ├── renderer/            # UI (HTML/CSS/JS)
│   │   ├── index.html
│   │   ├── styles/
│   │   │   ├── main.css
│   │   │   ├── dark.css
│   │   │   └── light.css
│   │   ├── scripts/
│   │   │   ├── app.js
│   │   │   ├── discovery.js
│   │   │   ├── pairing.js
│   │   │   └── transfer.js
│   │   └── assets/
│   │       └── icons/
│   ├── main/                # Main process modules
│   │   ├── network.js       # Discovery & connection
│   │   ├── transfer.js      # File transfer engine
│   │   └── storage.js       # Settings & history
│   └── shared/              # Shared constants/utils
│       ├── constants.js
│       └── utils.js
├── tests/
└── build/                   # Build configuration
```

---

## 15. Development Phases

### Phase 1: Foundation (Week 1-2)
- [ ] Project setup (Electron, build tools)
- [ ] Basic UI framework with theme support
- [ ] Network discovery implementation
- [ ] Device list rendering

### Phase 2: Connection (Week 3-4)
- [ ] Pairing protocol implementation
- [ ] Pairing UI (accept/reject)
- [ ] Connection state management

### Phase 3: Transfer (Week 5-6)
- [ ] File selection UI
- [ ] Transfer engine implementation
- [ ] Progress tracking UI
- [ ] Transfer history

### Phase 4: Polish (Week 7-8)
- [ ] Error handling
- [ ] Resume capability
- [ ] Settings page
- [ ] Testing & optimization

---

## 16. Success Metrics

| Metric | Target |
|--------|--------|
| **Transfer Speed** | Matches or exceeds USB 3.0 |
| **User Satisfaction** | 4.5+ rating in school testing |
| **Adoption** | 50+ active users in first month |
| **Reliability** | < 1% transfer failure rate |

---

## 17. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| WiFi interference | Slow transfers | Support Ethernet fallback |
| Firewall blocking | Connection fails | Guide users to allow app |
| Large file handling | Memory issues | Stream in chunks |
| Cross-platform issues | Inconsistent behavior | Thorough testing |

---

## 18. Open Questions

1. Should we support WiFi Direct (no router) or require same network?
2. Should transfers be encrypted by default?
3. Should we implement a "trust device" feature for repeated transfers?
4. What's the maximum folder depth to support?

---

## 19. Appendix

### UI Inspiration Analysis
- **ui1.png**: Dark theme - black background (#1E1E1E), gold accent (#F5C542), clean sidebar
- **ui2.png**: Light theme - cream background (#F5F5F0), same gold accent, minimal design
- **Key Elements**: Sidebar navigation, circular progress indicator, clean typography, toggle theme

### Similar Applications
- **Xender**: Mobile file sharing (reference for features)
- **Snapdrop**: Web-based local file sharing
- **LANDrop**: Cross-platform LAN file transfer
- **LocalSend**: Open-source AirDrop alternative

---

**Document Version**: 1.0  
**Last Updated**: June 17, 2026  
**Author**: QuickBeam Development Team
