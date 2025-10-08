export default class NPCManager {
    constructor(io) {
        this.io = io;
        this.enemies = [];
        this.enemyLocations = [];
    }
    updateEnemyLocations(data) {
        const { enemyLocations } = data;
        if (this.enemyLocations) return;
        this.enemyLocations = enemyLocations;

        for(const loc of this.enemyLocations) {
            this.spawnEnemy()
        }
    }
    spawnEnemy(type, pos) {
        
    }
}