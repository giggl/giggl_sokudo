const net = require("net");
const EventEmitter = require("events");

const Client = require("../shared/client");
const constants = require("../shared/constants");
const {
  parseMessage,
  packHandshake,
  parseHandhakeResponse,
} = require("../shared/message");
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
    this.client = null;
    this._ready = false;
  }

  registerListener(handler) {
    const { op, eventName } = handler;
    if (op <= 2) {
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

  connect() {
    if (this._ready) {
      throw new Error("already connected");
    }
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
              this.version = version;
              this.method = method;
              client.method = { n: method };
              client.state = constants.CLIENT_STATE.CONNECTED;
              this._ready = true;
              this.state.connecting = false;
              this.client._ready = true;
              if (this.waitQueue.length) {
                for (const entry of this.waitQueue)
                  client.send(entry.opcode, entry.message);
                this.waitQueue = null;
              }
              this.emit("ready", client);
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
    this.socket.on("close", () => {
      if (
        this.client &&
        this.client.state === constants.CLIENT_STATE.CONNECTED
      ) {
        this.close();
      }
    });
  }

  send(opcode, message) {
    if (this.client === null) {
      this.waitQueue.push({ opcode, message });
      return;
    }
    this.client.send(opcode, message);
  }

  close() {
    delete this.version;
    delete this.method;
    this._ready = false;
    this.client._ready = false;
    this.client.state = constants.CLIENT_STATE.DISCONNECTED;
    this.socket.destroy();
    this.emit("close");
  }

  _sendHandshake() {
    this.client._send(
      constants.OP_CODES.HANDSHAKE,
      packHandshake(this.opts.version, Object.values(constants.METHODS))
    );
  }
}

module.exports = (host, port) => {
  return new Connection({
    host,
    port,
    version: 1,
  });
};
