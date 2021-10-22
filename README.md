# Sokudo
Custom TCP protocol for low latency message transfer.

## Description
Soludo was developed by Giggl for internal purposes where the performance of Websockets is not sufficient.
The aim is to provide low latency with average abstraction to the user.

## Installation
NPM:
```sh
npm i --save sokudo
```
Yarn:
```sh
yarn add sokudo
```

## Quick Example
If you just want a simple example of how to use Sokudo you are right here.
Note that this example uses **Gpack**
### Server
```js
const { Server } = require("sokudo");
const exampleHandler = {
  op: 5,
  eventName: "example_name",
  structure: ["string", "uint16", "float", "int32"],
}
const app = Server();
app.useHandler(exampleHandler);

app.listen(3015, "127.0.0.1");

app.on(exampleHandler.eventName, (payload, seq, client) => {
  console.log(payload)
});
```
### Client
```js
const { Client } = require("sokudo");
const exampleHandler = {
  op: 5,
  eventName: "example_name",
  structure: ["string", "uint16", "float", "int32"],
}

const connection = new Client("127.0.0.1", 3015);
connection.useHandler(exampleHandler);
connection.on("ready", () => {
  connection.send(exampleHandler.op, ["SomeString", 123, 56.45, 2021]);
});

app.on(exampleHandler.eventName, (payload, seq, client) => {
  console.log(payload)
});

connection.connect();
```

## Message Serialisation & Deserialisation
Sokudo has two main ways to serialise and deserialise messages.

1. **Node Buffers**
Using this way the serialisation and deserialisation process are processed by the handler its self, which requires more logic implementation but may be able to increase performance in return.
This works by providing the handler with two *middleware* functions, this example will serialise 3 numbers in the signed 32bit range.
  1. The first is the property `packer` and is responsible for creating a in binary serialised version of the data, note that the data in this case does not need to follow a specific format or type pattern.
    This packer is then called by sokudo internally which makes it a middleware.
    ```js
    const Handler = {
        // ...
        packer: (data, method) => {
          const buffer = Buffer.alloc(12);
          buffer.writeInt32LE(data.x, 0);
          buffer.writeInt32LE(data.y, 4);
          buffer.writeInt32LE(data.z, 8);
          return buffer;
        }
    }
     ```
    In this example we serialise x,y,z into a node buffer by using the provided Apis node provides.
The Parameters here are:
      * `data: any` - This is the data provided to the send function, it can be anything which is not null or undefined, it will work with primitives too.
      * `method: number` - Comes from options passed to the client structure, its a number containing the serialisation method the client and server have agreed upon the handshake process, this needs to be used when clients can be expected to use different methods for serialising data.

   2. The second property is called `unpacker` and is responsible for taking a buffer and returning the original data deserialised again, the pattern is very similar to the packer with the difference being the first argument containing a node buffer which is the message and returning any datatype representing ht  e original data.
     ```js
        const hander = {
          //...
          unpacker: (buffer, method) => {
            const parsed_content = {
              x: buffer.readInt32LE(0),
              y: buffer.readInt32LE(4),
              z: buffer.readInt32LE(8),
          };
          return parsed_content;
         }
       }
    ```
   Here we take the received buffer and read the original x,y,z numbers back into a JavaScript Object and return this.
   The Parameters here are:
     * `buffer: Buffer` - the data received over the network, sokudo will deliver complete messages to this but the parsing itself is responsibility of the unpacker. Since this is middleware sokudo will only forward the returned data to the event handlers.
     * `method: number` - this is the exact same as when serialisingm, the client/server agreed method for serialising and deserialising messages.

2. **Gpack**
Using this api, the serialisation and deserialisation are done by Sokudo internally using a very space efficient one dimensional serialisation approach.
The api usage does not change from manual approach (1) but requires less code.
Using Gpack a handler could look like the following:
```js
const handler = {
    // ...,
    structure: ["int32", "string", "double"]
}
```
This will internally create a pack which has the above structure.
Gpack requires that when sending a message, the data passed is an ordered array of values!

  So given the above example

  **Wrong**:
  ```js
    connection.send(handler.op, ["my string value", 45, 56.454546]); // WRONG
  ```
  **Correct**:
  ```js
    connection.send(handler.op, ["23", "my string value", 56.454546]); // CORRECT
  ```
  Also note that **At the moment** there is a string length limitation of 2^16-1 due to the fact the string length has to be encoded with the message payload.
Otherwise there are no limiations or required steps besides that both client and server need to agree to the method of GPACK, further you should pass the options property: `preferGpack: true` to both server and client which can shorten handshake time.


## API
Definition of apis.
### Handlers
Handlers are Objects pasesd to either clients OR the server and describe how to pack and unpack a certain message.
A Handler has 4 properties

* `op: number` - This defines the Op Code which will also be send across the network, needs to be 5 or higher, lower values are reserved.
* `eventName:string` - this is a string which shall be used when registering a listener for this message type, i.e .`app.on()`. this cannot be a number as by design of the Node EventEmitter API.
* `packer?: (data: any, method: number): Buffer` - This will be called before send and is there so serialise the message into a Buffer, now that is done, is free to be decided, not required when gpack is used.
* `unpacker?: (buffer: Buffer, method: number): any` - this is the reverse of the packer which takes a buffer and reconstructs it into Javascript data, not required when using gpack.
* `structure?: string[]` - When submitted sokudo will treat this as a gpack handler and use that if available, it will fallback to packer/unpacker if either client or server do not support gpack.

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

### Gpack types.

* string: expects and parses a utf8 encoded string.
* binary: raw buffer, will be copied 1:1.
* int8: signed 1 byte integer
* uint8: unsigned 1 byte integer.
* int16: signed 2 byte integer
* uint16: unsigned 2 byte integer.
* int32: signed 4 byte integer
* uint32: unsigned 4 byte integer.
* int64: signed 8 byte integer, note that this returns a `BigInt` and not a `number`.
* uint64: unsigned 8 byte integer, note that this returns a `BigInt` and not a `number`.
* float: 4 byte signed floating point number.
* double: 8 byte signed floating point number.

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
