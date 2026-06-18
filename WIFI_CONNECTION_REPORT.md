# QuickBeam - WiFi Connection Methods Report

## Executive Summary

QuickBeam needs to connect two PCs without a router. This report compares connection methods and recommends the best approach for a student-friendly, easy-to-use app.

---

## Connection Methods Comparison

### Method 1: Windows Mobile Hotspot

| Aspect | Details |
|--------|---------|
| **How it works** | PC A creates WiFi network → PC B connects |
| **User action** | Must manually enable hotspot in Settings |
| **Internet required?** | Yes, on most Windows 10/11 PCs |
| **Speed** | Good (limited by WiFi adapter) |
| **Reliability** | High |
| **Ease of use** | Poor - requires leaving the app |

**Problems:**
- Windows requires internet connection to enable hotspot
- User must go to Settings → Network → Mobile Hotspot
- Not integrated into the app
- Different UI on Windows 10 vs 11

---

### Method 2: WiFi Direct (Legacy Hosted Network)

| Aspect | Details |
|--------|---------|
| **How it works** | PC A creates virtual WiFi access point → PC B connects |
| **User action** | None - app handles everything |
| **Internet required?** | NO |
| **Speed** | Good (limited by WiFi adapter) |
| **Reliability** | High |
| **Ease of use** | Excellent - fully automatic |

**Commands:**
```bash
# Create hosted network (no internet needed)
netsh wlan set hostednetwork mode=allow ssid="QuickBeam_ABC" key="quickbeam123"
netsh wlan start hostednetwork

# Other PC connects automatically
netsh wlan connect name="QuickBeam_ABC"
```

**Advantages:**
- ✅ Works without internet
- ✅ Can be fully automated in the app
- ✅ User doesn't need to touch any settings
- ✅ Works on Windows 7/8/10/11

**Limitations:**
- ⚠️ Requires WiFi adapter that supports hosted network
- ⚠️ Some newer WiFi adapters don't support this feature
- ⚠️ May need admin privileges

---

### Method 3: WiFi Direct (Windows API)

| Aspect | Details |
|--------|---------|
| **How it works** | Uses Windows WiFi Direct API for peer discovery |
| **User action** | None - app handles everything |
| **Internet required?** | NO |
| **Speed** | High |
| **Reliability** | High |
| **Ease of use** | Excellent - fully automatic |

**Technical details:**
- Uses `WiFiDirect` Windows API
- Built into Windows 10/11
- Designed for device-to-device connections
- More complex to implement

**Challenges:**
- Requires C++/C# interop in Node.js
- Complex API to work with
- May not work PC-to-PC (designed for peripherals)

---

### Method 4: Direct Ethernet Cable

| Aspect | Details |
|--------|---------|
| **How it works** | Physical cable between two PCs |
| **User action** | Plug in cable |
| **Internet required?** | NO |
| **Speed** | Highest (1 Gbps+) |
| **Reliability** | Highest |
| **Ease of use** | Good - just plug and play |

**Limitations:**
- Requires physical cable
- Not always available
- Can't be the only connection method

---

## Recommendation

### Best Approach: **WiFi Direct Legacy Hosted Network + Fallback to Direct Connection**

| Priority | Method | When to Use |
|----------|--------|-------------|
| **Primary** | WiFi Direct Hosted Network | Most cases - automatic, no internet needed |
| **Secondary** | Direct Ethernet | If WiFi doesn't work |
| **Fallback** | Manual Hotspot | If hosted network not supported |

**Why this combination?**
1. WiFi Direct Hosted Network is the **only method that works without internet AND is fully automatic**
2. It can be implemented entirely within the app using `netsh` commands
3. User never leaves the app or touches any settings
4. Falls back gracefully if hardware doesn't support it

---

## Implementation Plan: WiFi Direct Hosted Network

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    QuickBeam WiFi Manager                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    │
│  │   Detect    │───>│   Create    │───>│   Connect   │    │
│  │  Hardware   │    │  HostedNet  │    │   Other PC  │    │
│  └─────────────┘    └─────────────┘    └─────────────┘    │
│         │                  │                  │             │
│         v                  v                  v             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    │
│  │  netsh WLAN │    │  netsh WLAN │    │  netsh WLAN │    │
│  │  show       │    │  set/start  │    │  connect    │    │
│  └─────────────┘    └─────────────┘    └─────────────┘    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### New Files to Create

| File | Purpose |
|------|---------|
| `src/main/wifi-direct.js` | WiFi Direct manager class |
| `src/main/wifi-commands.js` | netsh command wrappers |

### Modifications to Existing Files

