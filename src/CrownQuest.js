import ActorManager from "./ActorManager.js";

export default class CrownQuest {
    constructor(io, actorManager) {
        this.io = io;
        /**@type {ActorManager} */
        this.actorManager = actorManager;

        this.players = {}
        this.started = false;
        this.winningScore = 100;
        this.defaultPos = { x: 0, y: 1, z: 0 };

        this.init();
    }
    join(id) {
        this.players[id] = { score: 0, hasCrown: false };
        this.io.emit('crownGamePlayers', this.players);
    }
    leave(id) {
        this.dropCrown(id, this.defaultPos)
        delete this.players[id];
    }
    init() {
        this.actorManager.createActor('crown', { pos: this.defaultPos });
    }
    start() {
        if (this.started) return;
        this.started = true;
        for (const [id, p] of Object.entries(this.players)) {
            p.score = 0;
        }
        this.io.emit('crownGamePlayers', this.players);
    }
    endGame(id) {
        this.started = false;
        this.io.emit('crownGameEnd', id);
        this.dropCrown(id);
    }
    pickupCrown(id) {
        const player = this.players[id];
        if (!player) return;
        this.start();
        player.hasCrown = true;
        this.io.emit('crownPickup', id);
        clearInterval(this.crownPointsInterval);
        this.crownPointsInterval = setInterval(() => {
            player.score += 1;
            this.io.emit('crownScoreIncrease', { id, score: player.score });
            if (player.score >= this.winningScore) {
                clearInterval(this.crownPointsInterval);
                this.endGame(id);
            }
        }, 1000);
    }
    dropCrown(id, pos) {
        const player = this.players[id];
        if (player && player.hasCrown) {
            player.hasCrown = false;
            clearInterval(this.crownPointsInterval);
            pos = pos || this.defaultPos;
            this.actorManager.createActor('crown', { pos });
            this.io.emit('dropCrown', id);
        }
    }
}