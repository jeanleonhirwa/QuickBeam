const { contextBridge, ipcRenderer } = require('electron');

function onChannel(channel, callback) {
  ipcRenderer.removeAllListeners(channel);
  ipcRenderer.on(channel, (event, ...args) => callback(...args));
}

contextBridge.exposeInMainWorld('quickbeam', {
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close')
  },

  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (settings) => ipcRenderer.invoke('settings:set', settings)
  },

  devices: {
    startScan: () => ipcRenderer.invoke('devices:startScan'),
    stopScan: () => ipcRenderer.invoke('devices:stopScan'),
    getList: () => ipcRenderer.invoke('devices:getList'),
    onFound: (callback) => onChannel('device-found', callback),
    onLost: (callback) => onChannel('device-lost', callback)
  },

  pair: {
    request: (deviceId) => ipcRenderer.invoke('pair:request', deviceId),
    accept: (requestId) => ipcRenderer.invoke('pair:accept', requestId),
    reject: (requestId) => ipcRenderer.invoke('pair:reject', requestId),
    onRequest: (callback) => onChannel('pair-request', callback),
    onAccepted: (callback) => onChannel('pair-accepted', callback),
    onRejected: (callback) => onChannel('pair-rejected', callback)
  },

  transfer: {
    send: (deviceId, files) => ipcRenderer.invoke('transfer:send', { deviceId, files }),
    accept: (transferId) => ipcRenderer.invoke('transfer:accept', transferId),
    reject: (transferId) => ipcRenderer.invoke('transfer:reject', transferId),
    cancel: (transferId) => ipcRenderer.invoke('transfer:cancel', transferId),
    getQueue: () => ipcRenderer.invoke('transfer:getQueue'),
    retry: (transferId) => ipcRenderer.invoke('transfer:retry', transferId),
    onRequest: (callback) => onChannel('transfer-request', callback),
    onProgress: (callback) => onChannel('transfer-progress', callback),
    onComplete: (callback) => onChannel('transfer-complete', callback),
    onFailed: (callback) => onChannel('transfer-failed', callback)
  },

  connection: {
    quality: (deviceId) => ipcRenderer.invoke('connection:quality', deviceId)
  },

  files: {
    drop: (filePaths) => ipcRenderer.invoke('files:drop', filePaths)
  },

  dialog: {
    openFiles: () => ipcRenderer.invoke('dialog:openFiles'),
    openFolder: () => ipcRenderer.invoke('dialog:openFolder'),
    selectFolder: () => ipcRenderer.invoke('dialog:selectFolder')
  },

  history: {
    get: () => ipcRenderer.invoke('history:get'),
    clear: () => ipcRenderer.invoke('history:clear')
  },

  wifi: {
    supported: () => ipcRenderer.invoke('wifi:supported'),
    host: () => ipcRenderer.invoke('wifi:host'),
    join: (ssid, password) => ipcRenderer.invoke('wifi:join', { ssid, password }),
    status: () => ipcRenderer.invoke('wifi:status'),
    cleanup: () => ipcRenderer.invoke('wifi:cleanup'),
    stop: () => ipcRenderer.invoke('wifi:stop'),
    onSupported: (callback) => onChannel('wifi:supportedEvent', callback),
    onNetworkReady: (callback) => onChannel('wifi:networkReady', callback),
    onConnected: (callback) => onChannel('wifi:connected', callback),
    onDisconnected: (callback) => onChannel('wifi:disconnected', callback)
  }
});
