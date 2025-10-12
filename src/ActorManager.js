import { randomUUID } from "crypto";
import actorDefaults from "./ActorDefaults.js";

export default class ActorManager {
    static instance = null;
    constructor(io) {
        if (ActorManager.instance) return ActorManager.instance;
        this._actors = [];
        this.io = io;

        this.hasSpawnedDefaults = false;
        this.spawnDefaultActors();
        
        ActorManager.instance = this;
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
    createActor(type, pos = { x: 0, y: 0, z: 0 }, data, rot = { x: 0, y: 0, z: 0, w: 1 }) {
        const defaults = actorDefaults[type];
        if (defaults) data = { ...defaults };
        const id = randomUUID();
        const actor = {
            maxHealth: 1,
            health: 1,
            ...data,
            netId: id,
            active: true,
            type,
            pos,
            rot,
        }
        this._actors.push(actor);
        this.io.emit('newActor', actor);
        return actor;
    }
    destroyActor(id) {
        const actor = this.getActorById(id);
        if (!actor) return;
        const { type, pos, respawn, respawning, maxHealth } = actor;
        if (respawn && !respawning) {
            actor.respawning = true;
            actor.health = maxHealth;
            setTimeout(() => {
                this.createActor(type, pos, { ...actor, respawning: false });
            }, respawn);
        }
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
    spawnDefaultActors() {
        if (this.hasSpawnedDefaults) return;
        this.hasSpawnedDefaults = true;
        this.createActor('item', { x: 0, y: 20, z: 8 }, { respawn: 15000 });
        this.createActor('item', { x: 8, y: 13, z: 8 }, { respawn: 15000 });
        this.createActor('item', { x: 0, y: 13, z: 2 }, { respawn: 15000 });
        this.createActor('item', { x: 2, y: 13, z: 0 }, { respawn: 15000 });
        this.createActor('item', { x: 8, y: 13, z: 2 }, { respawn: 15000 });
        this.createActor('item', { x: 4, y: 13, z: 0 }, { respawn: 15000 });
        this.createActor('power', { x: 0, y: 2, z: 4 }, { power: 'health', respawn: 10000 });
        this.createActor('power', { x: 4, y: 2, z: 4 }, { power: 'health', respawn: 10000 });
        this.createActor('power', { x: 4, y: 2, z: 0 }, { power: 'energy', respawn: 10000 });
        this.createActor('power', { x: 6, y: 3, z: 6 }, { power: 'health', respawn: 10000 });
        this.createActor('power', { x: 4, y: 3, z: 8 }, { power: 'energy', respawn: 10000 });
        this.createActor('power', { x: 8, y: 4, z: 4 }, { power: 'health', respawn: 10000 });
        this.createActor('power', { x: 4, y: 4, z: 6 }, { power: 'energy', respawn: 10000 });
        this.createActor('power', { x: 4, y: 5, z: 8 }, { power: 'health', respawn: 10000 });
        this.createActor('power', { x: 4, y: 5, z: 6 }, { power: 'energy', respawn: 10000 });
        this.createActor('power', { x: 8, y: 6, z: 6 }, { power: 'health', respawn: 10000 });
        this.createActor('power', { x: 6, y: 6, z: 0 }, { power: 'energy', respawn: 10000 });
    }
}