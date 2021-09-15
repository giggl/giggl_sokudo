enum MethodType {
    NODE_BUFFER ,
    MSGPACK 
}
declare interface Methods {
    NODE_BUFFER:number = 0,
    MSGPACK:number = 1,
}

declare interface Handler {
    op: number;
    eventName: string;
    packer: (data: any, method: MethodType) => Buffer;
    unpacker: (buffer: Buffer, method: MethodType) => any;

}

declare class Client {
    send(opCode: number, data: any): void;

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
    version?: number = 1;
    methods: Methods;
}
interface ClientProps {
    autoReconnect?: boolean;
    heartbeatInterval?: number;
    replay?: boolean;
}

declare namespace Sokudo {
    declare function Client(host: string, port: string | number, props?: ClientProps): Connection;
    declare function Server(props?: ServerProps): Server;
}