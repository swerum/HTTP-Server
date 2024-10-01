"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// const net = require('node:net');
var net = require("net");
function onNewConnection(socket) {
    console.log('new connection', socket.remoteAddress, socket.remotePort);
    /** Set socket events (events that happen when the listening socket is open) */
    socket.on('data', function (data) {
        console.log("data received: ", data.toString());
        socket.write(data);
        if (data.includes('q')) {
            console.log("Ending because of q");
            socket.end();
        }
    });
    socket.on('end', function () {
        console.log("End");
        socket.destroy();
    });
}
//Create Server
var server = net.createServer();
// Set events
server.on('connection', onNewConnection);
server.on('error', function (err) { throw err; });
server.listen({ host: '127.0.0.1', port: 1234 });
