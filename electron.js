const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');

let mainWindow;
let networkManager;
let transferEngine;
let storage;

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
  transferEngine = new TransferEngine(storage);

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
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('transfer-request', request);
    }
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
  });

  transferEngine.on('transferFailed', (error) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('transfer-failed', error);
    }
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

app.on('before-quit', () => {
  if (networkManager) {
    try { networkManager.stop(); } catch (e) {}
  }
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});
