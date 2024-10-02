import * as net from "net";
import * as Connection from "./Connection";
import { DynamicBuffer } from "./dynamicBuffer";
import { assert } from "console";

/** while true, read and the write back the data. if empty data, stop */
async function serveClient(conn: Connection.TCPConn): Promise<void> {
    let dynamicBuffer : DynamicBuffer = new DynamicBuffer();
    while (true) {
        /** Get message */
        let message : Buffer | null= dynamicBuffer.popMessage(); ;
        while (message === null) {
            //read data
            const data = await Connection.read(conn);
            // console.log("Data: "+data.toString());
            if (data.length === 0) {
                console.log('end connection');
                return;
            }
            //push data to dynamic buffer and check if it creates a message
            dynamicBuffer.push(data);
            message = dynamicBuffer.popMessage();   
        }
        /** Handle message */
        console.log('message: ', message!.toString());
        
        if (message!.equals(Buffer.from("quit\n"))) {
            let newData : Buffer = Buffer.from("Bye.\n");
            await Connection.write(conn, newData);
            conn.socket.destroy();
        } else { 
            let newData : Buffer = Buffer.from("Echo: "+message!.toString()); 
            await Connection.write(conn, newData);
        }
        
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
        conn.socket.destroy();false;
    }
}

init();