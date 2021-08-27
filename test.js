const Server = require("./server");
const Client = require("./client");
const TEST_OPS = {
  TEXT_TEST: 5,
  MOUSE_MOVE: 6,
};

const testHandler = {
  op: TEST_OPS.TEXT_TEST,
  eventName: "test_event",
  packer: (data, method) => {
    const buffer = Buffer.alloc(4 + data.message.length);
    buffer.writeInt32LE(data.index, 0);
    buffer.write(data.message, 4);
    return buffer;
  },
  unpacker: (buffer, method) => {
    const index = buffer.readInt32LE();
    return {
      index,
      message: buffer.slice(4).toString("utf-8"),
    };
  },
};
const testHandler2 = {
  op: TEST_OPS.MOUSE_MOVE,
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
//server
const app = Server({});
app.useHandler(testHandler);
app.useHandler(testHandler2);

app.on("client_close", (client) => {
  console.log("server client closed");
});
app.on("err", (err) => {
  //  console.log("server client closed");
  });
const indexes = {};
app.on("test_event", (unpacked, seq, client) => {
  indexes[unpacked.index] = 1;
  console.log(unpacked, seq);
  client.send(TEST_OPS.MOUSE_MOVE, {
    x: 123,
    y: 456,
    index: unpacked.index,
  });

  //   client.close();
  // client.send(6, {
  //     x: 123,
  //     y: 456
  // })
});
// client

if (process.env.SERVER) {
  app.listen(3015).then(res => {
      console.log("server ready")
  })

} else {
  const client = Client("192.168.178.39", 3015, {
      autoReconnect: true
  });
  client.useHandler(testHandler);
  client.useHandler(testHandler2);
  client.on("error", (err, willRetry) => {
     console.log(err, willRetry);
  });
  for (let index = 0; index < 6; index++) {
    client.send(TEST_OPS.TEXT_TEST, {
      message: `this will ${
        index % 5 === 0
          ? Array(34)
              .fill()
              .map(() => "a")
              .join("")
          : ""
      } be queued before ready ${index + 1}`,
      index: index + 1,
    });
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
    client.send(TEST_OPS.TEXT_TEST, {
      message: "how are you",
      index: -1,
    });
    let index = 0;
    setInterval(() => {
      client.send(TEST_OPS.TEXT_TEST, {
        message: `this will ${
          index % 5 === 0
            ? Array(32)
                .fill()
                .map(() => "a")
                .join("")
            : ""
        } be queued before ready ${index + 1}`,
        index: index + 1,
      });
      index++;
    }, 2);
  });
  client.connect();
}
