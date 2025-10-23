import { Server } from "socket.io";
import { sendDiscordMessage } from "./DiscordStuff.js";
import http from "http";
import ActorManager from "./src/ActorManager.js";
import CrownQuest from "./src/CrownQuest.js";

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
const crownQuest = new CrownQuest(io, actorManager);
const quests = [crownQuest];
let players = {};
let playerSockets = {};

io.on('connection', (socket) => {
    if (socket.bound) return;
    playerSockets[socket.id] = socket;
    socket.bound = true;
    const ip = socket.handshake.address;
    console.log(`New connection from ${ip} with id: ${socket.id}`);

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

    socket.on('disconnect', () => {
        socket.broadcast.emit('playerDisconnected', socket.id);
        quests.forEach(q => q.leave(socket.id));
        io.emit('serverMessage', { player: 'Server', message: `Player Disconnected: ${players[socket.id]?.name || 'null'}!`, color: 'red' });
        if (!isLocal && players[socket.id]) sendDiscordMessage(`Player Disconnected: ${players[socket.id].name}!`);
        console.log('user disconnected: ' + socket.id);

        actorManager.removeActor(socket.id);
        delete players[socket.id];
    });

    socket.on('joinGame', (data) => {
        if (players[socket.id]) return;
        const player = actorManager.addActor({ ...data, netId: socket.id });
        players[socket.id] = player;
        socket.emit('playersConnected', players);
        socket.broadcast.emit('playerConnected', player)

        const bindGameplay = () => {
            socket.on('newWorld', (solWorld) => {
                player.solWorld = solWorld;
                socket.broadcast.emit('newWorld', player);
                socket.emit('currentActors', actorManager.getActorsOfWorld(solWorld));
            })

            io.emit('serverMessage', { player: 'Server', message: `Player Connected: ${data.name}!`, color: 'yellow' });
            if (!isLocal) sendDiscordMessage(`Player Connected: ${data.name}!`);

            socket.on('iDied', (data) => {
                const { dealer, target } = data;
                const targetName = actorManager.getActorById(target)?.name || 'The Void';
                const dealerName = actorManager.getActorById(dealer)?.name || 'The Void';
                if (player) {
                    io.emit('serverMessage', { player: 'Server', message: `${targetName} slain by: ${dealerName}`, color: 'orange' });
                    io.emit('playerDied', data);
                }
            });
            socket.on('playerNameChange', name => {
                players[socket.id].name = name;
                io.emit('playerNameChange', { id: socket.id, name });
            });
            socket.on('playerStateUpdate', data => {
                const { solWorld, skin } = data;
                const actor = actorManager.getActorById(socket.id);
                if (solWorld) {
                    actor.solWorld = solWorld;
                }
                if (skin) {
                    actor.skin = skin
                }

                socket.broadcast.emit('playerStateUpdate', data);
            })
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
                    socket.broadcast.emit('parryUpdate', doesParry);
                }
            });
            socket.on('playerHealthChangeLocal', ({ id, health }) => {
                players[id].health = health;
                socket.broadcast.emit('playerHealthChange', { id, health });
            });
            socket.on('playerRespawn', () => {
                const player = players[socket.id];
                if (player) {
                    player.health = player.maxHealth || 100;
                    player.parry = false;
                    player.lastHit = null;
                }
                socket.broadcast.emit('playerRespawn', { id: socket.id, health: player.health });
                socket.broadcast.emit('playerHealthChange', { id: socket.id, health: player.health });
            });
            socket.on('fx', (data) => {
                socket.broadcast.emit('fx', data);
            });
            socket.on('actorHit', (data) => {
                const actor = actorManager.getActorById(data.target);
                if (actor) {
                    if (actor.type === 'player' && !playerHit(actor, data)) return;
                    actor.health = Math.max(0, Math.min(actor.maxHealth, actor.health + data.amount));
                    actor.lastHit = data;
                    io.emit('actorHit', { data, health: actor.health });
                    if (actor.health <= 0) {
                        actorManager.actorDie(actor.lastHit);
                    }
                }
            });
            socket.on('actorTouch', (data) => {
                const actor = actorManager.getActorById(data.target);
                if (actor && actor.active) {
                    io.emit('actorTouch', data);
                    if (data.die) actorManager.actorDie(data);
                }
            });
            socket.on('actorDie', (data) => {
                actorManager.actorDie(data);
            });
            socket.on('newActor', (data) => {
                const actor = actorManager.addActor(data);
                io.emit('newActor', actor);
            });
            socket.on('actorStateUpdate', data => {
                const actor = actorManager.getActorById(data.netId);
                if (actor) {
                    Object.assign(actor, data);
                }
            });
            socket.on('playerAudio', data => {
                socket.broadcast.emit('playerAudio', { id: socket.id, data });
            });
            socket.on('playPosSound', data => {
                socket.broadcast.emit('playPosSound', { map: player.solWorld, data });
            })
            socket.on('crownGameEnter', () => {
                crownQuest.join(socket.id);
            });
            socket.on('crownGameLeave', () => {
                crownQuest.leave(socket.id);
            });
            socket.on('crownPickup', () => {
                crownQuest.pickupCrown(socket.id);
            })
            socket.on('dropCrown', pos => {
                crownQuest.dropCrown(socket.id, pos);
            })
            socket.on('leaveWorld', (world) => {
                socket.broadcast.emit('leaveWorld', { id: socket.id, world });
            });
            socket.on('bootPlayer', id => {
                playerSockets[id].disconnect();
            })
        }
        bindGameplay()

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

server.listen(PORT);
console.log(`Server is running on port ${PORT}`);