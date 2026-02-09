const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.join('voice-room');

    socket.on('offer', (payload) => {
        
        socket.to('voice-room').emit('offer', payload);
    });

    socket.on('answer', (payload) => {
        socket.to('voice-room').emit('answer', payload);
    });

    socket.on('ice-candidate', (incoming) => {
        socket.to('voice-room').emit('ice-candidate', incoming);
    });
});

server.listen(3000, () => {
    console.log('Server is running on http://localhost:3000');
});