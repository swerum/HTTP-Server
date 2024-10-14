import * as net from "net";
import * as Connection from "./Connection";
import * as HttpParsing from "./HttpParsing";
import { DynamicBuffer } from "./DynamicBuffer";
import { HTTPError } from "./HttpError";


/** while true, read and the write back the data. if empty data, stop */
async function serveClient(conn: Connection.TCPConn): Promise<void> {
    let dynamicBuffer: DynamicBuffer = new DynamicBuffer();
    while (true) {
        /** read header from socket */
        let headerBuffer: Buffer | null = dynamicBuffer.popHeader();;
        while (headerBuffer === null) {
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
            headerBuffer = dynamicBuffer.popHeader();
        }
        // console.log(headerBuffer.toString());
        const req = HttpParsing.parseHTTPReq(headerBuffer);
        // process the message and send the response
        const reqBody: HttpParsing.BodyReader = HttpParsing.readerFromReq(conn, dynamicBuffer, req);
        const res: HttpParsing.HTTPRes = await HttpParsing.handleReq(req, reqBody);
        await HttpParsing.writeHTTPResp(conn, res);
        // close the connection for HTTP/1.0
        if (req.version === '1.0') {
            return;
        }
        // make sure that the request body is consumed completely
        while ((await reqBody.read()).length > 0) { /* empty */ }
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