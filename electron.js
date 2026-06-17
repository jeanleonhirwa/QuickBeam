const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const NetworkManager = require('./src/main/network');
const TransferEngine = require('./src/main/transfer');
const Storage = require('./src/main/storage');

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
  storage = new Storage();
  networkManager = new NetworkManager(storage.getSettings());
  transferEngine = new TransferEngine(storage);

  networkManager.on('deviceFound', (device) => {
    mainWindow?.webContents.send('device-found', device);
  });

  networkManager.on('deviceLost', (deviceId) => {
    mainWindow?.webContents.send('device-lost', deviceId);
  });

  networkManager.on('pairRequest', (request) => {
    mainWindow?.webContents.send('pair-request', request);
  });

  networkManager.on('pairAccepted', (device) => {
    mainWindow?.webContents.send('pair-accepted', device);
  });

  networkManager.on('pairRejected', (deviceId) => {
    mainWindow?.webContents.send('pair-rejected', deviceId);
  });

  networkManager.on('transferRequest', (request) => {
    mainWindow?.webContents.send('transfer-request', request);
  });

  transferEngine.on('transferProgress', (progress) => {
    mainWindow?.webContents.send('transfer-progress', progress);
  });

  transferEngine.on('transferComplete', (transfer) => {
    mainWindow?.webContents.send('transfer-complete', transfer);
    storage.addTransferHistory(transfer);
  });

  transferEngine.on('transferFailed', (error) => {
    mainWindow?.webContents.send('transfer-failed', error);
  });
}

function setupIPC() {
  ipcMain.handle('window:minimize', () => mainWindow?.minimize());
  ipcMain.handle('window: maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });
  ipcMain.handle('window:close', () => mainWindow?.close());

  ipcMain.handle('settings:get', () => storage.getSettings());
  ipcMain.handle('settings:set', (event, settings) => {
    storage.updateSettings(settings);
    networkManager.updateSettings(storage.getSettings());
  });

  ipcMain.handle('devices:startScan', () => networkManager.startDiscovery());
  ipcMain.handle('devices:stopScan', () => networkManager.stopDiscovery());
  ipcMain.handle('devices:getList', () => networkManager.getDevices());

  ipcMain.handle('pair:request', (event, deviceId) => networkManager.requestPair(deviceId));
  ipcMain.handle('pair:accept', (event, requestId) => networkManager.acceptPair(requestId));
  ipcMain.handle('pair:reject', (event, requestId) => networkManager.rejectPair(requestId));

  ipcMain.handle('transfer:send', async (event, { deviceId, files }) => {
    return transferEngine.startTransfer(deviceId, files);
  });
  ipcMain.handle('transfer:accept', (event, transferId) => transferEngine.acceptTransfer(transferId));
  ipcMain.handle('transfer:reject', (event, transferId) => transferEngine.rejectTransfer(transferId));
  ipcMain.handle('transfer:cancel', (event, transferId) => transferEngine.cancelTransfer(transferId));

  ipcMain.handle('history:get', () => storage.getTransferHistory());
  ipcMain.handle('history:clear', () => storage.clearTransferHistory());

  ipcMain.handle('dialog:openFiles', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile', 'multiSelections']
    });
    return result.filePaths;
  });

  ipcMain.handle('dialog:openFolder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    });
    return result.filePaths[0];
  });

  ipcMain.handle('dialog:selectFolder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    });
    return result.filePaths[0];
  });
}

app.whenReady().then(() => {
  createWindow();
  initializeServices();
  setupIPC();
  networkManager.start();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  networkManager?.stop();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  networkManager?.stop();
});
