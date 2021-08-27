// base buffer writers parsers
const parseMessage = (buffer, offset = 0) => {
  /*
 For the case that a message is split between two tcp frames,
 we need to be able to recognise that and handle it by caching the buffer and the start of the messsage
 and parse it with the next tcp frame.
*/
  if (buffer.length < 11) return null;
  const messages = [];
  while (offset < buffer.length) {
    const header = buffer.subarray(offset, offset + 4);
    if (header.toString("ascii") !== "GMSG") {
      return { partial: true, messages, offset };
    }
    if (buffer.length < offset + 6) {
      return { messages, partial: true, offset };
    }
    const length = buffer.readUInt16LE(offset + 4);
    if (buffer.length < offset + length + 6) {
      return { messages, partial: true, offset };
    }
    const op = buffer.readUInt8(offset + 6);
    const seq = buffer.readUInt32LE(offset + 7);
    const messageBuffer = buffer.subarray(
      offset + 11,
      offset + 11 + (length - 5)
    );
    messages.push({
      op,
      seq,
      data: messageBuffer,
    });
    offset += length + 6;
  }

  return { partial: false, messages };
};
const packMessage = (op, seq, message) => {
  const totalMessageLength = 1 + 4 + message.length;
  const buffer = Buffer.alloc(4 + 2 + totalMessageLength);
  buffer.write("GMSG", 0);
  buffer.writeUInt16LE(totalMessageLength, 4);
  buffer.writeUInt8(op, 6);
  buffer.writeUInt32LE(seq, 7);
  message.copy(buffer, 11);
  return buffer;
};
const packError = (code, message) => {
  const buffer = Buffer.alloc(2 + message.length);
  buffer.writeUInt16LE(code, 0);
  buffer.write(message, 2);
  return buffer;
};
const parseError = (buffer) => {
  const code = buffer.readUInt16LE(0);
  const message = buffer.slice(2).toString("utf-8");
  return {
    code,
    message,
  };
};
const parseHandshake = (buffer) => {
  const version = buffer.readUInt8(0);
  const supportedMethods = [];
  const amount = buffer.readUInt8(1);
  for (let index = 0; index < amount; index++) {
    supportedMethods.push(buffer.readUInt8(2 + index));
  }
  return {
    version,
    supportedMethods,
  };
};
const packHandshake = (version, methods) => {
  const buffer = Buffer.alloc(2 + methods.length);
  buffer.writeUInt8(version, 0);
  buffer.writeUInt8(methods.length, 1);
  for (let index = 0; index < methods.length; index++) {
    buffer.writeUInt8(methods[index], 2 + index);
  }
  return buffer;
};
const packHandshakeResponse = (version, method) => {
  const buffer = Buffer.alloc(2);
  buffer.writeUInt8(version, 0);
  buffer.writeUInt8(method, 1);
  return buffer;
};
const parseHandhakeResponse = (buffer) => {
  if (buffer.length !== 2) return null;
  return {
    version: buffer.readUInt8(0),
    method: buffer.readUInt8(1),
  };
};
module.exports = {
  parseMessage,
  packMessage,
  parseError,
  packError,
  parseHandshake,
  packHandshake,
  packHandshakeResponse,
  parseHandhakeResponse,
};
