export default class GameMode {
    constructor(name, io, pickupManager) {
        this.name = name;
        this.io = io;
        this.players = [];
        this.winningScore = 100; // Example winning score
        this.pickupManager = pickupManager;
        this.gameInit = false;
        this.gameActive = false;
    }

    startGame() {
        this.gameActive = true;
        this.players.forEach(player => {
            player.score = 0; // Reset player score
        });
        const crownId = this.crown ? this.crown.itemId : null;
        this.crown = this.pickupManager.spawnPickup('crown', { x: 0, y: 2, z: 0 }, false, crownId);
    }

    spawnRandomEnergy() {
        const amount = 10;
        for (let i = 0; i < amount; i++) {
            const x = (Math.random() * 2 - 1) * 50;
            const y = Math.random() * 5;
            const z = (Math.random() * 2 - 1) * 50;
            this.pickupManager.spawnPickup('energy', { x, y, z }, true);
        }
    }
    initGame() {
        this.gameInit = true;
        this.spawnRandomEnergy();
    }

    endGame(winnerId) {
        this.gameActive = false;
        console.log(`Game Over! Winner is Player ID: ${winnerId}`);
        this.io.emit('gameOver', { winnerId });
        this.pickupManager.removePickup(null, this.crown);
    }

    addPlayer(player) {
        this.players.push(player);
        if (this.players.length > 0 && !this.gameInit) {
            this.initGame();
        }
        if (this.players.length > 1 && !this.gameActive) {
            this.startGame();
        }
    }

    removePlayer(player) {
        this.players = this.players.filter(p => p !== player);
        if (this.players.length < 2 && this.gameActive) {
            this.endGame(null);
        }
        if (this.players.length === 0) {
            this.gameInit = false;
            this.gameActive = false;
        }
    }

    getPlayerList() {
        return this.players;
    }
}
