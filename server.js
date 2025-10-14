import { Server } from "socket.io";
import { sendDiscordMessage } from "./DiscordStuff.js";
import http from "http";
import GameMode from "./src/GameMode.js";
import ActorManager from "./src/ActorManager.js";

const PORT = process.env.PORT || 3000;
const server = http.createServer();
const isLocal = process.env.PORT === '3000'
    || process.env.NODE_ENV === 'development'
    || !process.env.PORT;
const origin = isLocal ? 'http://localhost:5173' : "https://solblade.online";

const io = new Server(server, {
    cors: {
        origin: origin,
        methods: ["GET", "POST"]
    },
    connectTimeout: 5000,
    pingInterval: 10000,
    pingTimeout: 20000,
    cleanupEmptyChildNamespaces: true,
});

const actorManager = new ActorManager(io);
const gameMode = new GameMode("crown", io);
let players = {};

io.on('connection', (socket) => {
    if (socket.bound) return;
    socket.bound = true;
    const ip = socket.handshake.address;
    console.log(`New connection from ${ip} with id: ${socket.id}`);

    // socket.on("join-voice", () => {
    //     // tell everyone else to start connecting to this peer
    //     socket.broadcast.emit("new-peer", socket.id);
    // });

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

    socket.on('disconnect', () => {
        socket.broadcast.emit('playerDisconnected', socket.id);
        socket.broadcast.emit("peer-disconnect", socket.id);
        io.emit('serverMessage', { player: 'Server', message: `Player Disconnected: ${players[socket.id]?.name || 'null'}!`, color: 'red' });
        if (!isLocal && players[socket.id]) sendDiscordMessage(`Player Disconnected: ${players[socket.id].name}!`);
        console.log('user disconnected: ' + socket.id);

        actorManager.destroyActor(socket.id);
        delete players[socket.id];
    });
    // socket.on('heartbeat', () => {
    //     players[socket.id].lastPing = Date.now();
    //     socket.emit('heartbeatAck');
    // })

    socket.on('joinGame', (data) => {
        const player = actorManager.addActor({ ...data, netId: socket.id })
        players[socket.id] = player;
        socket.emit('joinAck', player);

        const bindGameplay = () => {
            //Tell players we joined
            socket.broadcast.emit('newPlayer', player);
            socket.emit('currentPlayers', actorManager.playerActors);

            socket.emit('currentActors', actorManager.nonPlayerActors);

            io.emit('serverMessage', { player: 'Server', message: `Player Connected: ${data.name}!`, color: 'yellow' });
            if (!isLocal) sendDiscordMessage(`Player Connected: ${data.name}!`);


            socket.on('playerDied', (data) => {
                const { dealer, target } = data;
                const targetName = actorManager.getActorById(target)?.name || 'The Void';
                const dealerName = actorManager.getActorById(dealer)?.name || 'The Void';
                if (player) {
                    io.emit('serverMessage', { player: 'Server', message: `${targetName} slain by: ${dealerName}`, color: 'orange' });
                }
            });
            socket.on('playerNameSend', (name) => {
                if (players[socket.id]) players[socket.id].name = name;
                socket.broadcast.emit('playerNameUpdate', { id: socket.id, name });
            });
            socket.on('playerPositionSend', (data) => {
                if (players[socket.id]) players[socket.id].pos = data.pos;
                socket.broadcast.emit('playerPositionUpdate', { id: socket.id, data });
            });
            socket.on('playAnimation', (data) => {
                if (players[socket.id]) players[socket.id].anim = data;
                socket.broadcast.emit('playAnimation', { id: socket.id, data })
            });
            socket.on('changeAnimation', (data) => {
                const player = players[socket.id];
                if (player) {
                    socket.broadcast.emit('changeAnimation', { id: socket.id, data });
                }
            })
            socket.on('chatMessageSend', ({ player, message, color }) => {
                socket.broadcast.emit('chatMessageUpdate', { id: socket.id, data: { player, message, color } });
            });
            socket.on('parryUpdate', (doesParry) => {
                if (players[socket.id]) {
                    players[socket.id].parry = doesParry;
                    socket.broadcast.emit('parryUpdate',);
                }
            });
            socket.on('playerRespawn', () => {
                const player = players[socket.id];
                if (player) {
                    player.health = player.maxHealth || 100;
                    player.parry = false;
                }
                socket.broadcast.emit('playerRespawn', { id: socket.id, health: player.health });
            });
            socket.on('fx', (data) => {
                socket.broadcast.emit('fx', data);
            });
            socket.on('pickupCrown', () => {
                players[socket.id].hasCrown = true;
                socket.broadcast.emit('pickupCrown', socket.id);
                gameMode.pickupCrown(players[socket.id]);
            });
            socket.on('dropCrown', (position) => {
                players[socket.id].hasCrown = false;
                socket.broadcast.emit('dropCrown', { playerId: socket.id });
                gameMode.dropCrown(position);
            });
            socket.on('bootPlayer', (targetId) => {
                // if (!players[targetId]) return;
                // players[targetId].socket.disconnect(true);
            });
            socket.on('actorHit', (data) => {
                const actor = actorManager.getActorById(data.target);
                if (actor) {
                    if (actor.type === 'player' && !playerHit(actor, data)) return;
                    actor.health = Math.max(0, Math.min(actor.maxHealth, actor.health + data.amount));
                    io.emit('actorHit', { data, health: actor.health });
                    if (actor.health <= 0) {
                        actorManager.actorDie(data);
                    }
                }
            });
            socket.on('actorTouch', (data) => {
                const actor = actorManager.getActorById(data.target);
                if (actor && actor.active) {
                    socket.emit('actorTouch', data);
                }
                actorManager.actorDie(data);
            });
            socket.on('actorDie', (data) => {
                actorManager.actorDie(data);
            });
            socket.on('newActor', (data) => {
                const actor = actorManager.addActor(data);
                io.emit('newActor', actor);
            });
            socket.on('destroyActor', (id) => {
                actorManager.destroyActor(id);
                socket.broadcast.emit('destroyActor', id);
            });
        }

        socket.on('bindGameplay', bindGameplay);
        // player joined
    });
    // player connected
});

function playerHit(targetActor, data) {
    const { amount, dealer, target } = data;
    const dealerActor = actorManager.getActorById(dealer);
    if (amount < 0 && targetActor.parry) {
        io.emit('playerParried', { target, dealer });
        if (dealerActor.parry) io.emit('playerParried', { target: dealer, dealer: target })
        return false;
    }
    return true;
}

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