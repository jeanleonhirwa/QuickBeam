const { contextBridge, ipcRenderer } = require('electron');

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
    onFound: (callback) => ipcRenderer.on('device-found', (event, device) => callback(device)),
    onLost: (callback) => ipcRenderer.on('device-lost', (event, deviceId) => callback(deviceId))
  },

  pair: {
    request: (deviceId) => ipcRenderer.invoke('pair:request', deviceId),
    accept: (requestId) => ipcRenderer.invoke('pair:accept', requestId),
    reject: (requestId) => ipcRenderer.invoke('pair:reject', requestId),
    onRequest: (callback) => ipcRenderer.on('pair-request', (event, request) => callback(request)),
    onAccepted: (callback) => ipcRenderer.on('pair-accepted', (event, device) => callback(device)),
    onRejected: (callback) => ipcRenderer.on('pair-rejected', (event, deviceId) => callback(deviceId))
  },

  transfer: {
    send: (deviceId, files) => ipcRenderer.invoke('transfer:send', { deviceId, files }),
    accept: (transferId) => ipcRenderer.invoke('transfer:accept', transferId),
    reject: (transferId) => ipcRenderer.invoke('transfer:reject', transferId),
    cancel: (transferId) => ipcRenderer.invoke('transfer:cancel', transferId),
    onRequest: (callback) => ipcRenderer.on('transfer-request', (event, request) => callback(request)),
    onProgress: (callback) => ipcRenderer.on('transfer-progress', (event, progress) => callback(progress)),
    onComplete: (callback) => ipcRenderer.on('transfer-complete', (event, transfer) => callback(transfer)),
    onFailed: (callback) => ipcRenderer.on('transfer-failed', (event, error) => callback(error))
  },

  history: {
    get: () => ipcRenderer.invoke('history:get'),
    clear: () => ipcRenderer.invoke('history:clear')
  },

  dialog: {
    openFiles: () => ipcRenderer.invoke('dialog:openFiles'),
    openFolder: () => ipcRenderer.invoke('dialog:openFolder'),
    selectFolder: () => ipcRenderer.invoke('dialog:selectFolder')
  }
});
