export as namespace Sokudo;

export declare enum MethodType {
  NODE_BUFFER,
  MSGPACK,
  GPACK,
}

export declare interface Methods {
  NODE_BUFFER: 0;
  MSGPACK: 1;
  GPACK: 2;
}

export declare interface Handler<T> {
  op: number;
  eventName: string;
  structure?: string[];
  packer?: (data: T, method: MethodType) => Buffer;
  unpacker?: (buffer: Buffer, method: MethodType) => T;
}

export declare class Client {
  send(opCode: number, data: any): void;
  close(): void;
}

export declare class Connection {
  useHandler(handler: Handler<*>): void;
  unregisterHandler(name: number | string): void;
  send(opCode: number, data: any): void;
  close(): void;
  connect(): void;
}

export declare class Server {
  listen(port: number | string, bindAddress?: string): Promise<void | Error>;
  useHandler(handler: Handler<*>): void;
  unregisterHandler(name: number | string): void;;
  on: (event: string, handler: (unpacked, seq: number, client: Client) => void) => void;
}

interface ServerProps {
  version?: number;
  methods: Methods;
  preferGpack: boolean;
}

interface ClientProps {
  autoReconnect?: boolean;
  heartbeatInterval?: number;
  replay?: boolean;
  preferGpack: boolean;
}

export function Client(
  host: string,
  port: string | number,
  props?: ClientProps
): Connection;

export function Server(props?: ServerProps): Server;
