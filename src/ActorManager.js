import { randomUUID } from "crypto";
import actorDefaults, { randomPos } from "./ActorDefaults.js";

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
    actorDie(data) {
        const { dealer, target } = data;
        const actor = this.getActorById(target);
        if (actor) {
            const { type, pos, respawn, respawning, maxHealth, active, rndPos } = actor;
            if (!active) return;
            actor.active = false;
            if (respawn && !respawning) {
                actor.respawning = true;
                actor.health = maxHealth;
                setTimeout(() => {
                    this.createActor(type, {
                        ...actor,
                        respawning: false,
                    });
                }, respawn);
            }
            this.io.emit('actorDie', data);
        }
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
    createActor(type, data) {
        const existingActor = this._actors.find(a => a.type === type && !a.active);
        const defaults = actorDefaults[type];
        if (defaults) data = { ...defaults, ...data };
        if (data?.rndPos) data.pos = randomPos(data.rndXZ || 5, data.rndY || 5);
        const id = randomUUID();
        const actor = {
            maxHealth: 1,
            health: 1,
            pos: { x: 0, y: 0, z: 0 },
            rot: { x: 0, y: 0, z: 0, w: 1 },
            ...data,
            netId: id,
            active: true,
            type,
        }
        this._actors.push(actor);
        this.io.emit('newActor', actor);
        return actor;
    }
    destroyActor(id) {
        const actor = this.getActorById(id);
        if (!actor) return;
        actor.active = false;
        const index = this._actors.indexOf(actor)
        this._actors.splice(index, 1);
    }
    getActorById(id) {
        return this._actors.find(a => a.netId === id);
    }
    get actors() {
        return this._actors;
    }
    get nonPlayerActors() {
        return this._actors.filter(a => a.type !== 'player' && a.active);
    }
    get playerActors() {
        return this._actors.filter(a => a.type === 'player');
    }
    spawnDefaultActors() {
        if (this.hasSpawnedDefaults) return;
        this.hasSpawnedDefaults = true;
        const item = 6;
        const power = 12;
        for (let i = 0; i < item; i++) {
            this.createActor('item');
        }
        for (let i = 0; i < power; i++) {
            const type = i % 2 ? 'health' : 'energy';
            this.createActor('power', { power: type })
        }
    }
}