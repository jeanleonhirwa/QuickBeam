const { app, BrowserWindow, ipcMain, dialog, Notification } = require('electron');
const path = require('path');

let mainWindow;
let networkManager;
let transferEngine;
let storage;
let wifiDirect;

function sendNotification(title, body) {
  if (Notification.isSupported()) {
    new Notification({ title, body }).show();
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    backgroundColor: '#1E1E1E',
    icon: path.join(__dirname, 'src/renderer/assets/icons/icon.png')
  });

  mainWindow.loadFile('src/renderer/index.html');

  mainWindow.webContents.on('will-navigate', (e) => e.preventDefault());

  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function initializeServices() {
  const Storage = require('./src/main/storage');
  storage = new Storage();

  const NetworkManager = require('./src/main/network');
  networkManager = new NetworkManager(storage.getSettings());

  const TransferEngine = require('./src/main/transfer');
  transferEngine = new TransferEngine(storage, networkManager);

  networkManager.on('deviceFound', (device) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('device-found', device);
    }
  });

  networkManager.on('deviceLost', (deviceId) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('device-lost', deviceId);
    }
  });

  networkManager.on('pairRequest', (request) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('pair-request', request);
    }
    sendNotification('Pairing Request', `${request.hostname} wants to connect`);
  });

  networkManager.on('pairAccepted', (device) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('pair-accepted', device);
    }
  });

  networkManager.on('pairRejected', (deviceId) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('pair-rejected', deviceId);
    }
  });

  networkManager.on('transferRequest', (request) => {
    transferEngine.handleIncomingTransfer(request, request.socket);
  });

  transferEngine.on('transferProgress', (progress) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('transfer-progress', progress);
    }
  });

  transferEngine.on('transferComplete', (transfer) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('transfer-complete', transfer);
    }
    storage.addTransferHistory(transfer);
    const fileCount = transfer.files.length;
    sendNotification('Transfer Complete', `${fileCount} file(s) transferred successfully`);
  });

  transferEngine.on('transferFailed', (error) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('transfer-failed', error);
    }
  });

  transferEngine.on('transferRequest', (request) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('transfer-request', request);
    }
    const fileCount = request.files ? request.files.length : 0;
    sendNotification('Incoming Transfer', `${request.hostname} wants to send ${fileCount} file(s)`);
  });

  // Initialize WiFi Direct
  const WifiDirectManager = require('./src/main/wifi-direct');
  wifiDirect = new WifiDirectManager(storage);

  wifiDirect.on('networkReady', (info) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('wifi:networkReady', info);
    }
    sendNotification('Room Created', `Share code: ${info.ssid}`);
  });

  wifiDirect.on('connected', (info) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('wifi:connected', info);
    }
  });

  wifiDirect.on('disconnected', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('wifi:disconnected');
    }
  });

  wifiDirect.initialize().then(supported => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('wifi:supported', supported);
    }
  }).catch(err => {
    console.error('WiFi Direct init error:', err);
  });
}

