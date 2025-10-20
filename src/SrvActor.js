export default class SrvActor {
    constructor(io, data = {
        netId: '',
        name: 'none',
        solWorld: 'world1',
        health: 100,
    }) {
        this.io = io;
        this.netId = data.netId;
        this.name = data.name;
        this.solWorld = data.solWorld;
        this._health = data.health;
    }
    serialize() {
        const data = {};
        for (const [key, value] of Object.entries(this)) {
            if (value === null || value === undefined) continue;
            if (typeof value === "boolean" && value === false) continue;
            if (typeof value === "number" && value === 0 && key !== "amount") continue;

            if (value instanceof Actor) data[key] = value.netId;
            else if (value instanceof Vector3) data[key] = [value.x, value.y, value.z];
            else data[key] = value;
        }
        return data;
    }
    get health() { return this._health; }
    set health(v) {
        this._health = v;
        this.io.emit('actorHealthChange', { id: this.netId, health: this.health });
    }
}