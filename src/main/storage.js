const Store = require('electron-store');
const path = require('path');

class Storage {
  constructor() {
    this.store = new Store({
      name: 'quickbeam-data',
      defaults: {
        settings: {
          hostname: require('os').hostname(),
          downloadPath: path.join(require('os').homedir(), 'Downloads', 'QuickBeam'),
          theme: 'dark',
          port: 58586,
          autoAccept: false,
          maxConcurrentTransfers: 3
        },
        transferHistory: [],
        pairedDevices: []
      }
    });
  }

  getSettings() {
    return this.store.get('settings');
  }

  updateSettings(newSettings) {
    const current = this.getSettings();
    this.store.set('settings', { ...current, ...newSettings });
  }

  getTransferHistory() {
    return this.store.get('transferHistory');
  }

  addTransferHistory(transfer) {
    const history = this.getTransferHistory();
    history.unshift({
      id: transfer.id,
      type: transfer.type,
      deviceId: transfer.deviceId,
      files: transfer.files.map(f => ({ name: f.name, size: f.size })),
      totalSize: transfer.totalSize,
      status: transfer.status,
      startTime: transfer.startTime,
      endTime: transfer.endTime,
      timestamp: Date.now()
    });
    
    if (history.length > 100) {
      history.pop();
    }
    
    this.store.set('transferHistory', history);
  }

  clearTransferHistory() {
    this.store.set('transferHistory', []);
  }

  getPairedDevices() {
    return this.store.get('pairedDevices');
  }

  addPairedDevice(device) {
    const devices = this.getPairedDevices();
    if (!devices.find(d => d.id === device.id)) {
      devices.push({
        id: device.id,
        hostname: device.hostname,
        ip: device.ip,
        pairedAt: Date.now()
      });
      this.store.set('pairedDevices', devices);
    }
  }

  removePairedDevice(deviceId) {
    const devices = this.getPairedDevices();
    this.store.set('pairedDevices', devices.filter(d => d.id !== deviceId));
  }
}

module.exports = Storage;
