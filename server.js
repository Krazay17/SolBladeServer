import { Server } from "socket.io";
import { sendDiscordMessage } from "./DiscordStuff.js";
import http from "http";
import GameMode from "./src/GameMode.js";
import PickupManager from "./src/PickupManager.js";
import MyEventEmitter from "./src/MyEventEmitter.js";

const PORT = process.env.PORT || 3000;
const server = http.createServer();

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },

});
const isLocal = process.env.PORT === '3000' || process.env.NODE_ENV === 'development' || !process.env.PORT;

const pickups = new PickupManager(io);
const gameMode = new GameMode("crown", io, pickups);
let players = {};
// , id: socket.id, pos: {}, state: "", user: ""
io.on('connection', (socket) => {
    if (socket.bound) return;
    socket.bound = true;

    socket.on("join-voice", () => {
        // tell everyone else to start connecting to this peer
        socket.broadcast.emit("new-peer", socket.id);
    });

    // Tell others a new client joined
    socket.broadcast.emit("new-peer", socket.id);

    // Relay messages to a specific peer
    socket.on("offer", ({ targetId, offer }) => {
        io.to(targetId).emit("offer", { from: socket.id, offer });
    });
    socket.on("answer", ({ targetId, answer }) => {
        io.to(targetId).emit("answer", { from: socket.id, answer });
    });
    socket.on("candidate", ({ targetId, candidate }) => {
        io.to(targetId).emit("candidate", { from: socket.id, candidate });
    });

    players[socket.id] = {
        socket,
        lastPing: Date.now(),
        scene: null,
        pos: { x: 0, y: 5, z: 0 },
        state: null,
        name: null,
        money: null
    };
    console.log('a user connected: ' + socket.id);
    socket.on('disconnect', () => {
        socket.broadcast.emit('playerDisconnected', socket.id);
        socket.broadcast.emit("peer-disconnect", socket.id);
        MyEventEmitter.emit('playerDisconnected', socket.id)
        socket.broadcast.emit('chatMessageUpdate', { id: 111, data: { player: 'Server', message: `Player Disconnected: ${players[socket.id].name}!`, color: 'red' } });
        if (!isLocal) sendDiscordMessage(`Player Disconnected: ${players[socket.id].name}!`);
        console.log('user disconnected: ' + socket.id);
        gameMode.removePlayer(players[socket.id]);
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
                hasCrown: players[id].hasCrown || false,
            }
        }));
        socket.emit('currentPlayers', playerList);
        socket.broadcast.emit('chatMessageUpdate', { id: 111, data: { player: 'Server', message: `Player Connected: ${data.name}!`, color: 'white' } });
        if (!isLocal) sendDiscordMessage(`Player Connected: ${data.name}!`);

        gameMode.addPlayer(players[socket.id]);

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
        socket.on('playerDamageSend', ({ attacker, targetId, dmg, cc }) => {
            if (!players[targetId]) return;
            if (players[targetId].blocking) {
                socket.broadcast.emit('playerBlockedUpdate', targetId);
                return;
            }
            players[targetId].health = Math.max(players[targetId].health - dmg.amount, 0);
            io.emit('playerDamageUpdate', {
                targetId,
                data: {
                    attacker,
                    health: players[targetId].health,
                    dmg,
                    cc,
                }
            });
        });
        socket.on('playerRespawnUpdate', (data) => {
            if (players[socket.id]) {
                players[socket.id].pos = data.pos;
                players[socket.id].health = data.health || 100;
                players[socket.id].blocking = false;
            }
            socket.broadcast.emit('playerRespawnUpdate', { id: socket.id, data });
        });
        socket.on('playerBlockUpdate', (blocking) => {
            if (players[socket.id]) {
                const health = players[socket.id].health;
                if (health <= 0) return;
                players[socket.id].blocking = blocking;
                socket.broadcast.emit('playerBlockedUpdate', { id: socket.id, blocking, health });
            }
        });
        socket.on('fx', (data) => {
            socket.broadcast.emit('fx', data);
        });
        socket.emit('currentPickups', pickups.getAllPickups());
        socket.on('pickupCollected', ({ itemId }) => {
            const pickup = pickups.getPickup(itemId)
            if (pickup && pickup.active) {
                io.emit('pickupCollected', { playerId: socket.id, itemId });
                pickups.removePickup(itemId);
            }
        });
        socket.on('pickupCrown', () => {
            players[socket.id].hasCrown = true;
            socket.broadcast.emit('pickupCrown', { playerId: socket.id });
            gameMode.pickupCrown(players[socket.id]);
        })
        socket.on('dropCrown', (position) => {
            players[socket.id].hasCrown = false;
            socket.broadcast.emit('dropCrown', { playerId: socket.id });
            gameMode.dropCrown(position);
        });

        // player joined
    });
    // player connected
});


// setInterval(() => {
//     Object.keys(players).forEach(key => {
//         const player = players[key];
//         if (!player) return;

//         if (Date.now() - player.lastPing > 15000) {
//             console.log(`Disconnecting inactive player: ${key}`);
//             player.socket.disconnect(true);
//         }
//     });
// }, 5000);

server.listen(PORT);
console.log(`Server is running on port ${PORT}`);