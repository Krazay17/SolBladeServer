import { Server } from "socket.io";

const io = new Server(3000, {
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

console.log('Sever is running on port 3000');