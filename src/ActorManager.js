import { randomUUID } from "crypto";

export default class ActorManager {
    constructor(io) {
        this._actors = [];
        this.io = io;
    }
    addActor(data) {
        const id = data.netId ? data.netId : randomUUID();
        const actor = {
            ...data,
            netId: id,
        }
        this._actors.push(actor);
        return actor;
    }
    createActor(type, pos = { x: 0, y: 0, z: 0 }, rot = { x: 0, y: 0, z: 0, w: 1 }, data) {
        const id = randomUUID();
        const actor = {
            ...data,
            type,
            netId: id,
            active: true,
            pos,
            rot,
        }
        this._actors.push(actor);
        this.io.emit('newActor', actor);
        return actor;
    }
    getActorById(id) {
        return this._actors.find(a => a.netId === id);
    }
    get actors() {
        return this._actors;
    }
    get nonPlayerActors() {
        return this._actors.filter(a => a.type !== 'player');
    }
    get playerActors() {
        return this._actors.filter(a => a.type === 'player');
    }
}