const OP_CODES = {
  HANDSHAKE: 0,
  HANDSHAKE_ACK: 1,
  ERROR: 2,
  KEEP_ALIVE: 3,
  KEEP_ALIVE_ACK: 4,
};
const CLIENT_STATE = {
  IDLE: 0,
  CONNECTING: 1,
  HANDSHAKE: 2,
  CONNECTED: 3,
  DISCONNECTING: 4,
  DISCONNECTED: 5,
  FAILED: 6,
  RECONNECTING: 7,
};
const METHODS = {
  NODE_BUFFER: 0,
  MSGPACK: 1,
  GPACK: 2,
};
const DEFAULT_SERVER_PROPS = {
  version: 1,
  methods: { ...METHODS },
};
const DEFAULT_CLIENT_OPTS = {
  autoReconnect: true,
  heartbeatInterval: 250,
  replay: true,
  methods: { ...METHODS },
};
const RESERVED_NAMES = [
  "error",
  "client_close",
  "invalid_message",
  "client_ready",
  "ready",
  "close_internal",
  "reconnect",
];
module.exports = {
  OP_CODES,
  CLIENT_STATE,
  METHODS,
  DEFAULT_SERVER_PROPS,
  RESERVED_NAMES,
  DEFAULT_CLIENT_OPTS,
};
