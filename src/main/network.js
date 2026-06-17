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
  }

  start() {
    this.startBroadcastListener();
    this.startServer();
    this.startDiscovery();
  }

  stop() {
    this.stopDiscovery();
    if (this.broadcastSocket) {
      this.broadcastSocket.close();
      this.broadcastSocket = null;
    }
    if (this.serverSocket) {
      this.serverSocket.close();
      this.serverSocket = null;
    }
  }

  updateSettings(settings) {
    this.settings = settings;
  }

  startBroadcastListener() {
    this.broadcastSocket = dgram.createSocket('udp4');
    
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
      console.error('Broadcast socket error:', err);
    });

    this.broadcastSocket.bind(NETWORK.DISCOVERY_PORT, () => {
      this.broadcastSocket.setBroadcast(true);
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
      console.error('Server error:', err);
    });

    this.serverSocket.listen(this.settings.port, () => {
      console.log(`Server listening on port ${this.settings.port}`);
    });
  }

  handleConnection(socket) {
    let buffer = '';
    
    socket.on('data', (data) => {
      buffer += data.toString();
      
      const messages = buffer.split('\n');
      buffer = messages.pop();
      
      for (const msg of messages) {
        if (msg.trim()) {
          try {
            const message = JSON.parse(msg);
            this.handleMessage(message, socket);
          } catch (e) {
            console.error('Invalid message:', e);
          }
        }
      }
    });

    socket.on('error', (err) => {
      console.error('Connection error:', err);
    });
  }

  handleMessage(message, socket) {
    switch (message.type) {
      case MESSAGE_TYPES.PAIR_REQUEST:
        this.handlePairRequest(message, socket);
        break;
      case MESSAGE_TYPES.PAIR_ACCEPT:
        this.handlePairAccept(message, socket);
        break;
      case MESSAGE_TYPES.PAIR_REJECT:
        this.handlePairReject(message, socket);
        break;
      default:
        this.emit('message', message, socket);
    }
  }

  handlePairRequest(message, socket) {
    const requestId = generateId();
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

  handlePairAccept(message, socket) {
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

  handlePairReject(message, socket) {
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
    this.broadcastSocket.send(buffer, 0, buffer.length, NETWORK.DISCOVERY_PORT, NETWORK.BROADCAST_ADDRESS);
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
      console.error('Pair request error:', err);
      this.pendingPairs.delete(requestId);
    });

    return { success: true, requestId };
  }

  acceptPair(requestId) {
    const request = this.pendingPairs.get(requestId);
    if (!request) {
      return { success: false, error: 'Request not found' };
    }

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
  }

  rejectPair(requestId) {
    const request = this.pendingPairs.get(requestId);
    if (!request) {
      return { success: false, error: 'Request not found' };
    }

    const message = JSON.stringify({
      type: MESSAGE_TYPES.PAIR_REJECT,
      requestId,
      deviceId: this.deviceId
    }) + '\n';

    request.socket.write(message);
    this.pendingPairs.delete(requestId);
    
    return { success: true };
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
