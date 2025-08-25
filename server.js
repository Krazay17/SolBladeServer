import { Server } from "socket.io";
import http from "http";

const PORT = process.env.PORT || 3000;
const server = http.createServer();

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

io.on('connection', (socket) => {
    console.log('a user connected: ' + socket.id);
    socket.on('disconnect', () => {
        console.log('user disconnected: ' + socket.id);
    });
});

server.listen(PORT);
console.log('Sever is running on port 3000');