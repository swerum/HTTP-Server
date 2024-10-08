import * as net from "net";
import * as Connection from "./Connection";
import { DynamicBuffer } from "./dynamicBuffer";
import { HTTPError } from "./HttpError";


/** while true, read and the write back the data. if empty data, stop */
async function serveClient(conn: Connection.TCPConn): Promise<void> {
    let dynamicBuffer: DynamicBuffer = new DynamicBuffer();
    while (true) {
        /** read header from socket */
        let header: Buffer | null = dynamicBuffer.popHeader();;
        while (header === null) {
            //read data
            const data = await Connection.read(conn);
            if (data.length === 0) { //EOF
                if (dynamicBuffer.dataLength === null) {
                    throw new HTTPError(400, "Unexpected EOF");
                } else {
                    continue;
                }
            }
            //push data to dynamic buffer and check if it creates a message
            dynamicBuffer.push(data);
            header = dynamicBuffer.popHeader();
        }

    }
}


async function init(): Promise<void> {
    let socket: net.Socket = await Connection.createSocket('127.0.0.1', 1234);
    let conn: Connection.TCPConn = Connection.createConnection(socket);
    try {
        await serveClient(conn);
    } catch (exc) {
        console.error('exception:', exc);
    } finally {
        conn.socket.destroy(); false;
    }
}

init();