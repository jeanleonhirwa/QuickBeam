const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');
const net = require('net');
const { NETWORK, MESSAGE_TYPES, TRANSFER_STATUS } = require('../shared/constants');
const { generateId, calculateChecksum } = require('../shared/utils');

class TransferEngine extends EventEmitter {
  constructor(storage) {
    super();
    this.storage = storage;
    this.activeTransfers = new Map();
    this.pendingTransfers = new Map();
    this.serverSocket = null;
  }

  async startTransfer(deviceId, files) {
    const transferId = generateId();
    
    const fileData = await Promise.all(files.map(async (filePath) => {
      const stats = fs.statSync(filePath);
      const checksum = await calculateChecksum(filePath);
      return {
        name: path.basename(filePath),
        path: filePath,
        size: stats.size,
        checksum
      };
    }));

    const totalSize = fileData.reduce((sum, f) => sum + f.size, 0);

    const transfer = {
      id: transferId,
      deviceId,
      type: 'send',
      files: fileData,
      totalSize,
      bytesTransferred: 0,
      status: TRANSFER_STATUS.PENDING,
      speed: 0,
      startTime: null,
      endTime: null
    };

    this.activeTransfers.set(transferId, transfer);
    return { success: true, transferId };
  }

  async handleIncomingTransfer(message, socket) {
    const transferId = message.transferId;
    
    const transfer = {
      id: transferId,
      deviceId: message.deviceId,
      type: 'receive',
      files: message.files,
      totalSize: message.files.reduce((sum, f) => sum + f.size, 0),
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

    const acceptMessage = JSON.stringify({
      type: MESSAGE_TYPES.TRANSFER_ACCEPT,
      transferId
    }) + '\n';
    transfer.socket.write(acceptMessage);

    this.receiveFile(transfer);
    return { success: true };
  }

  rejectTransfer(transferId) {
    const transfer = this.pendingTransfers.get(transferId);
    if (!transfer) {
      return { success: false, error: 'Transfer not found' };
    }

    const rejectMessage = JSON.stringify({
      type: MESSAGE_TYPES.TRANSFER_REJECT,
      transferId
    }) + '\n';
    transfer.socket.write(rejectMessage);

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

    if (transfer.socket && !transfer.socket.destroyed) {
      const cancelMessage = JSON.stringify({
        type: MESSAGE_TYPES.TRANSFER_CANCEL,
        transferId
      }) + '\n';
      transfer.socket.write(cancelMessage);
    }

    this.activeTransfers.delete(transferId);
    this.emit('transferFailed', { transferId, error: 'Cancelled by user' });
    return { success: true };
  }

  async sendFiles(transfer) {
    const settings = this.storage.getSettings();
    const downloadPath = settings.downloadPath;

    for (const file of transfer.files) {
      const fileStream = fs.createReadStream(file.path);
      const fileSize = file.size;
      let bytesSent = 0;
      let lastEmit = Date.now();

      await new Promise((resolve, reject) => {
        fileStream.on('data', (chunk) => {
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
            transfer.speed = transfer.bytesTransferred / elapsed;
            this.emit('transferProgress', {
              transferId: transfer.id,
              bytesTransferred: transfer.bytesTransferred,
              totalSize: transfer.totalSize,
              speed: transfer.speed,
              fileName: file.name
            });
            lastEmit = now;
          }
        });

        fileStream.on('end', resolve);
        fileStream.on('error', reject);
      });
    }

    const completeMessage = JSON.stringify({
      type: MESSAGE_TYPES.TRANSFER_COMPLETE,
      transferId: transfer.id,
      checksums: transfer.files.map(f => ({ name: f.name, checksum: f.checksum }))
    }) + '\n';
    transfer.socket.write(completeMessage);

    transfer.status = TRANSFER_STATUS.COMPLETED;
    transfer.endTime = Date.now();
    this.activeTransfers.delete(transfer.id);
    this.emit('transferComplete', transfer);
  }

  async receiveFile(transfer) {
    const settings = this.storage.getSettings();
    const downloadPath = settings.downloadPath;

    if (!fs.existsSync(downloadPath)) {
      fs.mkdirSync(downloadPath, { recursive: true });
    }

    let buffer = '';
    let currentFile = null;
    let fileStream = null;
    let receivedBytes = 0;

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
              if (fileStream) fileStream.end();
              currentFile = message.fileName;
              const filePath = path.join(downloadPath, message.fileName);
              fileStream = fs.createWriteStream(filePath);
              receivedBytes = 0;
            }

            const chunkData = buffer.substring(0, message.size);
            buffer = buffer.substring(message.size);
            
            fileStream.write(Buffer.from(chunkData, 'binary'));
            receivedBytes += chunkData.length;
            transfer.bytesTransferred += chunkData.length;

            const now = Date.now();
            const elapsed = (now - transfer.startTime) / 1000;
            transfer.speed = transfer.bytesTransferred / elapsed;
            
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
          console.error('Message parse error:', e);
        }
      }
    });

    transfer.socket.on('error', (err) => {
      console.error('Transfer socket error:', err);
      transfer.status = TRANSFER_STATUS.FAILED;
      transfer.endTime = Date.now();
      this.emit('transferFailed', { transferId: transfer.id, error: err.message });
    });
  }
}

module.exports = TransferEngine;
