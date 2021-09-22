export as namespace Sokudo;

export declare enum MethodType {
  NODE_BUFFER,
  MSGPACK,
}

export declare interface Methods {
  NODE_BUFFER: 0;
  MSGPACK: 1;
}

export declare interface Handler<T> {
  op: number;
  eventName: string;
  packer: (data: T, method: MethodType) => Buffer;
  unpacker: (buffer: Buffer, method: MethodType) => T;
}

export declare class Client {
  send(opCode: number, data: any): void;
  close(): void;
}

export declare class Connection {
  useHandler(handler: Handler): void;
  unregisterHandler(name: number | string);
  send(opCode: number, data: any): void;
  close(): void;
  connect(): void;
}

export declare class Server {
  listen(port: number | string, bindAddress?: string): Promise<void | Error>;
  useHandler(handler: Handler): void;
  unregisterHandler(name: number | string);
  on: (event: string, handler: (unpacked, seq: number, client: Client) => void) => void;
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
