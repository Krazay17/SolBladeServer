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

let players = {};
// , id: socket.id, pos: {}, state: "", user: ""
io.on('connection', (socket) => {
    players[socket.id] = { socket, lastPing: Date.now(), scene: null, pos: { x: 0, y: 5, z: 0 }, state: null, name: null, money: null };
    console.log('a user connected: ' + socket.id);
    socket.on('disconnect', () => {
        socket.broadcast.emit('playerDisconnected', socket.id);
        console.log('user disconnected: ' + socket.id);
        delete players[socket.id];
    });
    socket.on('heartbeat', () => {
        players[socket.id].lastPing = Date.now();
    })

    socket.on('joinGame', (data) => {
        players[socket.id].scene = data.scene;
        players[socket.id].pos = data.pos;
        players[socket.id].state = data.state;
        players[socket.id].name = data.name;
        players[socket.id].money = data.money;
        players[socket.id].health = data.health || 100;
        players[socket.id].blocking = data.blocking || false;

        //Tell players we joined
        socket.broadcast.emit('newPlayer', { id: socket.id, data });

        //Tell us who is here
        const playerList = Object.keys(players).map(id => ({
            id,
            data: {
                scene: players[id].scene,
                pos: players[id].pos,
                state: players[id].state,
                name: players[id].name,
                money: players[id].money,
            }
        }));
        socket.emit('currentPlayers', playerList);

        socket.on('playerPositionRequest', (data) => {
            socket.broadcast.emit('playerPositionUpdate', { id: socket.id, data });
        });
        socket.on('playerStateRequest', (data) => {
            socket.broadcast.emit('playerStateUpdate', { id: socket.id, data });
        });
        socket.on('chatMessageRequest', ({ player, message }) => {
            socket.broadcast.emit('chatMessageUpdate', { id: socket.id, data: { player, message } });
        });
        socket.on('playerHealthRequest', ({ targetId, reason, amount }) => {
            if (!players[targetId]) return;
            const health = players[targetId].health;
            switch (reason) {
                case "damage":
                    if (players[targetId].blocking) {
                        socket.broadcast.emit('playerBlockUpdate', { id: targetId });
                        return;
                    }
                    players[targetId].health -= amount;
                    break;
                default:
                    players[targetId].health += amount;
                    break;
            }
            socket.broadcast.emit('playerHealthUpdate', {
                id: socket.id,
                data: {
                    targetId,
                    reason,
                    amount,
                    health,
                }
            });
        });
        socket.on('playerCCRequest', ({ targetId, type, x, y, z }) => {
            if (!players[targetId]) return;
            switch (type) {
                case 'knockback':
                    if (players[targetId].blocking) {
                        socket.broadcast.emit('playerBlockUpdate', { id: targetId });
                        return;
                    }
                    break;
                default:
                    console.warn(`Unknown CC type: ${type}`);
            }
            socket.broadcast.emit('playerCCUpdate', { id: targetId, data: { type, x, y, z } });
        });
    });
});


setInterval(() => {
    Object.keys(players).forEach(key => {
        const player = players[key];
        if (!player) return;

        if (Date.now() - player.lastPing > 5000) {
            console.log(`Disconnecting inactive player: ${key}`);
            player.socket.disconnect(true);
        }
    });
}, 2500);

server.listen(PORT);
console.log(`Server is running on port ${PORT}`);