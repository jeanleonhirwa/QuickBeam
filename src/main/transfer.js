const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');
const net = require('net');
const crypto = require('crypto');
const { NETWORK, MESSAGE_TYPES, TRANSFER_STATUS } = require('../shared/constants');
const { generateId } = require('../shared/utils');

class TransferEngine extends EventEmitter {
  constructor(storage, networkManager) {
    super();
    this.storage = storage;
    this.networkManager = networkManager;
    this.activeTransfers = new Map();
    this.pendingTransfers = new Map();
    this.transferSockets = new Map();
    this.transferQueue = [];
    this.maxConcurrent = 3;
  }

  setNetworkManager(networkManager) {
    this.networkManager = networkManager;
  }

  async startTransfer(deviceId, files) {
    const transferId = generateId();

    const fileData = [];
    for (const filePath of files) {
      try {
        const stats = fs.statSync(filePath);
        const checksum = await this.calculateChecksum(filePath);
        fileData.push({
          name: path.basename(filePath),
          path: filePath,
          size: stats.size,
          checksum
        });
      } catch (err) {
        console.error('File error:', filePath, err.message);
      }
    }

    if (fileData.length === 0) {
      return { success: false, error: 'No valid files' };
    }

    const totalSize = fileData.reduce((sum, f) => sum + f.size, 0);

    const transfer = {
      id: transferId,
      deviceId,
      type: 'send',
      files: fileData,
      totalSize,
      bytesTransferred: 0,
      status: TRANSFER_STATUS.ACTIVE,
      speed: 0,
      startTime: Date.now(),
      endTime: null,
      socket: null
    };

    this.activeTransfers.set(transferId, transfer);

    const connected = await this.connectToReceiver(transfer);
    if (!connected) {
      this.activeTransfers.delete(transferId);
      return { success: false, error: 'Failed to connect to receiver' };
    }

    return { success: true, transferId, queued: false };
  }

  connectToReceiver(transfer) {
    return new Promise((resolve) => {
      const device = this.networkManager.getDevice(transfer.deviceId);
      if (!device) {
        console.error('Device not found:', transfer.deviceId);
        resolve(false);
        return;
      }

      const socket = net.createConnection(device.port, device.ip, () => {
        transfer.socket = socket;
        this.transferSockets.set(transfer.id, socket);

        const initMessage = JSON.stringify({
          type: MESSAGE_TYPES.TRANSFER_INIT,
          transferId: transfer.id,
          deviceId: this.networkManager.deviceId,
          hostname: this.networkManager.hostname,
          files: transfer.files.map(f => ({
            name: f.name,
            size: f.size,
            checksum: f.checksum
          }))
        }) + '\n';

        socket.write(initMessage);
        console.log('Sent TRANSFER_INIT to', device.hostname);
      });

      socket.on('data', (data) => {
        this.handleSenderSocketData(transfer, data);
      });

      socket.on('error', (err) => {
        console.error('Connection error:', err.message);
        transfer.status = TRANSFER_STATUS.FAILED;
        this.emit('transferFailed', { transferId: transfer.id, error: err.message });
        resolve(false);
      });

      socket.setTimeout(10000);
      socket.on('timeout', () => {
        console.error('Connection timeout');
        socket.destroy();
        transfer.status = TRANSFER_STATUS.FAILED;
        this.emit('transferFailed', { transferId: transfer.id, error: 'Connection timeout' });
        resolve(false);
      });

      setTimeout(() => {
        if (!transfer.socket) {
          socket.destroy();
          resolve(false);
        }
      }, 10000);
    });
  }

  handleSenderSocketData(transfer, data) {
    const messageStr = data.toString().split('\n')[0];
    try {
      const message = JSON.parse(messageStr);
      if (message.type === MESSAGE_TYPES.TRANSFER_ACCEPT) {
        console.log('Transfer accepted, sending files...');
        this.sendFiles(transfer);
      } else if (message.type === MESSAGE_TYPES.TRANSFER_REJECT) {
        console.log('Transfer rejected');
        transfer.status = TRANSFER_STATUS.FAILED;
        this.emit('transferFailed', { transferId: transfer.id, error: 'Transfer rejected by receiver' });
      }
    } catch (e) {
      // Ignore parse errors on partial data
    }
  }

  getQueue() {
    return this.transferQueue.map((id, index) => ({
      id,
      position: index + 1,
      transfer: this.activeTransfers.get(id)
    }));
  }

