export default class PickupManager {
    constructor(io) {
        this.io = io;
        this.pickups = {};
        this.itemLocations = [];
        this.healthLocations = [];
        this.energyLocations = [];
        this.locationSpawns = false;
        this.pickupId = 9999;
        this.initPickups();
    }
    generateId() {
        return (this.pickupId++).toString();
    }
    spawnPickup(type, position, doesRespawn = false, netId = null, item = null) {
        netId = netId || this.generateId();
        const pickup = { type, position, netId, active: true, doesRespawn, item };
        this.pickups[netId] = pickup;
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
    initPickups() {
        this.spawnRandomEnergy();
        this.spawnRandomHealth();
        this.spawnRandomItems();
    }
    randomLocation() {
        const x = (Math.random() * 2 - 1) * 30;
        const y = Math.random() * 10 + 1;
        const z = (Math.random() * 2 - 1) * 30;
        return { x, y, z };
    }
    spawnRandomItems() {
        const amount = 5;
        for (let i = 0; i < amount; i++) {
            this.spawnPickup('item', this.randomLocation(), true);
        }
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
    updateSpawnLocations(data) {
        if (this.locationSpawns) return;
        this.locationSpawns = true;

        const { itemLocations, healthLocations, energyLocations } = data;
        this.itemLocations = itemLocations;
        this.healthLocations = healthLocations;
        this.energyLocations = energyLocations;

        for (const loc of this.itemLocations) {
            this.spawnPickup('item', loc, true);
        }
        for (const loc of this.healthLocations) {
            this.spawnPickup('health', loc, true);
        }
        for (const loc of this.energyLocations) {
            this.spawnPickup('energy', loc, true);
        }
    }
}