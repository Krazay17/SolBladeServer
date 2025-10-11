import { Server } from "socket.io";
import { sendDiscordMessage } from "./DiscordStuff.js";
import http from "http";
import GameMode from "./src/GameMode.js";
import PickupManager from "./src/PickupManager.js";
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
const pickups = new PickupManager(io);
const gameMode = new GameMode("crown", io, pickups);
let players = {};

let testFireballTimer = null;

io.on('connection', (socket) => {
    if (socket.bound) return;
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
        socket.broadcast.emit("peer-disconnect", socket.id);
        io.emit('serverMessage', { player: 'Server', message: `Player Disconnected: ${players[socket.id]?.name || 'null'}!`, color: 'red' });
        if (!isLocal) sendDiscordMessage(`Player Disconnected: ${players[socket.id].name}!`);
        console.log('user disconnected: ' + socket.id);
        //gameMode.removePlayer(players[socket.id]);
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

        // Test create actor
        // if (!testFireballTimer) {
        //     testFireballTimer = setInterval(() => {
        //         actorManager.createActor('fireball', { x: 0, y: 80, z: 0 });
        //     }, 1000);
        // }
        // Test create item
        actorManager.createActor('item', { x: 0, y: 20, z: 0 });
        actorManager.createActor('item', { x: 0, y: 13, z: 0 });
        actorManager.createActor('item', { x: 0, y: 13, z: 2 });
        actorManager.createActor('item', { x: 2, y: 13, z: 0 });
        actorManager.createActor('item', { x: 0, y: 13, z: 4 });
        actorManager.createActor('item', { x: 4, y: 13, z: 0 });

        //Tell players we joined
        socket.broadcast.emit('newPlayer', player);

        socket.emit('currentPlayers', players);
        socket.emit('currentActors', actorManager.actors);

        io.emit('serverMessage', { player: 'Server', message: `Player Connected: ${data.name}!`, color: 'yellow' });
        if (!isLocal) sendDiscordMessage(`Player Connected: ${data.name}!`);


        socket.on('playerDied', ({ id, source }) => {
            const player = players[id];
            const sourceName = actorManager.getActorById(source)?.name || source;
            if (player) {
                io.emit('serverMessage', { player: 'Server', message: `${player.name} slain by: ${sourceName}`, color: 'orange' });
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
        socket.on('chatMessageSend', ({ player, message, color }) => {
            socket.broadcast.emit('chatMessageUpdate', { id: socket.id, data: { player, message, color } });
        });
        socket.on('playerDamageSend', ({ attacker, targetId, dmg, cc }) => {
            const player = players[targetId];
            if (!player) return;
            if (player.blocking) {
                socket.broadcast.emit('playerBlockedUpdate', targetId);
                return;
            }
            if (player.parry) {
                io.emit('playerParried', { id: targetId, attacker, health: player.health, dmgType: dmg.type });
                return;
            }
            player.health = Math.max(player.health - dmg.amount, 0);
            io.emit('playerDamageUpdate', {
                targetId,
                data: {
                    attacker,
                    health: player.health,
                    dmg,
                    cc,
                }
            });
        });
        socket.on('playerParryUpdate', (doesParry) => {
            if (players[socket.id]) {
                players[socket.id].parry = doesParry;
                socket.broadcast.emit('playerParryUpdate', { id: socket.id, parry: doesParry });
            }
        });
        socket.on('playerRespawn', () => {
            const player = players[socket.id];
            if (player) {
                player.health = player.maxHealth || 100;
                player.blocking = false;
            }
            socket.broadcast.emit('playerRespawn', { id: socket.id, health: player.health });
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
        socket.on('pickupCollected', ({ netId }) => {
            const pickup = pickups.getPickup(netId)
            if (pickup && pickup.active) {
                io.emit('pickupCollected', { playerId: socket.id, netId });
                pickups.removePickup(netId);
            }
        });
        socket.on('pickupCrown', () => {
            players[socket.id].hasCrown = true;
            socket.broadcast.emit('pickupCrown', { playerId: socket.id });
            io.emit('pickupCollected', { playerId: socket.id, netId: '9999991' });
            gameMode.pickupCrown(players[socket.id]);
        });
        socket.on('dropCrown', (position) => {
            players[socket.id].hasCrown = false;
            socket.broadcast.emit('dropCrown', { playerId: socket.id });
            gameMode.dropCrown(position);
        });
        socket.on('bootPlayer', (targetId) => {
            if (!players[targetId]) return;
            players[targetId].socket.disconnect(true);
        });
        socket.on('projectileMoved', (data) => {
            const player = players[socket.id];
            if (!player) return;
            socket.broadcast.emit('projectileMoved', { id: socket.id, data })
        });
        socket.on('projectileDestroyed', data => {
            socket.broadcast.emit('projectileDestroyed', data);
        });
        socket.on('playerDropItem', (data) => {
            pickups.spawnPickup('item', data.pos, null, data.item)
        });
        socket.on('spawnLocations', (data) => {
            pickups.updateSpawnLocations(data);
        });
        socket.on('actorHit', (data) => {
            const actor = actorManager.getActorById(data.target);
            if (actor) {
                actor.health = Math.max(0, Math.min(actor.maxHealth, actor.health + data.amount));
                io.emit('actorHit', { data, health: actor.health });
            }
        });
        socket.on('newActor', (data) => {
            const actor = actorManager.addActor(data);
            io.emit('newActor', actor);
        });
        socket.on('destroyActor', (id) => {
            socket.broadcast.emit('destroyActor', id);
        });
        socket.on('actorTouch', (data) => {
            const { dealer, target, active } = data;
            const actor = actorManager.getActorById(target);
            if (actor && actor.active) {
                actor.active = active;
                io.emit('actorTouch', data);
            }
        })

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