  retryTransfer(transferId) {
    const transfer = this.activeTransfers.get(transferId);
    if (!transfer) {
      return { success: false, error: 'Transfer not found' };
    }

    if (transfer.status === TRANSFER_STATUS.FAILED || transfer.status === TRANSFER_STATUS.CANCELLED) {
      transfer.status = TRANSFER_STATUS.PENDING;
      transfer.bytesTransferred = 0;
      transfer.speed = 0;
      transfer.startTime = null;
      transfer.endTime = null;
      this.activeTransfers.set(transferId, transfer);
      return { success: true };
    }
    return { success: false, error: 'Transfer cannot be retried' };
  }

  processQueue() {
    while (this.transferQueue.length > 0 && this.activeTransfers.size < this.maxConcurrent) {
      const nextId = this.transferQueue.shift();
      const transfer = this.activeTransfers.get(nextId);
      if (transfer && transfer.status === TRANSFER_STATUS.PENDING) {
        transfer.status = TRANSFER_STATUS.ACTIVE;
        transfer.startTime = Date.now();
        this.sendFiles(transfer);
      }
    }
  }

  calculateChecksum(filePath) {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);
      stream.on('data', data => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  async handleIncomingTransfer(message, socket) {
    const transferId = message.transferId || generateId();

    const transfer = {
      id: transferId,
      deviceId: message.deviceId,
      type: 'receive',
      files: message.files || [],
      totalSize: (message.files || []).reduce((sum, f) => sum + (f.size || 0), 0),
      bytesTransferred: 0,
      status: TRANSFER_STATUS.PENDING,
      speed: 0,
      startTime: null,
      endTime: null,
      socket,
      receivedFiles: new Map()
    };

    this.pendingTransfers.set(transferId, transfer);
    this.emit('transferRequest', {
      id: transferId,
      deviceId: message.deviceId,
      hostname: message.hostname,
      files: message.files,
      totalSize: transfer.totalSize
    });
  }

  acceptTransfer(transferId) {
    const transfer = this.pendingTransfers.get(transferId);
    if (!transfer) {
      return { success: false, error: 'Transfer not found' };
    }

    this.pendingTransfers.delete(transferId);
    this.activeTransfers.set(transferId, transfer);

    transfer.status = TRANSFER_STATUS.ACTIVE;
    transfer.startTime = Date.now();

    try {
      const acceptMessage = JSON.stringify({
        type: MESSAGE_TYPES.TRANSFER_ACCEPT,
        transferId
      }) + '\n';
      transfer.socket.write(acceptMessage);
    } catch (err) {
      console.error('Accept message error:', err);
    }

    this.receiveFile(transfer);
    return { success: true };
  }

  rejectTransfer(transferId) {
    const transfer = this.pendingTransfers.get(transferId);
    if (!transfer) {
      return { success: false, error: 'Transfer not found' };
    }

    try {
      const rejectMessage = JSON.stringify({
        type: MESSAGE_TYPES.TRANSFER_REJECT,
        transferId
      }) + '\n';
      transfer.socket.write(rejectMessage);
    } catch (err) {
      console.error('Reject message error:', err);
    }

    this.pendingTransfers.delete(transferId);
    return { success: true };
  }

  cancelTransfer(transferId) {
    const transfer = this.activeTransfers.get(transferId);
    if (!transfer) {
      return { success: false, error: 'Transfer not found' };
    }

    transfer.status = TRANSFER_STATUS.CANCELLED;
    transfer.endTime = Date.now();

    try {
      if (transfer.socket && !transfer.socket.destroyed) {
        const cancelMessage = JSON.stringify({
          type: MESSAGE_TYPES.TRANSFER_CANCEL,
          transferId
        }) + '\n';
        transfer.socket.write(cancelMessage);
      }
    } catch (err) {
      console.error('Cancel message error:', err);
    }

    this.activeTransfers.delete(transferId);
    this.emit('transferFailed', { transferId, error: 'Cancelled by user' });
    return { success: true };
  }

  async sendFiles(transfer) {
    const settings = this.storage.getSettings();

    for (const file of transfer.files) {
      try {
        await this.sendFileChunk(transfer, file);
      } catch (err) {
        console.error('Send file error:', err);
        transfer.status = TRANSFER_STATUS.FAILED;
        transfer.endTime = Date.now();
        this.activeTransfers.delete(transfer.id);
        this.emit('transferFailed', { transferId: transfer.id, error: err.message });
        return;
      }
    }

    try {
      const completeMessage = JSON.stringify({
        type: MESSAGE_TYPES.TRANSFER_COMPLETE,
        transferId: transfer.id,
        checksums: transfer.files.map(f => ({ name: f.name, checksum: f.checksum }))
      }) + '\n';
      transfer.socket.write(completeMessage);
    } catch (err) {
      console.error('Complete message error:', err);
    }

    transfer.status = TRANSFER_STATUS.COMPLETED;
    transfer.endTime = Date.now();
    this.activeTransfers.delete(transfer.id);
    this.emit('transferComplete', transfer);
  }

  sendFileChunk(transfer, file) {
    return new Promise((resolve, reject) => {
      const fileStream = fs.createReadStream(file.path);
      const fileSize = file.size;
      let bytesSent = 0;
      let lastEmit = Date.now();

      fileStream.on('data', (chunk) => {
        try {
          const initData = JSON.stringify({
            type: MESSAGE_TYPES.FILE_DATA,
            transferId: transfer.id,
            fileName: file.name,
            offset: bytesSent,
            size: chunk.length
          }) + '\n';
          transfer.socket.write(initData);
          transfer.socket.write(chunk);

          bytesSent += chunk.length;
          transfer.bytesTransferred += chunk.length;

          const now = Date.now();
          if (now - lastEmit > 100) {
            const elapsed = (now - transfer.startTime) / 1000;
            transfer.speed = elapsed > 0 ? transfer.bytesTransferred / elapsed : 0;
            this.emit('transferProgress', {
              transferId: transfer.id,
              bytesTransferred: transfer.bytesTransferred,
              totalSize: transfer.totalSize,
              speed: transfer.speed,
              fileName: file.name
            });
            lastEmit = now;
          }
        } catch (err) {
          fileStream.destroy();
          reject(err);
        }
      });

      fileStream.on('end', resolve);
      fileStream.on('error', reject);
    });
  }

  async receiveFile(transfer) {
    const settings = this.storage.getSettings();
    const downloadPath = settings.downloadPath;

    try {
      if (!fs.existsSync(downloadPath)) {
        fs.mkdirSync(downloadPath, { recursive: true });
      }
    } catch (err) {
      console.error('Create download dir error:', err);
    }

    let buffer = '';
    let currentFile = null;
    let fileStream = null;

    transfer.socket.on('data', async (data) => {
      buffer += data.toString();

      while (buffer.length > 0) {
        const newlineIndex = buffer.indexOf('\n');

        if (newlineIndex === -1) break;

        const messageStr = buffer.substring(0, newlineIndex);
        buffer = buffer.substring(newlineIndex + 1);

        try {
          const message = JSON.parse(messageStr);

          if (message.type === MESSAGE_TYPES.FILE_DATA) {
            if (!fileStream || currentFile !== message.fileName) {
              if (fileStream) {
                fileStream.end();
              }
              currentFile = message.fileName;
              const filePath = path.join(downloadPath, message.fileName);
              fileStream = fs.createWriteStream(filePath);
            }

            const chunkData = buffer.substring(0, message.size);
            buffer = buffer.substring(message.size);

            fileStream.write(Buffer.from(chunkData, 'binary'));
            transfer.bytesTransferred += chunkData.length;

            const now = Date.now();
            const elapsed = (now - transfer.startTime) / 1000;
            transfer.speed = elapsed > 0 ? transfer.bytesTransferred / elapsed : 0;

            this.emit('transferProgress', {
              transferId: transfer.id,
              bytesTransferred: transfer.bytesTransferred,
              totalSize: transfer.totalSize,
              speed: transfer.speed,
              fileName: currentFile
            });

          } else if (message.type === MESSAGE_TYPES.TRANSFER_COMPLETE) {
            if (fileStream) {
              fileStream.end();
              fileStream = null;
            }

            transfer.status = TRANSFER_STATUS.COMPLETED;
            transfer.endTime = Date.now();
            this.activeTransfers.delete(transfer.id);
            this.emit('transferComplete', transfer);

          } else if (message.type === MESSAGE_TYPES.TRANSFER_CANCEL) {
            if (fileStream) {
              fileStream.end();
              fileStream = null;
            }
            transfer.status = TRANSFER_STATUS.CANCELLED;
            transfer.endTime = Date.now();
            this.activeTransfers.delete(transfer.id);
            this.emit('transferFailed', { transferId: transfer.id, error: 'Cancelled by sender' });
          }
        } catch (e) {
          // Skip invalid messages
        }
      }
    });

    transfer.socket.on('error', (err) => {
      console.error('Transfer socket error:', err.message);
      transfer.status = TRANSFER_STATUS.FAILED;
      transfer.endTime = Date.now();
      this.emit('transferFailed', { transferId: transfer.id, error: err.message });
    });
  }
}

module.exports = TransferEngine;
