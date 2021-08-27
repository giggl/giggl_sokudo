const net = require("net");
const EventEmitter = require("events");

const constants = require("../shared/constants");
const Client = require("../shared/client");
const {
  packError,
  parseHandshake,
  packHandshakeResponse,
} = require("../shared/message");

const RESERVED_NAMES = constants.RESERVED_NAMES;

class Server extends EventEmitter {
  constructor(props) {
    super();
    this.state = {
      opCodes: { ...constants.OP_CODES },
      listeners: {},
      handlers: {},
      clients: {},
      props: { ...constants.DEFAULT_SERVER_PROPS, ...props },
    };
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

  _cleanupClient(client, failed = false) {
    delete this.state.clients[client.socket];

    client.socket.destroy();
    client._ready = false;
    client.state = failed
      ? constants.CLIENT_STATE.FAILED
      : constants.CLIENT_STATE.DISCONNECTED;
  }
  _readyClient(client) {
    client._ready = true;
    client.state = constants.CLIENT_STATE.CONNECTED;
    this.state.clients[client.socket] = client;
    this.emit("client_ready", client);
    client._processWaitQueue();
  }

  _handleHandshake(client, message) {
    const parsedHandshake = parseHandshake(message);
    if (parsedHandshake.version > this.state.props.version) {
      const error = packError(2, "server unsupported version");
      client._send(constants.OP_CODES.ERROR, error);
      return false;
    }
    const opts = this.state.props.methods;
    // start with lowest
    const sorted = parsedHandshake.supportedMethods.sort();
    for (const clientOpt of sorted) {
      for (const opt in opts) {
        if (opts[opt] === clientOpt) {
          client.version = parsedHandshake.version;
          client.method = {
            key: opt,
            n: opts[opt],
          };
          const packed = packHandshakeResponse(
            parsedHandshake.version,
            opts[opt]
          );
          client._send(constants.OP_CODES.HANDSHAKE_ACK, packed);
          return true;
        }
      }
    }
    // if we get here theres no supported method
    const error = packError(3, "client unsupported version");
    client._send(constants.OP_CODES.ERROR, error);
    return false;
  }

  _handleIncomingConnection(socket) {
    const client = new Client(socket, this);
    client.state = constants.CLIENT_STATE.HANDSHAKE;
    socket.on("close", () => {
      if (
        client.state == constants.CLIENT_STATE.CONNECTED ||
        client.state == constants.CLIENT_STATE.DISCONNECTING
      ) {
        this.emit("client_close", client);
      }
      this._cleanupClient(client);
    });
    socket.on("error", (error) => {
      this.emit("error", error);
    });
    client.on("close_internal", () => {
      client._ready = false;
      client.state = constants.CLIENT_STATE.DISCONNECTING;
      //this will trigger the other close event above and emit the close to listeners that way
      socket.destroy();
    });
    client.on("error", (err) => {
      this.emit("error", err);
    });
    socket.on("end", () => {
      client.emitted_end = true;
    });

    client.on("data", (messages) => {
      if (!messages.length) return;
      const rawMessage = messages[0];
      if (rawMessage === null) {
        this.emit("invalid_message", {
          client,
          data,
        });
        return;
      }
      if (client.state === constants.CLIENT_STATE.HANDSHAKE) {
        if (rawMessage.op === 0) {
          const result = this._handleHandshake(client, rawMessage.data);
          if (result) this._readyClient(client);
          else this._cleanupClient(client);
        } else {
          const retry = client.handshake_retry || 0;
          if (retry === 3) {
            this._cleanupClient(client);
            return 0;
          }
          client.handshake_retry = retry + 1;
          const error = packError(1, "non handhake during handshake");
          client._send(constants.OP_CODES.ERROR, error);
        }
      } else if (rawMessage.op === constants.OP_CODES.KEEP_ALIVE_ACK) {
        client._send(constants.OP_CODES.KEEP_ALIVE_ACK, rawMessage.data);
      } else if (client.state === constants.CLIENT_STATE.CONNECTED) {
        for (const message of messages) {
          const handler = this.state.handlers[message.op];
          if (!handler) {
            throw new Error("received unhandeled op" + message.op);
          }
          const unpacked = handler.unpacker(
            message.data,
            client.method.n,
            client
          );
          this.emit(handler.eventName, unpacked, message.seq, client);
        }
      } else {
        this.emit(
          "error",
          new Error("Client fired message in faulty state: " + client.state)
        );
      }
    });
  }
  _createListener(bindAddress, port) {
    return new Promise((resolve, reject) => {
      let settled = false;
      let success = false;
      const pending = [];
      const server = net
        .createServer((socket) => {
          if (settled && success) {
            this._handleIncomingConnection(socket);
          } else {
            pending.push(socket);
          }
        })
        .on("error", (err) => {
          if (!settled) {
            reject(err);
            settled = true;
            return;
          }
        });
      server.listen(
        {
          host: bindAddress,
          port,
          exclusive: true,
        },
        () => {
          if (!settled) {
            this.state.listeners[port] = {
              bindAddress,
              server,
            };
            resolve();
            success = true;
            settled = true;
            // then process pending connections
            for (const socket of pending) {
              this._handleIncomingConnection(socket);
            }
          }
        }
      );
    });
  }
  listen(port, bindAddress = "0.0.0.0") {
    port = typeof port === "string" ? Number.parseInt(port) : port;
    if (this.state.listeners[port]) return Promise.resolve();
    return this._createListener(bindAddress, port);
  }
}
module.exports = (props) => {
  return new Server(props || {});
};