| File | Changes |
|------|---------|
| `electron.js` | Initialize WiFi manager, handle events |
| `network.js` | Use WiFi Direct for discovery instead of broadcast |
| `preload.js` | Add WiFi IPC handlers |
| `app.js` | Add WiFi status UI |

---

### Step-by-Step Implementation

#### Step 1: Create WiFi Commands Module

**File: `src/main/wifi-commands.js`**

```javascript
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

class WifiCommands {
  // Check if WiFi adapter supports hosted network
  static async checkHostedNetworkSupport() {
    try {
      const { stdout } = await execAsync('netsh wlan show drivers');
      return stdout.includes('Hosted network supported  : Yes');
    } catch (err) {
      return false;
    }
  }

  // Get device name (short, no spaces)
  static getDeviceName() {
    const os = require('os');
    const hostname = os.hostname().replace(/[^a-zA-Z0-9]/g, '').substring(0, 15);
    return `QB_${hostname}`;
  }

  // Create hosted network
  static async createHostedNetwork(ssid, password) {
    const cmd = `netsh wlan set hostednetwork mode=allow ssid="${ssid}" key="${password}"`;
    await execAsync(cmd);
  }

  // Start hosted network
  static async startHostedNetwork() {
    await execAsync('netsh wlan start hostednetwork');
  }

  // Stop hosted network
  static async stopHostedNetwork() {
    try {
      await execAsync('netsh wlan stop hostednetwork');
    } catch (e) {
      // Ignore if not running
    }
  }

  // Get hosted network status
  static async getHostedNetworkStatus() {
    try {
      const { stdout } = await execAsync('netsh wlan show hostednetwork');
      return {
        status: stdout.includes('Status                  : Started'),
        clients: this.parseClientCount(stdout)
      };
    } catch (err) {
      return { status: false, clients: 0 };
    }
  }

  // Connect to a hosted network
  static async connectToNetwork(ssid, password) {
    // Create profile XML
    const profileXml = `<?xml version="1.0"?>
<WLANProfile xmlns="http://www.microsoft.com/networking/WLAN/profile/v1">
  <name>${ssid}</name>
  <SSIDConfig>
    <SSID>
      <name>${ssid}</name>
    </SSID>
  </SSIDConfig>
  <connectionType>ESS</connectionType>
  <connectionMode>manual</connectionMode>
  <MSM>
    <security>
      <authEncryption>
        <authentication>WPA2PSK</authentication>
        <encryption>AES</encryption>
        <useOneX>false</useOneX>
      </authEncryption>
      <sharedKey>
        <keyType>passPhrase</keyType>
        <protected>false</protected>
        <keyMaterial>${password}</keyMaterial>
      </sharedKey>
    </security>
  </MSM>
</WLANProfile>`;

    // Save profile and connect
    const profilePath = `${process.env.TEMP}\\qb_profile.xml`;
    require('fs').writeFileSync(profilePath, profileXml);

    await execAsync(`netsh wlan add profile filename="${profilePath}"`);
    await execAsync(`netsh wlan connect name="${ssid}"`);

    // Wait for connection
    await new Promise(resolve => setTimeout(resolve, 3000));

    return await this.isConnected(ssid);
  }

  // Check if connected to a specific network
  static async isConnected(ssid) {
    try {
      const { stdout } = await execAsync('netsh wlan show interfaces');
      return stdout.includes(ssid);
    } catch (err) {
      return false;
    }
  }

  // Disconnect from WiFi
  static async disconnect() {
    try {
      await execAsync('netsh wlan disconnect');
    } catch (e) {
      // Ignore
    }
  }

  // Get local IP address
  static async getLocalIP() {
    const os = require('os');
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          return iface.address;
        }
      }
    }
    return '127.0.0.1';
  }

  parseClientCount(output) {
    const match = output.match(/Number of clients\s*:\s*(\d+)/);
    return match ? parseInt(match[1]) : 0;
  }
}

module.exports = WifiCommands;
```

#### Step 2: Create WiFi Direct Manager

**File: `src/main/wifi-direct.js`**

