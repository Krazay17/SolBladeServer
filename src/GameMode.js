import ActorManager from "./ActorManager.js";

export default class GameMode {
    constructor(name, io) {
        this.name = name;
        this.io = io;
        this.actorManager = new ActorManager(io);
        this.players = [];
        this.winningScore = 100; // Example winning score
        this.gameInit = false;
        this.gameActive = false;
        this.crownPointsInterval = null;

        this.crownId = '9999991'

        //this.initGame();
    }

    startGame() {
        this.gameActive = true;
        this.io.emit('crownGameStarted');
        this.players.forEach(player => {
            player.score = 0; // Reset player score
        });
    }

    pickupCrown(player) {
        if (player) {
            if (!this.gameActive) this.startGame();
            clearInterval(this.crownPointsInterval);
            this.crownPointsInterval = setInterval(() => {
                player.score += 1;
                this.io.emit('crownScoreIncrease', { playerId: player.netId, score: player.score });
                if (player.score >= this.winningScore) {
                    clearInterval(this.crownPointsInterval);
                    this.endGame(player.socket.id);
                }
            }, 1000);
        }
    }

    getScores() {
        return this.players.map(player => ({
            id: player.netId,
            score: player.score
        }));
    }

    dropCrown(pos = { x: 0, y: 1, z: 0 }) {
        clearInterval(this.crownPointsInterval);
        this.crown = this.actorManager.createActor('crown', pos);
        this.crown.active = true;
    }

    initGame() {
        if (!this.gameInit) {
            this.gameInit = true;
            this.dropCrown();
        }
    }

    endGame(winnerId) {
        this.gameActive = false;

        this.dropCrown();
        this.io.emit('dropCrown', { playerId: winnerId });
        this.io.emit('crownGameEnded', winnerId);
        this.players.forEach(player => {
            player.hasCrown = false;
        });
    }

    addPlayer(player) {
        player.score = 0;
        this.players.push(player);
        if (this.players.length > 0 && !this.gameInit) {
            this.initGame();
        }
        if (this.gameActive) {
            player.socket.emit('crownGameStarted', this.getScores());
        }
    }

    removePlayer(player) {
        this.players = this.players.filter(p => p !== player);
        if (this.players.length < 2 && this.gameActive) {
            this.endGame(null);
        } else if (player.hasCrown) {
            this.dropCrown();
        }
    }

    getPlayerList() {
        return this.players;
    }
}
