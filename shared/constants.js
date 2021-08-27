const OP_CODES = {
  HANDSHAKE: 0,
  HANDSHAKE_ACK: 1,
  ERROR: 2,
};
const CLIENT_STATE = {
  IDLE: 0,
  CONNECTING: 1,
  HANDSHAKE: 2,
  CONNECTED: 3,
  DISCONNECTING: 4,
  DISCONNECTED: 5,
  FAILED: 6,
};
const METHODS = {
  NODE_BUFFER: 0,
  MSGPACK: 1,
};
const DEFAULT_SERVER_PROPS = {
  version: 1,
  methods: { ...METHODS },
};
const RESERVED_NAMES = [
  "error",
  "client_close",
  "invalid_message",
  "client_ready",
  "ready",
  "close_internal",
];
module.exports = {
  OP_CODES,
  CLIENT_STATE,
  METHODS,
  DEFAULT_SERVER_PROPS,
  RESERVED_NAMES,
};
