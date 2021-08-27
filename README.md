# sokudo
Custom TCP protocol for low latency message transfer.

## Handlers
Handlers are Objects pasesd to either clients OR the server and describe how to pack and unpack a certain message.
A Handler has 4 properties
* `op: number` - This defines the Op Code which will also be send across the network, needs to be 5 or higher, lower values are reserved.
* `eventName:string` - this is a string which shall be used when registering a listener for this message type, i.e .`app.on()`. this cannot be a number as by design of the Node EventEmitter API.
* `packer: (data: any, method: number): Buffer` - This will be called before send and is there so serialise the message into a Buffer, now that is done, is free to be decided.
* `unpacker: (buffer: Buffer, method: number): any` - this is the reverse of the packer which takes a buffer and reconstructs it into Javascript data.

Example which writes 3 numbers:
```js
const testHandler2 = {
  op: 5,
  eventName: "mouse_event",
  packer: (data, method) => {
    const buffer = Buffer.alloc(12);
    buffer.writeInt32LE(data.x, 0);
    buffer.writeInt32LE(data.y, 4);
    buffer.writeInt32LE(data.index, 8);
    return buffer;
  },
  unpacker: (buffer, method) => {
    return {
      x: buffer.readInt32LE(0),
      y: buffer.readInt32LE(4),
      index: buffer.readInt32LE(8),
    };
  },
};
```

## Example Usage
Server:  
```js
const Server = require("./server")

const app = Server();
app.useHandler(someHandler);
app.on(someHandler.eventName, (unpacked, seq, client) => {
    client.send(SomeOpCode, {some: data})
});
// takes the port and the bind address(default "0.0.0.0") and returns a promise once that listener is ready
server.listen(3015, "0.0.0.0")


// the server also exposes the following events.
app.on("client_close", (client) => {
  console.log("client disconnected!");
});
// this is invoked when a new client passed the handshake and is ready
app.on("client_ready", (client) => {
  console.log("client connected!");
});

```

Client: 
```js
const Client = require("./client")

const client = new Client("localhost", 3015, {
    autoReconnect: true, //should the connection be broken, auto reconnect to the server
    heartbeatInterval: 250, // in millisconds, sends these to make sure the connection is still active, note that if the server sends any message that also counts as a heartbeat refresh.
    replay: true, // While theres a disconnect, cache messages and replay them to the server noce reconnected, note that for messages send before the 'ready' event, this will be done either way.
})
```
To use a Handler:
```js
client.useHandler(someHandler);
```
To listen to messages of a certain handler
```js
client.on(someHandler.eventName, (unpacked, client) => {
    client.send(SomeOpCode, {some: data})
});
```
`ready` this is emitted when the connection is established the first time and the handshake was successful,  
it is possible to send data before this. it will then be queued and send once connected  
```js
client.on('ready', () => {
    client.send(SomeOp, 'data')
})
```
`reconnect` is emitted if a reconnect was sucessful 
```js
client.on('reconnect', () => {
    
})
```
`error` is emitted when theres an issue with the connection to the server.  
if reconnecting is enabled this is when the auto reconnect loop internally starts, `reconnect` will be emitted when this was sucessful
```js
client.on('error', () => {

})
```
`close` will be emitted after a call to `client.close()` or after a connection has been broken with auto reconnect turned off
```js
client.on('close', () => {
})
```