const { CLIENT_STATE, METHODS } = require("./constants");
const { packMessage, parseMessage } = require("./message");
class Client {
  constructor(socket, handler) {
    this.socket = socket;
    this.handler = handler;

    // message sequence number
    this.seq = -1;
    this.received_tcp_frames = 0;
    this._ready = false;
    this._drained = true;
    this.waitQueue = [];
    this.state = CLIENT_STATE.IDLE;
    socket.on("data", (data) => {
      this.received_tcp_frames++;
      const cacheBuffer = this.cache
        ? Buffer.concat([this.cache.cacheBuffer, data])
        : data;

      const messages = this.cache
        ? parseMessage(cacheBuffer, this.cache.offset)
        : parseMessage(cacheBuffer);

      if (messages.partial) {
        this.cache = {
          cacheBuffer,
          offset: messages.offset,
        };
      } else {
        this.cache = null;
      }
      this.seq += messages.messages.length;
      if (this.dataHandler) {
        this.dataHandler(messages.messages);
      }
    });
  }
  _processWaitQueue() {
    for (const e of this.waitQueue) {
      this._send(e.opcode, e.buffer);
    }
    this.waitQueue = null;
  }

  _send(opcode, message) {
    this.seq++;
    this.socket.write(packMessage(opcode, this.seq, message));
  }
  on(event, handler) {
    if (event === "data") {
      this.dataHandler = handler;
    } else if (event === "close_internal") {
      this.closeHandler = handler;
    } else if (event === "error") {
      this.errorHandler = handler;
    }
  }
  close() {
    if (!this._ready) {
      if (this.errorHandler)
        this.errorHandler(new Error("cant close in non ready state"));
    }
    this.closeHandler(this);
  }
  send(opcode, data) {
    const handler = this.handler.state.handlers[opcode];
    if (!handler) {
      if (this.errorHandler)
        this.errorHandler(new Error("unknown send handler " + opcode));
    }
    const isGpack = this.method.n === METHODS.GPACK;
    if(isGpack && !Array.isArray(data))
      throw new Error("gpack data is not array");
    const buffer = isGpack ? handler._pack.pack(data) : handler.packer(data, this.method.n, this);
    if (this._ready) {
      this._send(opcode, buffer);
    } else if (
      this.state != CLIENT_STATE.DISCONNECTED &&
      this.state != CLIENT_STATE.DISCONNECTING
    ) {
      if (this.waitQueue === null) this.waitQueue = [];
      this.waitQueue.push({ opcode, buffer });
    } else {
      if (this.errorHandler) {
        this.errorHandler(
          new Error("Tried to send message in faulty state " + this.state)
        );
      }
    }
  }
}
module.exports = Client;
