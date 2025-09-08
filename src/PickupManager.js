export default class PickupManager {
    constructor(io) {
        this.io = io;
        this.pickups = {};
    }

    spawnPickup(type, position, doesRespawn = true, itemId) {
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

    removePickup(id) {
        this.pickups[id].active = false;
        if (!this.pickups[id].doesRespawn) return;
        const timeout = 15000;
        setTimeout(() => {
            this.spawnPickup(
                this.pickups[id].type,
                this.pickups[id].position,
                true,
                id
            )
        }, timeout);
    }

    getPickup(id) {
        return this.pickups[id];
    }

    getAllPickups() {
        return Object.keys(this.pickups).map(id => this.pickups[id]);
    }
}