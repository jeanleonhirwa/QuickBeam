const App = {
  state: {
    currentView: 'devices',
    theme: 'dark',
    devices: [],
    selectedDevice: null,
    selectedFiles: [],
    transfers: [],
    pairingRequest: null,
    isScanning: false
  },

  init() {
    this.cacheElements();
    this.loadSettings();
    this.bindEvents();
    this.bindIPC();
  },

  cacheElements() {
    this.els = {
      btnMinimize: document.getElementById('btn-minimize'),
      btnMaximize: document.getElementById('btn-maximize'),
      btnClose: document.getElementById('btn-close'),
      btnScan: document.getElementById('btn-scan'),
      btnSend: document.getElementById('btn-send'),
      btnHistory: document.getElementById('btn-history'),
      btnSettings: document.getElementById('btn-settings'),
      btnTheme: document.getElementById('btn-theme'),
      themeIcon: document.getElementById('theme-icon'),
      themeStylesheet: document.getElementById('theme-stylesheet'),
      pageTitle: document.getElementById('page-title'),
      pageSubtitle: document.getElementById('page-subtitle'),
      deviceList: document.getElementById('device-list'),
      emptyDevices: document.getElementById('empty-devices'),
      statSent: document.getElementById('stat-sent'),
      statReceived: document.getElementById('stat-received'),
      statDevices: document.getElementById('stat-devices'),
      percentValue: document.getElementById('percent-value'),
      progressRing: document.getElementById('progress-ring'),
      views: {
        devices: document.getElementById('view-devices'),
        pairing: document.getElementById('view-pairing'),
        files: document.getElementById('view-files'),
        transfer: document.getElementById('view-transfer'),
        history: document.getElementById('view-history'),
        settings: document.getElementById('view-settings')
      },
      pairingHostname: document.getElementById('pairing-hostname'),
      btnPairAccept: document.getElementById('btn-pair-accept'),
      btnPairReject: document.getElementById('btn-pair-reject'),
      selectedFiles: document.getElementById('selected-files'),
      btnAddFiles: document.getElementById('btn-add-files'),
      btnAddFolder: document.getElementById('btn-add-folder'),
      btnStartTransfer: document.getElementById('btn-start-transfer'),
      transferFilename: document.getElementById('transfer-filename'),
      transferSize: document.getElementById('transfer-size'),
      transferProgress: document.getElementById('transfer-progress'),
      transferSpeed: document.getElementById('transfer-speed'),
      transferEta: document.getElementById('transfer-eta'),
      btnCancelTransfer: document.getElementById('btn-cancel-transfer'),
      historyList: document.getElementById('history-list'),
      settingHostname: document.getElementById('setting-hostname'),
      settingDownloadPath: document.getElementById('setting-download-path'),
      settingPort: document.getElementById('setting-port'),
      settingAutoAccept: document.getElementById('setting-auto-accept'),
      btnChangePath: document.getElementById('btn-change-path'),
      btnSaveSettings: document.getElementById('btn-save-settings')
    };
  },

  bindEvents() {
    this.els.btnMinimize.addEventListener('click', () => window.quickbeam.window.minimize());
    this.els.btnMaximize.addEventListener('click', () => window.quickbeam.window.maximize());
    this.els.btnClose.addEventListener('click', () => window.quickbeam.window.close());

    this.els.btnScan.addEventListener('click', () => this.toggleScan());
    this.els.btnSend.addEventListener('click', () => this.showView('files'));
    this.els.btnHistory.addEventListener('click', () => this.showHistory());
    this.els.btnSettings.addEventListener('click', () => this.showSettings());

    this.els.btnTheme.addEventListener('click', () => this.toggleTheme());

    this.els.btnPairAccept.addEventListener('click', () => this.acceptPairing());
    this.els.btnPairReject.addEventListener('click', () => this.rejectPairing());

    this.els.btnAddFiles.addEventListener('click', () => this.addFiles());
    this.els.btnAddFolder.addEventListener('click', () => this.addFolder());
    this.els.btnStartTransfer.addEventListener('click', () => this.startTransfer());
    this.els.btnCancelTransfer.addEventListener('click', () => this.cancelTransfer());

    this.els.btnChangePath.addEventListener('click', () => this.changeDownloadPath());
    this.els.btnSaveSettings.addEventListener('click', () => this.saveSettings());

    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        this.toggleScan();
      }
    });
  },

  bindIPC() {
    window.quickbeam.devices.onFound((device) => this.onDeviceFound(device));
    window.quickbeam.devices.onLost((deviceId) => this.onDeviceLost(deviceId));

    window.quickbeam.pair.onRequest((request) => this.onPairRequest(request));
    window.quickbeam.pair.onAccepted((device) => this.onPairAccepted(device));
    window.quickbeam.pair.onRejected((deviceId) => this.onPairRejected(deviceId));

    window.quickbeam.transfer.onRequest((request) => this.onTransferRequest(request));
    window.quickbeam.transfer.onProgress((progress) => this.onTransferProgress(progress));
    window.quickbeam.transfer.onComplete((transfer) => this.onTransferComplete(transfer));
    window.quickbeam.transfer.onFailed((error) => this.onTransferFailed(error));
  },

  async loadSettings() {
    const settings = await window.quickbeam.settings.get();
    this.state.theme = settings.theme || 'dark';
    this.applyTheme(this.state.theme);

    this.els.settingHostname.value = settings.hostname || '';
    this.els.settingDownloadPath.value = settings.downloadPath || '';
    this.els.settingPort.value = settings.port || 58586;
    this.els.settingAutoAccept.checked = settings.autoAccept || false;
  },

  showView(viewName) {
    this.state.currentView = viewName;
    
    Object.values(this.els.views).forEach(v => v.classList.add('hidden'));
    this.els.views[viewName].classList.remove('hidden');

    const titles = {
      devices: 'Devices',
      pairing: 'Pairing Request',
      files: 'Send Files',
      transfer: 'Transfer',
      history: 'History',
      settings: 'Settings'
    };

    const subtitles = {
      devices: this.state.isScanning ? 'Scanning for nearby devices...' : 'Click "Scan Devices" to find nearby QuickBeam users',
      pairing: 'Connection request received',
      files: 'Select files to send',
      transfer: 'Transferring files...',
      history: 'Your transfer history',
      settings: 'Configure QuickBeam'
    };

    this.els.pageTitle.textContent = titles[viewName];
    this.els.pageSubtitle.textContent = subtitles[viewName];

    document.querySelectorAll('.action-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = {
      devices: this.els.btnScan,
      files: this.els.btnSend,
      history: this.els.btnHistory,
      settings: this.els.btnSettings
    }[viewName];
    if (activeBtn) activeBtn.classList.add('active');
  },

  async toggleScan() {
    if (this.state.isScanning) {
      await window.quickbeam.devices.stopScan();
      this.state.isScanning = false;
      this.els.btnScan.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
        </svg>
        Scan Devices
      `;
    } else {
      await window.quickbeam.devices.startScan();
      this.state.isScanning = true;
      this.els.btnScan.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="6" y="6" width="12" height="12"/>
        </svg>
        Stop Scan
      `;
    }
    this.showView('devices');
  },

  onDeviceFound(device) {
    if (!this.state.devices.find(d => d.id === device.id)) {
      this.state.devices.push(device);
      this.renderDeviceList();
      this.updateStats();
    }
  },

  onDeviceLost(deviceId) {
    this.state.devices = this.state.devices.filter(d => d.id !== deviceId);
    this.renderDeviceList();
    this.updateStats();
  },

  renderDeviceList() {
    if (this.state.devices.length === 0) {
      this.els.deviceList.innerHTML = '';
      this.els.deviceList.appendChild(this.createEmptyDevices());
      return;
    }

    this.els.deviceList.innerHTML = this.state.devices.map(device => `
      <div class="device-card" data-id="${device.id}">
        <div class="device-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="2" y="3" width="20" height="14" rx="2"/>
            <path d="M8 21H16M12 17V21"/>
          </svg>
        </div>
        <div class="device-info">
          <div class="device-name">${device.hostname}</div>
          <div class="device-ip">${device.ip}</div>
        </div>
        <span class="device-status ${device.status === 'paired' ? 'paired' : ''}">${device.status}</span>
        <div class="device-actions">
          ${device.status === 'paired' 
            ? `<button class="btn btn-primary btn-connect" data-id="${device.id}">Connect</button>`
            : `<button class="btn btn-secondary btn-pair" data-id="${device.id}">Pair</button>`
          }
        </div>
      </div>
    `).join('');

    this.els.deviceList.querySelectorAll('.btn-pair').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.pairDevice(btn.dataset.id);
      });
    });

    this.els.deviceList.querySelectorAll('.btn-connect').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.connectDevice(btn.dataset.id);
      });
    });
  },

  createEmptyDevices() {
    const div = document.createElement('div');
    div.className = 'empty-state';
    div.id = 'empty-devices';
    div.innerHTML = `
      <div class="scan-animation">
        <div class="pulse-ring"></div>
        <div class="pulse-ring delay-1"></div>
        <div class="pulse-ring delay-2"></div>
        <svg class="scan-icon" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
        </svg>
      </div>
      <p>Click "Scan Devices" to find nearby QuickBeam users</p>
    `;
    return div;
  },

  async pairDevice(deviceId) {
    await window.quickbeam.pair.request(deviceId);
    this.els.pageSubtitle.textContent = 'Pairing request sent...';
  },

  connectDevice(deviceId) {
    this.state.selectedDevice = deviceId;
    this.showView('files');
  },

  onPairRequest(request) {
    this.state.pairingRequest = request;
    this.els.pairingHostname.textContent = request.hostname;
    this.showView('pairing');
  },

  onPairAccepted(device) {
    const dev = this.state.devices.find(d => d.id === device.deviceId);
    if (dev) {
      dev.status = 'paired';
      this.renderDeviceList();
    }
    this.els.pageSubtitle.textContent = `Connected to ${device.hostname}`;
  },

  onPairRejected(deviceId) {
    this.els.pageSubtitle.textContent = 'Pairing rejected';
  },

  async acceptPairing() {
    if (this.state.pairingRequest) {
      await window.quickbeam.pair.accept(this.state.pairingRequest.id);
      this.state.pairingRequest = null;
      this.showView('devices');
    }
  },

  async rejectPairing() {
    if (this.state.pairingRequest) {
      await window.quickbeam.pair.reject(this.state.pairingRequest.id);
      this.state.pairingRequest = null;
      this.showView('devices');
    }
  },

  async addFiles() {
    const files = await window.quickbeam.dialog.openFiles();
    if (files.length > 0) {
      this.state.selectedFiles = [...this.state.selectedFiles, ...files];
      this.renderSelectedFiles();
    }
  },

  async addFolder() {
    const folder = await window.quickbeam.dialog.openFolder();
    if (folder) {
      this.state.selectedFiles.push(folder);
      this.renderSelectedFiles();
    }
  },

  renderSelectedFiles() {
    if (this.state.selectedFiles.length === 0) {
      this.els.selectedFiles.innerHTML = `
        <div class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M13 2H6C4.89543 2 4 2.89543 4 4V20C4 21.1046 4.89543 22 6 22H18C19.1046 22 20 21.1046 20 20V9L13 2Z"/>
            <path d="M13 2V9H20"/>
          </svg>
          <p>No files selected</p>
          <button class="btn btn-secondary" id="btn-add-files">Add Files</button>
          <button class="btn btn-secondary" id="btn-add-folder">Add Folder</button>
        </div>
      `;
      document.getElementById('btn-add-files').addEventListener('click', () => this.addFiles());
      document.getElementById('btn-add-folder').addEventListener('click', () => this.addFolder());
      return;
    }

    this.els.selectedFiles.innerHTML = this.state.selectedFiles.map((file, index) => {
      const name = file.split(/[/\\]/).pop();
      const isFolder = !name.includes('.');
      return `
        <div class="file-item">
          <div class="file-icon">
            ${isFolder 
              ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 19C22 20.1046 21.1046 21 20 21H4C2.89543 21 2 20.1046 2 19V5C2 3.89543 2.89543 3 4 3H9L11 6H20C21.1046 6 22 6.89543 22 8V19Z"/></svg>'
              : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6C4.89543 2 4 2.89543 4 4V20C4 21.1046 4.89543 22 6 22H18C19.1046 22 20 21.1046 20 20V8L14 2Z"/><path d="M14 2V8H20"/></svg>'
            }
          </div>
          <div class="file-info">
            <div class="file-name">${name}</div>
            <div class="file-size">${isFolder ? 'Folder' : 'File'}</div>
          </div>
          <button class="file-remove" data-index="${index}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6L18 18"/>
            </svg>
          </button>
        </div>
      `;
    }).join('');

    this.els.selectedFiles.querySelectorAll('.file-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        this.state.selectedFiles.splice(parseInt(btn.dataset.index), 1);
        this.renderSelectedFiles();
      });
    });
  },

  async startTransfer() {
    if (!this.state.selectedDevice || this.state.selectedFiles.length === 0) {
      return;
    }

    const result = await window.quickbeam.transfer.send(this.state.selectedDevice, this.state.selectedFiles);
    if (result.success) {
      this.showView('transfer');
      this.state.currentTransfer = result.transferId;
    }
  },

  onTransferRequest(request) {
    this.state.pendingTransfer = request;
    this.showView('pairing');
    this.els.pairingHostname.textContent = `${request.hostname} wants to send you ${request.files.length} file(s)`;
  },

  async acceptTransfer() {
    if (this.state.pendingTransfer) {
      await window.quickbeam.transfer.accept(this.state.pendingTransfer.id);
      this.state.pendingTransfer = null;
      this.showView('transfer');
    }
  },

  async rejectTransfer() {
    if (this.state.pendingTransfer) {
      await window.quickbeam.transfer.reject(this.state.pendingTransfer.id);
      this.state.pendingTransfer = null;
      this.showView('devices');
    }
  },

  onTransferProgress(progress) {
    const percent = Math.round((progress.bytesTransferred / progress.totalSize) * 100);
    
    this.els.transferFilename.textContent = progress.fileName;
    this.els.transferSize.textContent = `${this.formatBytes(progress.bytesTransferred)} / ${this.formatBytes(progress.totalSize)}`;
    this.els.transferProgress.style.width = `${percent}%`;
    this.els.transferSpeed.textContent = `${this.formatBytes(progress.speed)}/s`;
    
    const remaining = (progress.totalSize - progress.bytesTransferred) / progress.speed;
    this.els.transferEta.textContent = remaining > 0 ? `ETA: ${this.formatDuration(remaining)}` : 'Almost done...';

    const circumference = 283;
    const offset = circumference - (percent / 100) * circumference;
    this.els.progressRing.style.strokeDashoffset = offset;
    this.els.percentValue.textContent = percent;
  },

  onTransferComplete(transfer) {
    this.els.transferProgress.style.width = '100%';
    this.els.percentValue.textContent = '100';
    this.els.transferSpeed.textContent = 'Complete!';
    this.els.transferEta.textContent = '';
    
    setTimeout(() => {
      this.showView('devices');
      this.state.selectedFiles = [];
      this.updateStats();
    }, 2000);
  },

  onTransferFailed(error) {
    this.els.transferSpeed.textContent = 'Failed';
    this.els.transferEta.textContent = error.error || 'Transfer failed';
    
    setTimeout(() => {
      this.showView('devices');
    }, 3000);
  },

  async cancelTransfer() {
    if (this.state.currentTransfer) {
      await window.quickbeam.transfer.cancel(this.state.currentTransfer);
      this.showView('devices');
    }
  },

  async showHistory() {
    const history = await window.quickbeam.history.get();
    
    if (history.length === 0) {
      this.els.historyList.innerHTML = `
        <div class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="12" r="10"/><path d="M12 6V12L16 14"/>
          </svg>
          <p>No transfer history yet</p>
        </div>
      `;
    } else {
      this.els.historyList.innerHTML = history.map(item => `
        <div class="history-item">
          <div class="history-icon ${item.type}">
            ${item.type === 'sent' 
              ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13"/><path d="M22 2L15 22L11 13L2 9L22 2Z"/></svg>'
              : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15V19C21 20.1046 20.1046 21 19 21H5C3.89543 21 3 20.1046 3 19V15"/><path d="M7 10L12 15L17 10"/><path d="M12 15V3"/></svg>'
            }
          </div>
          <div class="history-info">
            <div class="history-title">${item.files.map(f => f.name).join(', ')}</div>
            <div class="history-meta">${this.formatBytes(item.totalSize)} • ${new Date(item.timestamp).toLocaleDateString()}</div>
          </div>
          <span class="history-status ${item.status}">${item.status}</span>
        </div>
      `).join('');
    }

    this.showView('history');
  },

  async showSettings() {
    const settings = await window.quickbeam.settings.get();
    this.els.settingHostname.value = settings.hostname || '';
    this.els.settingDownloadPath.value = settings.downloadPath || '';
    this.els.settingPort.value = settings.port || 58586;
    this.els.settingAutoAccept.checked = settings.autoAccept || false;
    this.showView('settings');
  },

  async saveSettings() {
    const settings = {
      hostname: this.els.settingHostname.value,
      downloadPath: this.els.settingDownloadPath.value,
      port: parseInt(this.els.settingPort.value),
      autoAccept: this.els.settingAutoAccept.checked
    };
    await window.quickbeam.settings.set(settings);
    this.els.pageSubtitle.textContent = 'Settings saved!';
    setTimeout(() => {
      this.els.pageSubtitle.textContent = 'Configure QuickBeam';
    }, 2000);
  },

  async changeDownloadPath() {
    const path = await window.quickbeam.dialog.selectFolder();
    if (path) {
      this.els.settingDownloadPath.value = path;
    }
  },

  toggleTheme() {
    this.state.theme = this.state.theme === 'dark' ? 'light' : 'dark';
    this.applyTheme(this.state.theme);
    window.quickbeam.settings.set({ theme: this.state.theme });
  },

  applyTheme(theme) {
    this.els.themeStylesheet.href = `styles/${theme}.css`;
    this.els.themeIcon.textContent = theme === 'dark' ? '☀' : '☾';
  },

  updateStats() {
    this.els.statDevices.textContent = this.state.devices.length;
  },

  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  },

  formatDuration(seconds) {
    if (seconds < 60) return `${Math.ceil(seconds)}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.ceil(seconds % 60)}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
