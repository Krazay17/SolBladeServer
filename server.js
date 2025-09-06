import { Server } from "socket.io";
import { sendDiscordMessage } from "./DiscordStuff.js";
import http from "http";

const PORT = process.env.PORT || 3000;
const server = http.createServer();

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },

});
const isLocal = process.env.PORT === '3000' || process.env.NODE_ENV === 'development' || !process.env.PORT;


let players = {};
// , id: socket.id, pos: {}, state: "", user: ""
io.on('connection', (socket) => {
    socket.offAny();
    players[socket.id] = { socket, lastPing: Date.now(), scene: null, pos: { x: 0, y: 5, z: 0 }, state: null, name: null, money: null };
    console.log('a user connected: ' + socket.id);
    socket.on('disconnect', () => {
        socket.offAny();
        socket.broadcast.emit('playerDisconnected', socket.id);
        socket.broadcast.emit('chatMessageUpdate', { id: 111, data: { player: 'Server', message: `Player Disconnected: ${players[socket.id].name}!`, color: 'red' } });
        if (!isLocal) sendDiscordMessage(`Player Disconnected: ${players[socket.id].name}!`);
        console.log('user disconnected: ' + socket.id);
        delete players[socket.id];
    });
    socket.on('heartbeat', () => {
        players[socket.id].lastPing = Date.now();
        socket.emit('heartbeatAck');
    })

    socket.on('joinGame', (data) => {
        players[socket.id].scene = data.scene;
        players[socket.id].pos = data.pos;
        players[socket.id].state = data.state;
        players[socket.id].name = data.name;
        players[socket.id].money = data.money;
        players[socket.id].health = data.health || 100;
        players[socket.id].blocking = false;

        //Tell players we joined
        socket.broadcast.emit('newPlayer', { netId: socket.id, data });

        //Tell us who is here
        const playerList = Object.keys(players).map(id => ({
            netId: id,
            data: {
                scene: players[id].scene,
                pos: players[id].pos,
                state: players[id].state,
                health: players[id].health,
                name: players[id].name,
                money: players[id].money,
            }
        }));
        socket.emit('currentPlayers', playerList);
        socket.broadcast.emit('chatMessageUpdate', { id: 111, data: { player: 'Server', message: `Player Connected: ${data.name}!`, color: 'white' } });
        if (!isLocal) sendDiscordMessage(`Player Connected: ${data.name}!`);
        socket.on('playerNameSend', (name) => {
            if (players[socket.id]) players[socket.id].name = name;
            socket.broadcast.emit('playerNameUpdate', { id: socket.id, name });
        });

        socket.on('playerPositionSend', (data) => {
            if (players[socket.id]) players[socket.id].pos = data.pos;
            socket.broadcast.emit('playerPositionUpdate', { id: socket.id, data });
        });
        socket.on('playerStateSend', (data) => {
            if (players[socket.id]) players[socket.id].state = data.state;
            socket.broadcast.emit('playerStateUpdate', { id: socket.id, data });
        });
        socket.on('chatMessageSend', ({ player, message }) => {
            socket.broadcast.emit('chatMessageUpdate', { id: socket.id, data: { player, message } });
        });
        socket.on('playerHealthSend', ({ targetId, reason, amount }) => {
            if (!players[targetId]) return;
            switch (reason) {
                case 'damage':
                    if (players[targetId].blocking) {
                        socket.broadcast.emit('playerBlockUpdate', { id: targetId });
                        return;
                    }
                    players[targetId].health = Math.max(players[targetId].health - amount, 0);
                    break;
                case 'heal':
                    players[targetId].health = Math.min(players[targetId].health + amount, 100);
                    break;
                case 'reset':
                    players[targetId].health = 100;
                    break;
                default:
                    players[targetId].health = Math.max(players[targetId].health - amount, 0);
                    break;
            }
            io.emit('playerHealthUpdate', {
                id: socket.id,
                data: {
                    targetId,
                    reason,
                    amount,
                    health: players[targetId].health,
                }
            });
        });
        socket.on('playerCCSend', ({ targetId, type, dir, duration }) => {
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
            socket.broadcast.emit('playerCCUpdate', { id: targetId, data: { type, dir, duration } });
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