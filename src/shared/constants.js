const APP_ID = 'quickbeam';
const APP_VERSION = '1.0.0';

const NETWORK = {
  DISCOVERY_PORT: 58585,
  TRANSFER_PORT: 58586,
  BROADCAST_INTERVAL: 2000,
  CHUNK_SIZE: 65536,
  BROADCAST_ADDRESS: '255.255.255.255'
};

const MESSAGE_TYPES = {
  ANNOUNCE: 'announce',
  PAIR_REQUEST: 'pair_request',
  PAIR_ACCEPT: 'pair_accept',
  PAIR_REJECT: 'pair_reject',
  TRANSFER_INIT: 'transfer_init',
  TRANSFER_ACCEPT: 'transfer_accept',
  TRANSFER_REJECT: 'transfer_reject',
  FILE_DATA: 'file_data',
  FILE_ACK: 'file_ack',
  TRANSFER_COMPLETE: 'transfer_complete',
  TRANSFER_CANCEL: 'transfer_cancel'
};

const DEVICE_STATUS = {
  AVAILABLE: 'available',
  PAIRED: 'paired',
  TRANSFERRING: 'transferring'
};

const TRANSFER_STATUS = {
  PENDING: 'pending',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
};

module.exports = {
  APP_ID,
  APP_VERSION,
  NETWORK,
  MESSAGE_TYPES,
  DEVICE_STATUS,
  TRANSFER_STATUS
};
