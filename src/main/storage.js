const path = require('path');
const os = require('os');

let Store;
try {
  Store = require('electron-store');
} catch (e) {
  Store = null;
}

class Storage {
  constructor() {
    if (Store) {
      try {
        this.store = new Store({
          name: 'quickbeam-data',
          defaults: {
            settings: {
              hostname: os.hostname(),
              downloadPath: path.join(os.homedir(), 'Downloads', 'QuickBeam'),
              theme: 'dark',
              port: 58586,
              autoAccept: false,
              maxConcurrentTransfers: 3
            },
            transferHistory: [],
            pairedDevices: []
          }
        });
      } catch (e) {
        console.error('Store init error:', e);
        this.store = null;
      }
    } else {
      this.store = null;
    }

    this.defaults = {
      hostname: os.hostname(),
      downloadPath: path.join(os.homedir(), 'Downloads', 'QuickBeam'),
      theme: 'dark',
      port: 58586,
      autoAccept: false,
      maxConcurrentTransfers: 3
    };

    this.memoryHistory = [];
    this.memoryPairedDevices = [];
  }

  getSettings() {
    if (this.store) {
      try {
        return this.store.get('settings');
      } catch (e) {
        return { ...this.defaults };
      }
    }
    return { ...this.defaults };
  }

  updateSettings(newSettings) {
    const current = this.getSettings();
    const updated = { ...current, ...newSettings };

    if (this.store) {
      try {
        this.store.set('settings', updated);
      } catch (e) {
        console.error('Save settings error:', e);
      }
    }
  }

  getTransferHistory() {
    if (this.store) {
      try {
        return this.store.get('transferHistory');
      } catch (e) {
        return this.memoryHistory;
      }
    }
    return this.memoryHistory;
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

    if (this.store) {
      try {
        this.store.set('transferHistory', history);
      } catch (e) {
        this.memoryHistory = history;
      }
    } else {
      this.memoryHistory = history;
    }
  }

  clearTransferHistory() {
    if (this.store) {
      try {
        this.store.set('transferHistory', []);
      } catch (e) {
        this.memoryHistory = [];
      }
    } else {
      this.memoryHistory = [];
    }
  }

  getPairedDevices() {
    if (this.store) {
      try {
        return this.store.get('pairedDevices');
      } catch (e) {
        return this.memoryPairedDevices;
      }
    }
    return this.memoryPairedDevices;
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

      if (this.store) {
        try {
          this.store.set('pairedDevices', devices);
        } catch (e) {
          this.memoryPairedDevices = devices;
        }
      } else {
        this.memoryPairedDevices = devices;
      }
    }
  }

  removePairedDevice(deviceId) {
    const devices = this.getPairedDevices().filter(d => d.id !== deviceId);

    if (this.store) {
      try {
        this.store.set('pairedDevices', devices);
      } catch (e) {
        this.memoryPairedDevices = devices;
      }
    } else {
      this.memoryPairedDevices = devices;
    }
  }
}

module.exports = Storage;