```javascript
const EventEmitter = require('events');
const WifiCommands = require('./wifi-commands');
const { generateId } = require('../shared/utils');

class WifiDirectManager extends EventEmitter {
  constructor(storage) {
    super();
    this.storage = storage;
    this.isHost = false;
    this.isConnected = false;
    this.ssid = null;
    this.password = null;
    this.deviceId = generateId();
    this.hostedNetworkSupported = false;
  }

  async initialize() {
    this.hostedNetworkSupported = await WifiCommands.checkHostedNetworkSupport();
    console.log('Hosted network supported:', this.hostedNetworkSupported);
    return this.hostedNetworkSupported;
  }

  // Generate unique SSID and password for this session
  generateCredentials() {
    const hostname = require('os').hostname().replace(/[^a-zA-Z0-9]/g, '').substring(0, 10);
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    this.ssid = `QB_${hostname}_${random}`;
    this.password = 'qb' + Math.random().toString(36).substring(2, 10);
    return { ssid: this.ssid, password: this.password };
  }

  // Host a WiFi Direct network
  async hostNetwork() {
    if (!this.hostedNetworkSupported) {
      throw new Error('WiFi Direct not supported on this device');
    }

    const creds = this.generateCredentials();

    await WifiCommands.createHostedNetwork(creds.ssid, creds.password);
    await WifiCommands.startHostedNetwork();

    // Wait for network to start
    await new Promise(resolve => setTimeout(resolve, 2000));

    const status = await WifiCommands.getHostedNetworkStatus();
    if (!status.status) {
      throw new Error('Failed to start hosted network');
    }

    this.isHost = true;
    this.emit('networkReady', { ssid: creds.ssid, password: creds.password });

    return { ssid: creds.ssid, password: creds.password };
  }

  // Join an existing WiFi Direct network
  async joinNetwork(ssid, password) {
    const connected = await WifiCommands.connectToNetwork(ssid, password);

    if (connected) {
      this.isConnected = true;
      this.ssid = ssid;
      this.emit('connected', { ssid });
      return true;
    }

    throw new Error('Failed to connect to network');
  }

  // Get connection info for sharing with other PC
  getConnectionInfo() {
    return {
      deviceId: this.deviceId,
      ssid: this.ssid,
      password: this.password,
      hostname: require('os').hostname()
    };
  }

  // Cleanup on exit
  async cleanup() {
    if (this.isHost) {
      await WifiCommands.stopHostedNetwork();
    } else if (this.isConnected) {
      await WifiCommands.disconnect();
    }
    this.isHost = false;
    this.isConnected = false;
  }

  // Check if currently connected
  async checkConnection() {
    if (this.ssid) {
      return await WifiCommands.isConnected(this.ssid);
    }
    return false;
  }
}

module.exports = WifiDirectManager;
```

#### Step 3: Modify Network Manager

**Changes to `src/main/network.js`:**

Add WiFi Direct integration to network discovery. When WiFi Direct is available:
1. Host creates network and broadcasts presence on it
2. Joiner connects to network, then discovers host via UDP broadcast
3. Normal pairing and transfer flow works over the WiFi Direct connection

```javascript
// Add to NetworkManager constructor
this.wifiDirect = null;

// Add method to set WiFi Direct manager
setWifiDirect(wifiDirect) {
  this.wifiDirect = wifiDirect;
}

// Modify startDiscovery to work on WiFi Direct network
startDiscovery() {
  this.broadcastPresence();
  this.broadcastTimer = setInterval(() => {
    this.broadcastPresence();
  }, NETWORK.BROADCAST_INTERVAL);
  this.cleanupStaleDevices();
}
```

#### Step 4: Modify Electron Main Process

**Changes to `electron.js`:**

```javascript
const WifiDirectManager = require('./src/main/wifi-direct');
let wifiDirect;

function initializeServices() {
  // ... existing code ...

  // Initialize WiFi Direct
  wifiDirect = new WifiDirectManager(storage);
  wifiDirect.initialize().then(supported => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('wifi-direct:supported', supported);
    }
  });
}

// Add IPC handlers
ipcMain.handle('wifi:host', async () => {
  return await wifiDirect.hostNetwork();
});

ipcMain.handle('wifi:join', async (event, { ssid, password }) => {
  return await wifiDirect.joinNetwork(ssid, password);
});

ipcMain.handle('wifi:cleanup', async () => {
  await wifiDirect.cleanup();
});

ipcMain.handle('wifi:status', async () => {
  return {
    supported: wifiDirect.hostedNetworkSupported,
    isHost: wifiDirect.isHost,
    isConnected: wifiDirect.isConnected,
    ssid: wifiDirect.ssid
  };
});

// On app quit
app.on('before-quit', async () => {
  if (wifiDirect) {
    await wifiDirect.cleanup();
  }
});
```

#### Step 5: Add Preload API

**Changes to `preload.js`:**

```javascript
wifi: {
  host: () => ipcRenderer.invoke('wifi:host'),
  join: (ssid, password) => ipcRenderer.invoke('wifi:join', { ssid, password }),
  cleanup: () => ipcRenderer.invoke('wifi:cleanup'),
  status: () => ipcRenderer.invoke('wifi:status'),
  onSupported: (callback) => ipcRenderer.on('wifi-direct:supported', (e, v) => callback(v)),
}
```

