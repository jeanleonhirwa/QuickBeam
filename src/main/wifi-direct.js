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
    this.connectionInfo = null;
  }

  async initialize() {
    this.hostedNetworkSupported = await WifiCommands.checkHostedNetworkSupport();
    console.log('Hosted network supported:', this.hostedNetworkSupported);
    return this.hostedNetworkSupported;
  }

  generateCredentials() {
    this.ssid = WifiCommands.getDeviceName();
    this.password = WifiCommands.generatePassword();
    return { ssid: this.ssid, password: this.password };
  }

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
    this.connectionInfo = {
      deviceId: this.deviceId,
      ssid: creds.ssid,
      password: creds.password,
      hostname: require('os').hostname(),
      ip: WifiCommands.getLocalIP()
    };

    this.emit('networkReady', this.connectionInfo);

    return this.connectionInfo;
  }

  async joinNetwork(ssid, password) {
    const connected = await WifiCommands.connectToNetwork(ssid, password);

    if (connected) {
      this.isConnected = true;
      this.ssid = ssid;
      this.password = password;
      this.connectionInfo = {
        deviceId: this.deviceId,
        ssid,
        hostname: require('os').hostname(),
        ip: WifiCommands.getLocalIP()
      };
      this.emit('connected', this.connectionInfo);
      return this.connectionInfo;
    }

    throw new Error('Failed to connect to network');
  }

  getConnectionInfo() {
    return this.connectionInfo;
  }

  async checkConnection() {
    if (this.ssid) {
      const connected = await WifiCommands.isConnected(this.ssid);
      if (!connected && this.isConnected) {
        this.isConnected = false;
        this.emit('disconnected');
      }
      return connected;
    }
    return false;
  }

  async getHostedNetworkStatus() {
    return await WifiCommands.getHostedNetworkStatus();
  }

  async cleanup() {
    if (this.isHost) {
      await WifiCommands.stopHostedNetwork();
    } else if (this.isConnected) {
      await WifiCommands.disconnect();
    }
    this.isHost = false;
    this.isConnected = false;
    this.ssid = null;
    this.connectionInfo = null;
  }

  getCredentialsForSharing() {
    if (!this.ssid || !this.password) return null;
    return {
      code: this.ssid,
      password: this.password
    };
  }

  parseSharedCredentials(code, password) {
    return {
      ssid: code.trim(),
      password: password.trim()
    };
  }
}

module.exports = WifiDirectManager;
