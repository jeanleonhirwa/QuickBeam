const App = {
  state: {
    currentView: 'connect',
    theme: 'dark',
    devices: [],
    selectedDevice: null,
    selectedFiles: [],
    transfers: [],
    pairingRequest: null,
    pendingTransfer: null,
    currentTransfer: null,
    isScanning: false,
    isHosting: false,
    isJoining: false,
    wifiSupported: false,
    wifiInfo: null,
    transferQueue: []
  },

  init() {
    this.cacheElements();
    this.loadSettings();
    this.bindEvents();
    this.bindIPC();
    this.initDragDrop();
  },

  cacheElements() {
    this.els = {
      btnMinimize: document.getElementById('btn-minimize'),
      btnMaximize: document.getElementById('btn-maximize'),
      btnClose: document.getElementById('btn-close'),
      btnCreateRoom: document.getElementById('btn-create-room'),
      btnCreateRoomMain: document.getElementById('btn-create-room-main'),
      btnJoinRoom: document.getElementById('btn-join-room'),
      btnJoinRoomMain: document.getElementById('btn-join-room-main'),
      btnCopyCode: document.getElementById('btn-copy-code'),
      btnStopRoom: document.getElementById('btn-stop-room'),
      btnJoinConnect: document.getElementById('btn-join-connect'),
      btnBackConnect: document.getElementById('btn-back-connect'),
      roomCode: document.getElementById('room-code'),
      roomPassword: document.getElementById('room-password'),
      inputRoomCode: document.getElementById('input-room-code'),
      inputRoomPassword: document.getElementById('input-room-password'),
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
        connect: document.getElementById('view-connect'),
        host: document.getElementById('view-host'),
        join: document.getElementById('view-join'),
        devices: document.getElementById('view-devices'),
        pairing: document.getElementById('view-pairing'),
        files: document.getElementById('view-files'),
        transfer: document.getElementById('view-transfer'),
        history: document.getElementById('view-history'),
        settings: document.getElementById('view-settings')
      },
      pairingHostname: document.getElementById('pairing-hostname'),
      pairingSubtitle: document.querySelector('.pairing-subtitle'),
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
      btnRetryTransfer: document.getElementById('btn-retry-transfer'),
      historyList: document.getElementById('history-list'),
      settingHostname: document.getElementById('setting-hostname'),
      settingDownloadPath: document.getElementById('setting-download-path'),
      settingPort: document.getElementById('setting-port'),
      settingAutoAccept: document.getElementById('setting-auto-accept'),
      btnChangePath: document.getElementById('btn-change-path'),
      btnSaveSettings: document.getElementById('btn-save-settings'),
      dropZone: document.querySelector('.content-body'),
      connectionQuality: document.getElementById('connection-quality')
    };
  },

  bindEvents() {
    this.els.btnMinimize.addEventListener('click', () => window.quickbeam.window.minimize());
    this.els.btnMaximize.addEventListener('click', () => window.quickbeam.window.maximize());
    this.els.btnClose.addEventListener('click', () => window.quickbeam.window.close());

    this.els.btnCreateRoom.addEventListener('click', () => this.showView('host'));
    this.els.btnCreateRoomMain.addEventListener('click', () => this.createRoom());
    this.els.btnJoinRoom.addEventListener('click', () => this.showView('join'));
    this.els.btnJoinRoomMain.addEventListener('click', () => this.showView('join'));
    this.els.btnCopyCode.addEventListener('click', () => this.copyRoomCode());
    this.els.btnStopRoom.addEventListener('click', () => this.stopRoom());
    this.els.btnJoinConnect.addEventListener('click', () => this.joinRoom());
    this.els.btnBackConnect.addEventListener('click', () => this.showView('connect'));
    this.els.btnHistory.addEventListener('click', () => this.showHistory());
    this.els.btnSettings.addEventListener('click', () => this.showSettings());

    this.els.btnTheme.addEventListener('click', () => this.toggleTheme());

    this.els.btnPairAccept.addEventListener('click', () => this.acceptPairing());
    this.els.btnPairReject.addEventListener('click', () => this.rejectPairing());

    this.els.btnAddFiles.addEventListener('click', () => this.addFiles());
    this.els.btnAddFolder.addEventListener('click', () => this.addFolder());
    this.els.btnStartTransfer.addEventListener('click', () => this.startTransfer());
    this.els.btnCancelTransfer.addEventListener('click', () => this.cancelTransfer());
    if (this.els.btnRetryTransfer) {
      this.els.btnRetryTransfer.addEventListener('click', () => this.retryTransfer());
    }

    this.els.btnChangePath.addEventListener('click', () => this.changeDownloadPath());
    this.els.btnSaveSettings.addEventListener('click', () => this.saveSettings());

    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        if (this.state.wifiSupported) {
          this.showView('connect');
        } else {
          this.toggleScan();
        }
      }
      if (e.ctrlKey && e.key === 'o') {
        e.preventDefault();
        this.addFiles();
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

    window.quickbeam.wifi.onSupported((supported) => {
      this.state.wifiSupported = supported;
      if (!supported) {
        this.showView('devices');
      }
    });

    window.quickbeam.wifi.onNetworkReady((info) => {
      this.state.wifiInfo = info;
      this.state.isHosting = true;
      if (this.els.roomCode) this.els.roomCode.textContent = info.ssid;
      if (this.els.roomPassword) this.els.roomPassword.textContent = info.password;
      this.showView('host');
      this.toggleScan();
    });

    window.quickbeam.wifi.onConnected((info) => {
      this.state.wifiInfo = info;
      this.state.isJoining = true;
      this.els.pageSubtitle.textContent = 'Connected to room!';
      this.toggleScan();
    });

    window.quickbeam.wifi.onDisconnected(() => {
      this.state.isHosting = false;
      this.state.isJoining = false;
      this.state.wifiInfo = null;
    });
  },

  initDragDrop() {
    const dropZone = document.body;

    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('drag-over');

      const files = Array.from(e.dataTransfer.files).map(f => f.path);
      if (files.length > 0) {
        this.state.selectedFiles = [...this.state.selectedFiles, ...files];
        this.renderSelectedFiles();
        if (this.state.selectedDevice) {
          this.showView('files');
        }
      }
    });
  },

  async loadSettings() {
    const settings = await window.quickbeam.settings.get();
    this.state.theme = settings.theme || 'dark';
    this.applyTheme(this.state.theme);

    this.els.settingHostname.value = settings.hostname || '';
    this.els.settingDownloadPath.value = settings.downloadPath || '';
    this.els.settingPort.value = settings.port || 58586;
    this.els.settingAutoAccept.checked = settings.autoAccept || false;

    const supported = await window.quickbeam.wifi.supported();
    this.state.wifiSupported = supported;
    if (supported) {
      this.showView('connect');
    } else {
      this.showView('devices');
      this.toggleScan();
    }
  },

  async createRoom() {
    this.els.pageSubtitle.textContent = 'Creating room...';
    const result = await window.quickbeam.wifi.host();
    if (result.success) {
      this.state.wifiInfo = result.info;
      this.state.isHosting = true;
      if (this.els.roomCode) this.els.roomCode.textContent = result.info.ssid;
      if (this.els.roomPassword) this.els.roomPassword.textContent = result.info.password;
      this.showView('host');
      this.toggleScan();
    } else {
      this.els.pageSubtitle.textContent = 'Failed to create room: ' + result.error;
    }
  },

  copyRoomCode() {
    if (this.state.wifiInfo) {
      const text = `Room: ${this.state.wifiInfo.ssid}\nPassword: ${this.state.wifiInfo.password}`;
      navigator.clipboard.writeText(text).then(() => {
        this.els.btnCopyCode.textContent = 'Copied!';
        setTimeout(() => {
          this.els.btnCopyCode.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy Code';
        }, 2000);
      }).catch(() => {
        this.els.btnCopyCode.textContent = 'Failed to copy';
      });
    }
  },

  async stopRoom() {
    await window.quickbeam.wifi.stop();
    this.state.isHosting = false;
    this.state.wifiInfo = null;
    this.showView('connect');
  },

  async joinRoom() {
    const code = this.els.inputRoomCode.value.trim();
    const password = this.els.inputRoomPassword.value.trim();

    if (!code || !password) {
      this.els.pageSubtitle.textContent = 'Please enter room code and password';
      return;
    }

    this.els.pageSubtitle.textContent = 'Connecting to room...';
    const result = await window.quickbeam.wifi.join(code, password);

    if (result.success) {
      this.state.wifiInfo = result.info;
      this.state.isJoining = true;
      this.els.pageSubtitle.textContent = 'Connected! Scanning for devices...';
      this.showView('devices');
      this.toggleScan();
    } else {
      this.els.pageSubtitle.textContent = 'Failed to connect: ' + result.error;
    }
  },

  showView(viewName) {
    this.state.currentView = viewName;

    Object.values(this.els.views).forEach(v => v.classList.add('hidden'));
    this.els.views[viewName].classList.remove('hidden');

    const titles = {
      connect: 'QuickBeam',
      host: 'Room Created',
      join: 'Join Room',
      devices: 'Devices',
      pairing: 'Pairing Request',
      files: 'Send Files',
      transfer: 'Transfer',
      history: 'History',
      settings: 'Settings'
    };

    const subtitles = {
      connect: 'No internet or router needed',
      host: 'Share this code with the other PC',
      join: 'Enter the code from the other PC',
      devices: this.state.isScanning ? 'Scanning for nearby devices...' : 'Waiting for devices...',
      pairing: this.state.pairingSubtitle?.textContent || 'Connection request received',
      files: 'Select files to send',
      transfer: 'Transferring files...',
      history: 'Your transfer history',
      settings: 'Configure QuickBeam'
    };

    this.els.pageTitle.textContent = titles[viewName];
    this.els.pageSubtitle.textContent = subtitles[viewName];

    document.querySelectorAll('.action-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = {
      'btn-create-room': this.els.btnCreateRoom,
      'btn-join-room': this.els.btnJoinRoom,
      history: this.els.btnHistory,
      settings: this.els.btnSettings
    }[viewName];
    if (activeBtn) activeBtn.classList.add('active');
  },

  async toggleScan() {
    if (this.state.isScanning) {
      await window.quickbeam.devices.stopScan();
      this.state.isScanning = false;
    } else {
      await window.quickbeam.devices.startScan();
      this.state.isScanning = true;
    }
    if (this.state.currentView === 'devices') {
      this.showView('devices');
    }
  },

  onDeviceFound(device) {
    if (!this.state.devices.find(d => d.id === device.id)) {
      this.state.devices.push(device);
      this.renderDeviceList();
      this.updateStats();
      if (this.state.currentView === 'devices' || this.state.currentView === 'host') {
        this.showView('devices');
      }
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
        <div class="device-meta">
          <span class="device-status ${device.status === 'paired' ? 'paired' : ''}">${device.status}</span>
          ${device.quality ? `<span class="connection-quality" title="Connection quality">${this.getQualityIcon(device.quality)}</span>` : ''}
        </div>
        <div class="device-actions">
          ${device.status === 'paired'
            ? `<button class="btn btn-primary btn-connect" data-id="${device.id}">Send</button>`
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

  getQualityIcon(quality) {
    if (quality >= 80) return '<svg width="16" height="16" viewBox="0 0 24 24" fill="#22c55e"><path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z"/></svg>';
    if (quality >= 50) return '<svg width="16" height="16" viewBox="0 0 24 24" fill="#f59e0b"><path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z"/></svg>';
    return '<svg width="16" height="16" viewBox="0 0 24 24" fill="#ef4444"><path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z"/></svg>';
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
      <p class="hint">or drag & drop files here to quick send</p>
    `;
    return div;
  },

  async pairDevice(deviceId) {
    const result = await window.quickbeam.pair.request(deviceId);
    if (result.success) {
      this.els.pageSubtitle.textContent = 'Pairing request sent...';
    } else {
      this.els.pageSubtitle.textContent = 'Failed to send pairing request';
    }
  },

  connectDevice(deviceId) {
    this.state.selectedDevice = deviceId;
    this.showView('files');
  },

  onPairRequest(request) {
    this.state.pairingRequest = request;
    this.state.pendingTransfer = null;
    this.els.pairingHostname.textContent = request.hostname;
    if (this.els.pairingSubtitle) {
      this.els.pairingSubtitle.textContent = 'wants to connect with you';
    }
    this.els.btnPairAccept.textContent = 'Accept';
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
    if (this.state.pendingTransfer) {
      await window.quickbeam.transfer.accept(this.state.pendingTransfer.id);
      this.state.currentTransfer = this.state.pendingTransfer.id;
      this.state.pendingTransfer = null;
      this.showView('transfer');
    } else if (this.state.pairingRequest) {
      await window.quickbeam.pair.accept(this.state.pairingRequest.id);
      this.state.pairingRequest = null;
      this.showView('devices');
    }
  },

  async rejectPairing() {
    if (this.state.pendingTransfer) {
      await window.quickbeam.transfer.reject(this.state.pendingTransfer.id);
      this.state.pendingTransfer = null;
      this.showView('devices');
    } else if (this.state.pairingRequest) {
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
          <p class="hint">Drag & drop files here or click buttons below</p>
          <div class="file-btn-group">
            <button class="btn btn-secondary" id="btn-add-files">Add Files</button>
            <button class="btn btn-secondary" id="btn-add-folder">Add Folder</button>
          </div>
        </div>
      `;
      document.getElementById('btn-add-files').addEventListener('click', () => this.addFiles());
      document.getElementById('btn-add-folder').addEventListener('click', () => this.addFolder());
      return;
    }

    this.els.selectedFiles.innerHTML = `
      <div class="selected-header">
        <span class="selected-count">${this.state.selectedFiles.length} item(s) selected</span>
        <button class="btn btn-text btn-clear" id="btn-clear-files">Clear All</button>
      </div>
      ${this.state.selectedFiles.map((file, index) => {
        const name = file.split(/[/\\]/).pop();
        return `
          <div class="file-item">
            <div class="file-icon file">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6C4.89543 2 4 2.89543 4 4V20C4 21.1046 4.89543 22 6 22H18C19.1046 22 20 21.1046 20 20V8L14 2Z"/><path d="M14 2V8H20"/></svg>
            </div>
            <div class="file-info">
              <div class="file-name">${name}</div>
              <div class="file-path">${file}</div>
            </div>
            <button class="file-remove" data-index="${index}" title="Remove">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6L6 18M6 6L18 18"/>
              </svg>
            </button>
          </div>
        `;
      }).join('')}
    `;

    document.getElementById('btn-clear-files')?.addEventListener('click', () => {
      this.state.selectedFiles = [];
      this.renderSelectedFiles();
    });

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
      this.state.currentTransfer = result.transferId;
      if (result.queued) {
        this.els.pageSubtitle.textContent = `Queued (position: ${result.position})`;
        this.state.transferQueue.push(result.transferId);
      } else {
        this.showView('transfer');
      }
    }
  },

  onTransferRequest(request) {
    this.state.pendingTransfer = request;
    this.state.pairingRequest = null;
    this.els.pairingHostname.textContent = request.hostname;
    if (this.els.pairingSubtitle) {
      const fileCount = request.files ? request.files.length : 0;
      const totalSize = request.files ? request.files.reduce((sum, f) => sum + (f.size || 0), 0) : 0;
      this.els.pairingSubtitle.textContent = `wants to send ${fileCount} file(s) (${this.formatBytes(totalSize)})`;
    }
    this.els.btnPairAccept.textContent = 'Accept Transfer';
    this.showView('pairing');
  },

  async acceptTransfer() {
    if (this.state.pendingTransfer) {
      await window.quickbeam.transfer.accept(this.state.pendingTransfer.id);
      this.state.currentTransfer = this.state.pendingTransfer.id;
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

    const remaining = progress.speed > 0 ? (progress.totalSize - progress.bytesTransferred) / progress.speed : 0;
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
    this.els.btnCancelTransfer.style.display = 'none';
    if (this.els.btnRetryTransfer) {
      this.els.btnRetryTransfer.style.display = 'none';
    }

    this.state.transferQueue = this.state.transferQueue.filter(id => id !== transfer.id);

    setTimeout(() => {
      this.showView('devices');
      this.state.selectedFiles = [];
      this.state.currentTransfer = null;
      this.els.btnCancelTransfer.style.display = '';
      this.updateStats();
    }, 2000);
  },

  onTransferFailed(error) {
    this.els.transferSpeed.textContent = 'Failed';
    this.els.transferEta.textContent = error.error || 'Transfer failed';
    this.els.transferProgress.style.background = '#ef4444';
    if (this.els.btnRetryTransfer) {
      this.els.btnRetryTransfer.style.display = '';
    }

    setTimeout(() => {
      this.els.transferProgress.style.background = '';
    }, 100);
  },

  async cancelTransfer() {
    if (this.state.currentTransfer) {
      await window.quickbeam.transfer.cancel(this.state.currentTransfer);
      this.state.currentTransfer = null;
      this.showView('devices');
    }
  },

  async retryTransfer() {
    if (this.state.currentTransfer) {
      const result = await window.quickbeam.transfer.retry(this.state.currentTransfer);
      if (result.success) {
        this.els.transferSpeed.textContent = 'Retrying...';
        this.els.transferEta.textContent = '';
        this.els.transferProgress.style.width = '0%';
        this.els.percentValue.textContent = '0';
        if (this.els.btnRetryTransfer) {
          this.els.btnRetryTransfer.style.display = 'none';
        }
      }
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
            <div class="history-meta">${this.formatBytes(item.totalSize)} &bull; ${new Date(item.timestamp).toLocaleDateString()}</div>
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
    this.els.themeIcon.textContent = theme === 'dark' ? '\u2600' : '\u263E';
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