#### Step 6: Update UI Flow

**Changes to `app.js`:**

New flow for connecting two PCs:

```
┌─────────────────────────────────────────────────────────────┐
│                     Connection Flow                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  PC A (Host)                    PC B (Joiner)                │
│  ───────────                    ─────────────                │
│  1. Click "Create Room"         1. Click "Join Room"         │
│           │                              │                   │
│           v                              v                   │
│  2. Show QR Code/Code           2. Enter Code                │
│     (SSID + Password)                │                       │
│           │                              │                   │
│           v                              v                   │
│  3. WiFi Direct created         3. Connects to WiFi Direct  │
│           │                              │                   │
│           v                              v                   │
│  4. UDP Discovery finds PC B    4. UDP Discovery finds PC A │
│           │                              │                   │
│           v                              v                   │
│  5. Ready to transfer!          5. Ready to transfer!        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**New UI Elements:**

```html
<!-- Connection Method Selection -->
<div class="view" id="view-connect">
  <h2>Connect to Another PC</h2>

  <div class="connect-options">
    <button class="btn btn-primary btn-large" id="btn-create-room">
      <svg><!-- create icon --></svg>
      Create Room
      <span class="hint">Make this PC discoverable</span>
    </button>

    <div class="divider">OR</div>

    <button class="btn btn-secondary btn-large" id="btn-join-room">
      <svg"><!-- join icon --></svg>
      Join Room
      <span class="hint">Connect to another PC</span>
    </button>
  </div>
</div>

<!-- Host View - Shows connection code -->
<div class="view hidden" id="view-host">
  <div class="room-code">
    <h3>Share this code with the other PC:</h3>
    <div class="code-display">
      <span class="code">QB_ABC123</span>
      <span class="password">Password: qb123456</span>
    </div>
    <button class="btn btn-secondary" id="btn-copy-code">Copy Code</button>
  </div>
  <div class="waiting">
    <div class="spinner"></div>
    <p>Waiting for other PC to join...</p>
  </div>
</div>

<!-- Joiner View - Enter code -->
<div class="view hidden" id="view-join">
  <div class="join-form">
    <label>Enter room code from other PC:</label>
    <input type="text" id="input-room-code" placeholder="QB_ABC123">
    <label>Password:</label>
    <input type="text" id="input-room-password" placeholder="Password">
    <button class="btn btn-primary" id="btn-connect-room">Connect</button>
  </div>
</div>
```

---

## Updated App Flow

### For Host PC (Creating Room):
1. User opens QuickBeam
2. Clicks "Create Room"
3. App creates WiFi Direct network automatically
4. Shows connection code (SSID + password)
5. Waits for other PC to join
6. Other PC joins → Auto-discovered → Ready to transfer

### For Joiner PC:
1. User opens QuickBeam
2. Clicks "Join Room"
3. Enters code from Host PC
4. App connects to WiFi Direct network automatically
5. Auto-discovers Host PC via UDP broadcast
6. Ready to transfer!

### During Transfer:
1. Select files
2. Click Send
3. Transfer happens over WiFi Direct connection
4. Speed: 50-150 Mbps (typical WiFi Direct speed)

---

## Error Handling

| Error | Solution |
|-------|----------|
| WiFi Direct not supported | Show message: "Use Ethernet cable or manual hotspot" |
| Hosted network failed to start | Retry once, then fallback to manual mode |
| Can't connect to network | Show troubleshooting tips |
| Connection lost | Auto-reconnect, show status |

---

## Testing Checklist

- [ ] PC A creates hosted network without internet
- [ ] PC B connects to hosted network
- [ ] Both PCs discover each other via UDP
- [ ] Pairing works over WiFi Direct
- [ ] File transfer works at good speed
- [ ] Transfer completes successfully
- [ ] Cleanup works (network stops on app close)
- [ ] Works on Windows 10
- [ ] Works on Windows 11
- [ ] Handles WiFi Direct not supported gracefully

---

## Estimated Implementation Time

| Task | Time |
|------|------|
| WiFi Commands module | 2 hours |
| WiFi Direct Manager | 2 hours |
| Network Manager changes | 1 hour |
| Electron IPC changes | 1 hour |
| Preload API changes | 0.5 hours |
| UI changes | 3 hours |
| Testing & debugging | 4 hours |
| **Total** | **13.5 hours** |

---

## Conclusion

**Recommended approach: WiFi Direct Hosted Network**

This is the only method that:
- ✅ Works without internet
- ✅ Works without router
- ✅ Is fully automatic
- ✅ Keeps user inside the app
- ✅ Works on most Windows PCs

The implementation is straightforward using `netsh` commands and can be done in ~14 hours.
