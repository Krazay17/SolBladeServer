export default class PickupManager {
    constructor(io) {
        this.io = io;
        this.pickups = {};
        this.initPickups();
    }

    spawnPickup(type, position, doesRespawn = false, itemId) {
        const rnd = Math.floor(Math.random() * 1000000).toString();
        const id = itemId || rnd;
        const pickup = { type, position, itemId: id, active: true, doesRespawn };
        this.pickups[id] = pickup;
        this.io.emit('spawnPickup', pickup);
        return pickup;
    }

    addPickup(id, pickup) {
        this.pickups[id] = pickup;
    }

    removePickup(id, item) {
        const pickup = id ? this.pickups[id] : item;
        pickup.active = false;
        if (!pickup.doesRespawn) return;
        const timeout = 15000;
        setTimeout(() => {
            this.spawnPickup(
                pickup.type,
                this.randomLocation(),
                true,
            )
        }, timeout);
    }

    getPickup(id) {
        return this.pickups[id];
    }

    getAllPickups() {
        return Object.keys(this.pickups).map(id => this.pickups[id]);
    }

    initPickups() {
        this.spawnRandomEnergy();
        this.spawnRandomHealth();
    }

    randomLocation() {
        const x = (Math.random() * 2 - 1) * 30;
        const y = Math.random() * 14 + 1;
        const z = (Math.random() * 2 - 1) * 30;
        return { x, y, z };
    }

    spawnRandomHealth() {
        const amount = 10;
        for (let i = 0; i < amount; i++) {
            this.spawnPickup('health', this.randomLocation(), true);
        }
    }

    spawnRandomEnergy() {
        const amount = 10;
        for (let i = 0; i < amount; i++) {
            this.spawnPickup('energy', this.randomLocation(), true);
        }
    }
}