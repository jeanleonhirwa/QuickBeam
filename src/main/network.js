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
    const device = {
      id: data.deviceId,
      hostname: data.hostname,
      ip: data.ip || rinfo.address,
      port: data.port,
      status: this.pairedDevices.has(data.deviceId) ? DEVICE_STATUS.PAIRED : DEVICE_STATUS.AVAILABLE,
      lastSeen: Date.now(),
      version: data.version
    };

    if (!this.devices.has(device.id)) {
      this.devices.set(device.id, device);
      this.emit('deviceFound', device);
    } else {
      const existing = this.devices.get(device.id);
      existing.lastSeen = Date.now();
      existing.status = device.status;
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
    let buffer = '';

    socket.on('data', (data) => {
      buffer += data.toString();

      const lines = buffer.split('\n');
      buffer = lines.pop();

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
}

module.exports = NetworkManager;
