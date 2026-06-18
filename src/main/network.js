const EventEmitter = require('events');
const dgram = require('dgram');
const net = require('net');
const { NETWORK, MESSAGE_TYPES, DEVICE_STATUS, APP_ID, APP_VERSION } = require('../shared/constants');
const { generateId, getLocalIP, getHostname } = require('../shared/utils');

class NetworkManager extends EventEmitter {
  constructor(settings) {
    super();
    this.settings = settings;
    this.deviceId = generateId();
    this.devices = new Map();
    this.pairedDevices = new Map();
    this.pendingPairs = new Map();
    this.broadcastSocket = null;
    this.serverSocket = null;
    this.broadcastTimer = null;
    this.localIP = getLocalIP();
    this.hostname = getHostname();
    this.started = false;
  }

  start() {
    if (this.started) return;
    this.started = true;

    try {
      this.startBroadcastListener();
    } catch (err) {
      console.error('Broadcast listener error:', err);
    }

    try {
      this.startServer();
    } catch (err) {
      console.error('Server error:', err);
    }

    this.startDiscovery();
  }

  stop() {
    this.stopDiscovery();

    if (this.broadcastSocket) {
      try { this.broadcastSocket.close(); } catch (e) {}
      this.broadcastSocket = null;
    }

    if (this.serverSocket) {
      try { this.serverSocket.close(); } catch (e) {}
      this.serverSocket = null;
    }

    this.started = false;
  }

  updateSettings(settings) {
    this.settings = settings;
  }

  startBroadcastListener() {
    this.broadcastSocket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

    this.broadcastSocket.on('message', (msg, rinfo) => {
      try {
        const data = JSON.parse(msg.toString());
        if (data.appId === APP_ID && data.deviceId !== this.deviceId) {
          this.handleAnnouncement(data, rinfo);
        }
      } catch (e) {
        // Ignore invalid messages
      }
    });

    this.broadcastSocket.on('error', (err) => {
      console.error('Broadcast socket error:', err.message);
    });

    this.broadcastSocket.bind(NETWORK.DISCOVERY_PORT, () => {
      try {
        this.broadcastSocket.setBroadcast(true);
      } catch (e) {}
    });
  }

  handleAnnouncement(data, rinfo) {
    const timeSinceLastSeen = this.devices.has(data.deviceId) 
      ? Date.now() - (this.devices.get(data.deviceId).lastSeen || 0)
      : Infinity;

    const device = {
      id: data.deviceId,
      hostname: data.hostname,
      ip: data.ip || rinfo.address,
      port: data.port,
      status: this.pairedDevices.has(data.deviceId) ? DEVICE_STATUS.PAIRED : DEVICE_STATUS.AVAILABLE,
      lastSeen: Date.now(),
      version: data.version,
      quality: timeSinceLastSeen < 3000 ? 100 : timeSinceLastSeen < 5000 ? 70 : 40
    };

    if (!this.devices.has(device.id)) {
      this.devices.set(device.id, device);
      this.emit('deviceFound', device);
    } else {
      const existing = this.devices.get(device.id);
      existing.lastSeen = Date.now();
      existing.status = device.status;
      existing.quality = device.quality;
      this.emit('deviceFound', existing);
    }
  }

