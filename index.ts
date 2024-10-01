import * as net from "net";


function onNewConnection(socket: net.Socket): void {
    console.log('new connection', socket.remoteAddress, socket.remotePort);
    /** Set socket events (events that happen when the listening socket is open) */
    socket.on('data', (data : Buffer) => {
        console.log("data received: ", data.toString());
        socket.write(data);

        if (data.includes('q')) {
            console.log("Ending because of q");
            socket.end();
        }
    });
    socket.on('end', () => {
        console.log("End");
    })
}

//Create Server
let server = net.createServer();

// Set events
server.on('connection', onNewConnection);
server.on('error', (err: Error) => { throw err; });

server.listen({host: '127.0.0.1', port: 1234});