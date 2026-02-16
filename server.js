const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// সকল একটিভ ইউজার এখানে স্টোর থাকবে { "atik": "socket_id_123", "friend": "socket_id_456" }
let users = {}; 

io.on('connection', (socket) => {
    console.log('New connection:', socket.id);

    // ১. ইউজারনেম রেজিস্টার করা
    socket.on('register-user', (username) => {
        if (users[username]) {
            socket.emit('register-failed', 'Username already taken!');
        } else {
            users[username] = socket.id;
            socket.username = username; // সকেটে নাম সেভ রাখছি
            socket.emit('register-success', username);
            console.log(`User Registered: ${username}`);
        }
    });

    // ২. কল রিকোয়েস্ট পাঠানো
    socket.on('call-user', (data) => {
        const { userToCall, offer } = data;
        const socketIdToCall = users[userToCall];

        if (socketIdToCall) {
            io.to(socketIdToCall).emit('incoming-call', { 
                from: socket.username, 
                offer: offer 
            });
        } else {
            socket.emit('call-error', 'User not found or offline!');
        }
    });

    // ৩. কল এক্সেপ্ট করা (Answer পাঠানো)
    socket.on('call-accepted', (data) => {
        const { to, answer } = data;
        const socketIdToAnswer = users[to];
        if (socketIdToAnswer) {
            io.to(socketIdToAnswer).emit('call-accepted', answer);
        }
    });

    // ৪. কল রিজেক্ট করা
    socket.on('call-rejected', (data) => {
        const socketIdToReject = users[data.to];
        if (socketIdToReject) {
            io.to(socketIdToReject).emit('call-rejected');
        }
    });

    // ৫. ICE Candidate আদান-প্রদান (P2P কানেকশনের জন্য)
    socket.on('ice-candidate', (data) => {
        const { to, candidate } = data;
        const socketIdToSend = users[to];
        if (socketIdToSend) {
            io.to(socketIdToSend).emit('ice-candidate', candidate);
        }
    });

    // ৬. ইউজার ডিসকানেক্ট হলে লিস্ট থেকে নাম মুছে ফেলা
    socket.on('disconnect', () => {
        if (socket.username) {
            delete users[socket.username];
            console.log(`User Disconnected: ${socket.username}`);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