function setupIPC() {
  ipcMain.handle('window:minimize', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.minimize();
    }
  });

  ipcMain.handle('window:maximize', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
    }
  });

  ipcMain.handle('window:close', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.close();
    }
  });

  ipcMain.handle('settings:get', () => {
    return storage ? storage.getSettings() : {};
  });

  ipcMain.handle('settings:set', (event, settings) => {
    if (storage && networkManager) {
      storage.updateSettings(settings);
      networkManager.updateSettings(storage.getSettings());
    }
  });

  ipcMain.handle('devices:startScan', () => {
    if (networkManager) {
      networkManager.startDiscovery();
    }
  });

  ipcMain.handle('devices:stopScan', () => {
    if (networkManager) {
      networkManager.stopDiscovery();
    }
  });

  ipcMain.handle('devices:getList', () => {
    return networkManager ? networkManager.getDevices() : [];
  });

  ipcMain.handle('pair:request', (event, deviceId) => {
    return networkManager ? networkManager.requestPair(deviceId) : { success: false };
  });

  ipcMain.handle('pair:accept', (event, requestId) => {
    return networkManager ? networkManager.acceptPair(requestId) : { success: false };
  });

  ipcMain.handle('pair:reject', (event, requestId) => {
    return networkManager ? networkManager.rejectPair(requestId) : { success: false };
  });

  ipcMain.handle('transfer:send', async (event, { deviceId, files }) => {
    return transferEngine ? transferEngine.startTransfer(deviceId, files) : { success: false };
  });

  ipcMain.handle('transfer:accept', (event, transferId) => {
    return transferEngine ? transferEngine.acceptTransfer(transferId) : { success: false };
  });

  ipcMain.handle('transfer:reject', (event, transferId) => {
    return transferEngine ? transferEngine.rejectTransfer(transferId) : { success: false };
  });

  ipcMain.handle('transfer:cancel', (event, transferId) => {
    return transferEngine ? transferEngine.cancelTransfer(transferId) : { success: false };
  });

  ipcMain.handle('history:get', () => {
    return storage ? storage.getTransferHistory() : [];
  });

  ipcMain.handle('history:clear', () => {
    if (storage) {
      storage.clearTransferHistory();
    }
  });

  ipcMain.handle('dialog:openFiles', async () => {
    if (!mainWindow || mainWindow.isDestroyed()) return [];
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile', 'multiSelections']
    });
    return result.canceled ? [] : result.filePaths;
  });

  ipcMain.handle('dialog:openFolder', async () => {
    if (!mainWindow || mainWindow.isDestroyed()) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle('dialog:selectFolder', async () => {
    if (!mainWindow || mainWindow.isDestroyed()) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle('transfer:getQueue', () => {
    return transferEngine ? transferEngine.getQueue() : [];
  });

  ipcMain.handle('transfer:retry', (event, transferId) => {
    return transferEngine ? transferEngine.retryTransfer(transferId) : { success: false };
  });

  ipcMain.handle('connection:quality', (event, deviceId) => {
    return networkManager ? networkManager.getConnectionQuality(deviceId) : { quality: 0 };
  });

  ipcMain.handle('files:drop', (event, filePaths) => {
    return filePaths || [];
  });

  // WiFi Direct handlers
  ipcMain.handle('wifi:supported', async () => {
    if (!wifiDirect) return false;
    return wifiDirect.hostedNetworkSupported;
  });

  ipcMain.handle('wifi:host', async () => {
    if (!wifiDirect) return { success: false, error: 'WiFi Direct not initialized' };
    try {
      const info = await wifiDirect.hostNetwork();
      return { success: true, info };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('wifi:join', async (event, { ssid, password }) => {
    if (!wifiDirect) return { success: false, error: 'WiFi Direct not initialized' };
    try {
      const info = await wifiDirect.joinNetwork(ssid, password);
      return { success: true, info };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('wifi:status', async () => {
    if (!wifiDirect) return { supported: false, isHost: false, isConnected: false };
    return {
      supported: wifiDirect.hostedNetworkSupported,
      isHost: wifiDirect.isHost,
      isConnected: wifiDirect.isConnected,
      ssid: wifiDirect.ssid,
      connectionInfo: wifiDirect.connectionInfo
    };
  });

  ipcMain.handle('wifi:cleanup', async () => {
    if (wifiDirect) {
      await wifiDirect.cleanup();
    }
  });

  ipcMain.handle('wifi:stop', async () => {
    if (wifiDirect) {
      await wifiDirect.cleanup();
    }
  });
}

app.whenReady().then(() => {
  createWindow();
  initializeServices();
  setupIPC();

  try {
    networkManager.start();
  } catch (err) {
    console.error('Network manager start error:', err);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (networkManager) {
    try { networkManager.stop(); } catch (e) {}
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async () => {
  if (wifiDirect) {
    try { await wifiDirect.cleanup(); } catch (e) {}
  }
  if (networkManager) {
    try { networkManager.stop(); } catch (e) {}
  }
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});
