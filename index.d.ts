declare enum MethodType {
  NODE_BUFFER,
  MSGPACK,
}

declare interface Methods {
  NODE_BUFFER: 0;
  MSGPACK: 1;
}

declare interface Handler {
  op: number;
  eventName: string;
  packer: <T>(data: T, method: MethodType) => Buffer;
  unpacker: (buffer: Buffer, method: MethodType) => any;
}

declare class Client {
  send(opCode: number, data: any): void;
  close(): void;
}

declare class Connection {
  useHandler(handler: Handler): void;
  unregisterHandler(name: number | string);
  send(opCode: number, data: any): void;
  close(): void;
  connect(): void;
}

declare class Server {
  listen(port: number | string, bindAddress?: string): Promise<void | Error>;
  useHandler(handler: Handler): void;
  unregisterHandler(name: number | string);
}

interface ServerProps {
  version?: number;
  methods: Methods;
}

interface ClientProps {
  autoReconnect?: boolean;
  heartbeatInterval?: number;
  replay?: boolean;
}

declare namespace Sokudo {
  function Client(
    host: string,
    port: string | number,
    props?: ClientProps
  ): Connection;
  function Server(props?: ServerProps): Server;
}
