import * as net from "net";

export {
    TCPConn,
    createConnection,
    createSocket,
    read,
    write
}

type TCPConn = {
    // the JS socket object
    socket: net.Socket;
    // from the 'error' event
    err: null | Error;
    // EOF, from the 'end' event
    ended: boolean;
    // the callbacks of the promise of the current read
    reader: null | {
        resolve: (value: Buffer) => void,
        reject: (reason: Error) => void,
    };
};

//Create Server
async function createSocket(host: string, port: number): Promise<net.Socket> {
    return new Promise((resolve, reject) => {
        let server = net.createServer();
        server.on('connection', resolve);
        server.on('error', reject);
        server.listen({ host: host, port: port });
    });
}


/** soInit sets up what happens to our promise in various events 
 * on data: resolve read with data. reset reader since the promise is resolved
 * on end: resolve with empty data buffer 
 * on error: reject promise
*/
function createConnection(socket: net.Socket): TCPConn {
    const conn: TCPConn = {
        socket: socket, err: null, ended: false, reader: null,
    };
    socket.on('data', (data: Buffer) => {
        console.assert(conn.reader);
        conn.socket.pause();
        conn.reader!.resolve(data);
        conn.reader = null;
    });
    socket.on('end', () => {
        // this also fulfills the current read.
        conn.ended = true;
        if (conn.reader) {
            conn.reader.resolve(Buffer.from(''));   // EOF is signaled by empty buffer
            conn.reader = null;
        }
    });
    socket.on('error', (err: Error) => {
        // errors are also delivered to the current read.
        conn.err = err;
        if (conn.reader) {
            conn.reader.reject(err);
            conn.reader = null;
        }
    });
    return conn;
}

/** soRead creates the promise. if the connection is already interrupted, reject/resolve with empty buffer
 * Otherwise, store resolve and reject in connection object
 */
function read(conn: TCPConn): Promise<Buffer> {
    console.assert(!conn.reader);   // no concurrent calls
    return new Promise((resolve, reject) => {
        // if the connection is not readable, complete the promise now.
        if (conn.err) {
            reject(conn.err);
            return;
        }
        if (conn.ended) {
            resolve(Buffer.from(''));   // signal for EOF
            return;
        }

        // save the promise callbacks
        conn.reader = { resolve: resolve, reject: reject };
        // and resume the 'data' event to fulfill the promise later.
        conn.socket.resume();
    });
}

/** check for connection error. create promise for writing.  */
function write(conn: TCPConn, data: Buffer): Promise<void> {
    console.assert(data.length > 0);
    return new Promise((resolve, reject) => {
        if (conn.err) {
            reject(conn.err);
            return;
        }

        conn.socket.write(data, (err?: Error) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
}