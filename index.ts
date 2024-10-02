import * as net from "net";
import * as Connection from "./Connection";

/** while true, read and the write back the data. if empty data, stop */
async function serveClient(conn: Connection.TCPConn): Promise<void> {
    while (true) {
        const data = await Connection.read(conn);
        if (data.length === 0) {
            console.log('end connection');
            break;
        }
        console.log('data: ', data.toString());
        let newData : Buffer = Buffer.from("Echo: "+data.toString());
        await Connection.write(conn, newData);
    }
}


async function init() : Promise<void>  {
    let socket : net.Socket = await Connection.createSocket('127.0.0.1', 1234);
    let conn : Connection.TCPConn = Connection.createConnection(socket);
    try {
        await serveClient(conn);
    } catch (exc) {
        console.error('exception:', exc);
    } finally {
        conn.socket.destroy();
    }
}

init();