  startServer() {
    this.serverSocket = net.createServer((socket) => {
      this.handleConnection(socket);
    });

    this.serverSocket.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error('Port', this.settings.port, 'in use, trying next port');
        this.settings.port++;
        this.serverSocket.listen(this.settings.port);
      } else {
        console.error('Server error:', err.message);
      }
    });

    this.serverSocket.listen(this.settings.port, () => {
      console.log('Server listening on port', this.settings.port);
    });
  }

  handleConnection(socket) {
    let headerBuf = Buffer.alloc(0);
    let expecting = 'detect';
    let expectedLen = 0;
    let newlineBuffer = '';

    const detectProtocol = (data) => {
      if (data.length >= 4) {
        const possibleLen = data.readUInt32BE(0);
        if (possibleLen > 0 && possibleLen < 1048576) {
          return 'lengthprefixed';
        }
      }
      return 'newline';
    };

    const processLengthPrefixed = (chunk) => {
      if (expecting === 'header') {
        headerBuf = Buffer.concat([headerBuf, chunk]);
        if (headerBuf.length >= 4) {
          expectedLen = headerBuf.readUInt32BE(0);
          headerBuf = headerBuf.slice(4);
          expecting = 'data';
          if (headerBuf.length > 0) {
            processLengthPrefixed(Buffer.alloc(0));
          }
        }
      } else if (expecting === 'data') {
        if (chunk.length >= expectedLen) {
          const messageBuf = chunk.slice(0, expectedLen);
          const remaining = chunk.slice(expectedLen);
          expecting = 'header';
          headerBuf = Buffer.alloc(0);

          try {
            const message = JSON.parse(messageBuf.toString());
            this.handleMessage(message, socket);
          } catch (e) {
            console.error('Invalid message:', e.message);
          }

          if (remaining.length > 0) {
            processLengthPrefixed(remaining);
          }
        }
      }
    };

    const processNewline = (data) => {
      newlineBuffer += data.toString();
      const lines = newlineBuffer.split('\n');
      newlineBuffer = lines.pop();

      for (const line of lines) {
        if (line.trim()) {
          try {
            const message = JSON.parse(line);
            this.handleMessage(message, socket);
          } catch (e) {
            console.error('Invalid message:', e.message);
          }
        }
      }
    };

    socket.on('data', (data) => {
      if (expecting === 'detect') {
        const protocol = detectProtocol(data);
        expecting = protocol === 'lengthprefixed' ? 'header' : 'newline';
        if (protocol === 'lengthprefixed') {
          processLengthPrefixed(data);
        } else {
          processNewline(data);
        }
      } else if (expecting === 'newline') {
        processNewline(data);
      } else {
        processLengthPrefixed(data);
      }
    });

    socket.on('error', (err) => {
      console.error('Connection error:', err.message);
    });
  }

  handleMessage(message, socket) {
    switch (message.type) {
      case MESSAGE_TYPES.PAIR_REQUEST:
        this.handlePairRequest(message, socket);
        break;
      case MESSAGE_TYPES.PAIR_ACCEPT:
        this.handlePairAccept(message);
        break;
      case MESSAGE_TYPES.PAIR_REJECT:
        this.handlePairReject(message);
        break;
      case MESSAGE_TYPES.TRANSFER_INIT:
        this.emit('transferRequest', { ...message, socket });
        break;
      default:
        this.emit('message', message, socket);
    }
  }

  handlePairRequest(message, socket) {
    const requestId = message.requestId || generateId();
    const request = {
      id: requestId,
      deviceId: message.deviceId,
      hostname: message.hostname,
      ip: message.ip,
      socket
    };

    this.pendingPairs.set(requestId, request);
    this.emit('pairRequest', request);
  }

  handlePairAccept(message) {
    const pending = this.pendingPairs.get(message.requestId);
    if (pending) {
      this.pairedDevices.set(pending.deviceId, {
        ...pending,
        pairedAt: Date.now()
      });
      this.pendingPairs.delete(message.requestId);
      this.emit('pairAccepted', pending);
    }
  }

  handlePairReject(message) {
    const pending = this.pendingPairs.get(message.requestId);
    if (pending) {
      this.pendingPairs.delete(message.requestId);
      this.emit('pairRejected', pending.deviceId);
    }
  }

  startDiscovery() {
    this.broadcastPresence();
    this.broadcastTimer = setInterval(() => {
      this.broadcastPresence();
    }, NETWORK.BROADCAST_INTERVAL);

    this.cleanupStaleDevices();
  }

  stopDiscovery() {
    if (this.broadcastTimer) {
      clearInterval(this.broadcastTimer);
      this.broadcastTimer = null;
    }
  }

  broadcastPresence() {
    if (!this.broadcastSocket) return;

    const message = JSON.stringify({
      type: MESSAGE_TYPES.ANNOUNCE,
      appId: APP_ID,
      version: APP_VERSION,
      deviceId: this.deviceId,
      hostname: this.hostname,
      ip: this.localIP,
      port: this.settings.port,
      timestamp: Date.now()
    });

    const buffer = Buffer.from(message);
    try {
      this.broadcastSocket.send(buffer, 0, buffer.length, NETWORK.DISCOVERY_PORT, NETWORK.BROADCAST_ADDRESS);
    } catch (e) {
      // Ignore broadcast errors
    }
  }

  cleanupStaleDevices() {
    setInterval(() => {
      const now = Date.now();
      for (const [id, device] of this.devices) {
        if (now - device.lastSeen > 10000) {
          this.devices.delete(id);
          this.emit('deviceLost', id);
        }
      }
    }, 5000);
  }

  getDevices() {
    return Array.from(this.devices.values());
  }

  getDevice(deviceId) {
    return this.devices.get(deviceId) || this.pairedDevices.get(deviceId);
  }

  requestPair(deviceId) {
    const device = this.devices.get(deviceId);
    if (!device) {
      return { success: false, error: 'Device not found' };
    }

    const requestId = generateId();

    try {
      const socket = net.createConnection(device.port, device.ip, () => {
        const message = JSON.stringify({
          type: MESSAGE_TYPES.PAIR_REQUEST,
          requestId,
          deviceId: this.deviceId,
          hostname: this.hostname,
          ip: this.localIP
        }) + '\n';

        socket.write(message);

        this.pendingPairs.set(requestId, {
          id: requestId,
          deviceId,
          device,
          socket
        });
      });

      socket.on('error', (err) => {
        console.error('Pair request error:', err.message);
        this.pendingPairs.delete(requestId);
      });

      return { success: true, requestId };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  acceptPair(requestId) {
    const request = this.pendingPairs.get(requestId);
    if (!request) {
      return { success: false, error: 'Request not found' };
    }

    try {
      const message = JSON.stringify({
        type: MESSAGE_TYPES.PAIR_ACCEPT,
        requestId,
        deviceId: this.deviceId,
        hostname: this.hostname
      }) + '\n';

      request.socket.write(message);

      this.pairedDevices.set(request.deviceId, {
        ...request,
        pairedAt: Date.now()
      });
      this.pendingPairs.delete(requestId);

      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  rejectPair(requestId) {
    const request = this.pendingPairs.get(requestId);
    if (!request) {
      return { success: false, error: 'Request not found' };
    }

    try {
      const message = JSON.stringify({
        type: MESSAGE_TYPES.PAIR_REJECT,
        requestId,
        deviceId: this.deviceId
      }) + '\n';

      request.socket.write(message);
      this.pendingPairs.delete(requestId);

      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  getConnection(deviceId) {
    const device = this.pairedDevices.get(deviceId) || this.devices.get(deviceId);
    if (!device || !device.socket) {
      return null;
    }
    return device.socket;
  }

  getConnectionQuality(deviceId) {
    const device = this.devices.get(deviceId);
    if (!device) {
      return { quality: 0 };
    }

    const timeSinceLastSeen = Date.now() - (device.lastSeen || 0);
    let quality = 100;

    if (timeSinceLastSeen > 5000) quality = 50;
    if (timeSinceLastSeen > 8000) quality = 20;

    return { quality, lastSeen: device.lastSeen };
  }
}

module.exports = NetworkManager;
