const {Server} = require("./index");
const {Client} = require("./index");
const TEST_OPS = {
  TEXT_TEST: 5,
  MOUSE_MOVE: 6,
};

const testHandler = {
  op: TEST_OPS.TEXT_TEST,
  eventName: "test_event",
  structure: ["int32", "string"],
  packer: (data, method) => {
    console.log("called");
    const buffer = Buffer.alloc(4 + data[1].length);
    buffer.writeInt32LE(data[0], 0);
    buffer.write(data[1], 4);
    return buffer;
  },
  unpacker: (buffer, method) => {
    console.log("called 2");
    const index = buffer.readInt32LE();
    return [
      index,
       buffer.slice(4).toString("utf-8"),
   ];
  },
};
const testHandler2 = {
  op: TEST_OPS.MOUSE_MOVE,
  eventName: "mouse_event",
  structure: ["int32", "int32", "int32"],
  packer: (data, method) => {
    const buffer = Buffer.alloc(12);
    buffer.writeInt32LE(data[0], 0);
    buffer.writeInt32LE(data[1], 4);
    buffer.writeInt32LE(data[2], 8);
    return buffer;
  },
  unpacker: (buffer, method) => {
    return [
       buffer.readInt32LE(0),
       buffer.readInt32LE(4),
      buffer.readInt32LE(8),
    ];
  },
};
//server
const app = Server({preferGpack: true});
app.useHandler(testHandler);
app.useHandler(testHandler2);

app.on("client_close", (client) => {
  console.log("server client closed");
});
app.on("error", (err) => {
  //  console.log("server client closed");
});
const indexes = {};
app.on("test_event", (unpacked, seq, client) => {
  if(unpacked[0] % 5000 === 0)
  console.log(unpacked);
  if (seq % 5 === 0) {
    client.send(TEST_OPS.MOUSE_MOVE, [
       123,
       456,
       unpacked.index,
    ]);
  }

  //   client.close();
  // client.send(6, {
  //     x: 123,
  //     y: 456
  // })
});
// client

if (process.env.SERVER) {
  app.listen(2000).then((res) => {
    console.log("server ready");
  });
} else {
  const client = Client("r730", 2000, {
    autoReconnect: true,

  });
  client.useHandler(testHandler);
  client.useHandler(testHandler2);
  client.on("error", (err, willRetry) => {
    console.log(err, willRetry);
  });
  for (let index = 0; index < 6; index++) {
    client.send(TEST_OPS.TEXT_TEST, [index+1,
    `this will ${
        index % 5 === 0
          ? Array(34)
              .fill()
              .map(() => "a")
              .join("")
          : ""
      } be queued before ready ${index + 1}`,
    ]);
  }
  const c = [];
  client.on("mouse_event", (data, seq) => {
    c.push({
      data,
      seq,
    });
  });

  client.on("close", () => {
    console.log("client fired close");
    // client.send(TEST_OPS.TEXT_TEST, "how are you")
  });
  client.on("reconnect", () => {
    console.log("reconnected!");
  });
  client.on("ready", () => {
    console.log("client emitted ready");
    client.send(TEST_OPS.TEXT_TEST, [
       -1,
       "how are you",
    ]);
    let index = 0;
    setInterval(() => {
      for(let i = 0; i < 1000; i++) {
        client.send(TEST_OPS.TEXT_TEST, [
          index + 1,
           `${
            (index + 1) % 5 === 0
              ? Array(15)
                  .fill()
                  .map(() => "A")
                  .join("")
              : ""
          } ${index + 1}`,
        ]);
        index++;
      }
    }, 500);
  });
  client.connect();
}
