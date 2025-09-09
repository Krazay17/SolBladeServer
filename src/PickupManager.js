export default class PickupManager {
    constructor(io) {
        this.io = io;
        this.pickups = {};
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
                pickup.position,
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
}