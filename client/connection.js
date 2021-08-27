const net = require("net");
const EventEmitter = require("events");

const Client = require("../shared/client");
const constants = require("../shared/constants");
const { packHandshake, parseHandhakeResponse } = require("../shared/message");
const RESERVED_NAMES = constants.RESERVED_NAMES;
class Connection extends EventEmitter {
  constructor(opts) {
    super();
    this.opts = opts;
    this.state = {
      connecting: false,
      handlers: {},
    };
    this.waitQueue = [];
    this.connectCount = 0;
    this.shouldRetryConnect = opts.autoReconnect;
    this.client = null;
    this._ready = false;
    this._reconnectTimeout = null;
    this.reconnectFunc - null;
  }

  registerListener(handler) {
    const { op, eventName } = handler;
    if (op <= 4) {
      throw new Error("reserved OpCode " + op);
    }
    if (RESERVED_NAMES.includes(eventName)) {
      throw new Error("reserved event name " + eventName);
    }
    if (this.state.handlers[op]) {
      throw new Error("handler already registered " + op);
    }
    this.state.handlers[op] = handler;
  }
  unregisterHandler(opOrEventName) {
    if (typeof opOrEventName === "number") {
      delete this.state.handlers[opOrEventName];
    } else {
      for (const op in this.state.handlers) {
        if (this.state.handlers[op].eventName === opOrEventName) {
          delete this.state.handlers[op];
          break;
        }
      }
    }
  }
  _setupHeartbeat() {
    const data = Buffer.alloc(1);
    this.lastHeartbeat = Date.now();
    this._heartbeat = setInterval(() => {
      if (this.lastHeartbeat && Date.now() > this.lastHeartbeat + 1000) {
        if (this.client) {
          this.client._ready = false;
          this.client.state = this.shouldRetryConnect
            ? constants.CLIENT_STATE.RECONNECTING
            : constants.CLIENT_STATE.FAILED;
        }
        const willHandle = this._handleReconnect();
        if (!willHandle) {
          this.close();
        }
        this.emit(
          "error",
          new Error("last heartbeat over 1 second"),
          willHandle
        );
      } else {
        this.client._send(constants.OP_CODES.KEEP_ALIVE, data);
      }
    }, this.opts.heartbeatInterval);
  }
  _clearHeartbeat() {
    if (this._heartbeat) {
      clearInterval(this._heartbeat);
      this._heartbeat = null;
    }
  }
  _heartbeatResponse() {
    this.lastHeartbeat = Date.now();
  }
  _maybeReplayEvents() {
    const client = this.client;
    if (this.clientWaitQueue) {
      client.waitQueue = this.clientWaitQueue;
      client._processWaitQueue();
      this.clientWaitQueue = null;
    }
    if (this.waitQueue.length) {
      for (const entry of this.waitQueue)
        client.send(entry.opcode, entry.message);
      this.waitQueue = null;
    }
  }
  connect() {
    if (this._ready) {
      throw new Error("already connected");
    }
    this.connectCount++;
    this.state.connecting = true;
    this.socket = net.createConnection(
      { port: this.opts.port, host: this.opts.host },
      () => {
        if (this.state.connecting) {
          const client = new Client(this.socket, this);
          client.state = constants.CLIENT_STATE.HANDSHAKE;

          this.client = client;
          client.on("close_internal", () => {
            this._ready = false;
            client._ready = false;
            client.state = constants.CLIENT_STATE.DISCONNECTING;
          });
          client.on("error", (err) => {
            this.emit("error", err);
          });
          client.on("data", (messages) => {
            if (!messages.length) return;
            const rawMessage = messages[0];
            if (
              rawMessage.op === constants.OP_CODES.HANDSHAKE_ACK &&
              client.state === constants.CLIENT_STATE.HANDSHAKE
            ) {
              const { version, method } = parseHandhakeResponse(
                rawMessage.data
              );
              if (this._reconnectTimeout !== null) {
                clearInterval(this._reconnectTimeout);
                this._reconnectTimeout = null;
              }
              if (this.reconnectFunc !== null) {
                clearInterval(this.reconnectFunc);
                this.reconnectFunc = null;
              }
              //Props
              this.version = version;
              this.method = method;
              console.log(method)
              client.method = { n: method };
              client.state = constants.CLIENT_STATE.CONNECTED;
              this._ready = true;
              this.state.connecting = false;
              this.client._ready = true;
              this.firstReconnect = false;
              //funcs
              this._setupHeartbeat();
              this._maybeReplayEvents();
              this.emit(
                this.connectCount > 1 && this.wasConnected
                  ? "reconnect"
                  : "ready",
                client
              );
              this.wasConnected = true;
            } else if (rawMessage.op === constants.OP_CODES.KEEP_ALIVE_ACK) {
              this._heartbeatResponse();
            } else if (
              this._ready &&
              client.state === constants.CLIENT_STATE.CONNECTED
            ) {
              for (const message of messages) {
                const handler = this.state.handlers[message.op];
                if (!handler) {
                  throw new Error("unhandled op " + message.op);
                }
                const parsed = handler.unpacker(
                  message.data,
                  this.method,
                  client
                );
                this.emit(handler.eventName, parsed, message.seq);
              }
            } else {
              throw new Error(
                "received message in faulty state " + client.state
              );
            }
          });
          //send handshake
          this._sendHandshake();
        } else {
          throw new Error("fired connect in faulty state" + this.state);
        }
      }
    );
    if (this.shouldRetryConnect && this._reconnectTimeout === null) {
      this._reconnectTimeout = setTimeout(() => {
        this._reconnectTimeout = null;
        if (this.shouldRetryConnect && !this._ready) {
          this._handleReconnect();
        }
      }, 500);
    }
    this.socket.on("error", (err) => {
      if (this.client) {
        this.client._ready = false;
        this.client.state = this.shouldRetryConnect
          ? constants.CLIENT_STATE.RECONNECTING
          : constants.CLIENT_STATE.FAILED;
      }
      this.emit("error", err, this._handleReconnect());
    });
    this.socket.on("close", () => {
      if (this.shouldRetryConnect) return;
      if (
        this.client &&
        this.client.state === constants.CLIENT_STATE.CONNECTED
      ) {
        this.close();
      }
    });
  }

  _doReconnect() {
    this._clearHeartbeat();
    this._ready = false;
    this.socket.destroy();
    if (this.waitQueue === null) this.waitQueue = [];
    if (
      this.client !== null &&
      this.client.waitQueue !== null &&
      this.client.waitQueue.length
    )
      this.clientWaitQueue = this.client.waitQueue;
    this.client = null;
    this.socket = null;
    this.connect();
    this.reconnectFunc = null;
  }
  _handleReconnect() {
    if (
      this.shouldRetryConnect &&
      (!this.client ||
        this.client.state === constants.CLIENT_STATE.RECONNECTING)
    ) {
      if (this.reconnectFunc === null) {
        if (!this.firstReconnect) {
            this.firstReconnect = true;
            this._doReconnect();
        }
        else
          this.reconnectFunc = setTimeout(() => {
            this._doReconnect();
          }, 250);
      }

      return true;
    }
    return false;
  }

  send(opcode, message) {
    if (this.client === null || !this.client._ready) {
      this.waitQueue.push({ opcode, message });
      return;
    }
    this.client.send(opcode, message);
  }

  close() {
    delete this.version;
    delete this.method;
    this._clearHeartbeat();
    this._ready = false;
    this.shouldRetryConnect = false;
    if (this.client) {
      this.client._ready = false;
      this.client.state = constants.CLIENT_STATE.DISCONNECTED;
    }
    if (this.socket) this.socket.destroy();
    this.emit("close");
  }

  _sendHandshake() {
    this.client._send(
      constants.OP_CODES.HANDSHAKE,
      packHandshake(this.opts.version, Object.values(constants.METHODS))
    );
  }
}

module.exports = (host, port, options) => {
  const opts = options || {};
  return new Connection({
    host,
    port: typeof port === "string" ? Number.parseInt(port) : port,
    version: 1,
    ...constants.DEFAULT_CLIENT_OPTS,
    ...opts,
  });
};
