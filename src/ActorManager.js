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
        if (!data) return;
        const { dealer, target } = data;
        //const dealerActor = this.getActorById(dealer);
        const targetActor = this.getActorById(target);
        if (targetActor) {
            const { type, name, pos, respawn, respawning, maxHealth, active, rndPos } = targetActor;
            if (!active) return;
            if (type !== 'player') {
                targetActor.active = false;
                if (respawn) {
                    if (!respawning) {
                        targetActor.respawning = true;
                        targetActor.health = maxHealth;
                        setTimeout(() => {
                            this.createActor(type, {
                                ...targetActor,
                                respawning: false,
                            });
                        }, respawn);
                    }
                } else {
                    this.removeActor(targetActor);
                }
            }
            this.io.emit('actorDie', data);
        }
    }
    respawn(targetActor) {
        if (targetActor) {
            const { type, respawn, respawning, maxHealth, active, rndPos } = targetActor;
            if (respawn && !respawning) {
                targetActor.respawning = true;
                targetActor.health = maxHealth;
                setTimeout(() => {
                    this.createActor(type, {
                        ...targetActor,
                        respawning: false,
                    });
                }, respawn);
            }
        }

    }
    addActor(data) {
        const id = data.netId ? data.netId : randomUUID();
        const actor = {
            ...data,
            netId: id,
            time: performance.now(),
        }
        this._actors.push(actor);
        return actor;
    }
    removeActor(actor) {
        actor = typeof actor === 'string' ? this.getActorById(actor) : actor;
        if (!actor) return;
        const index = this._actors.indexOf(actor)
        this._actors.splice(index, 1);
    }
    createActor(type, data) {
        //const existingActor = this._actors.find(a => a.type === type && !a.active);
        const defaults = actorDefaults[type];
        if (defaults) data = { ...defaults, ...data };
        if (data?.rndPos) data.pos = randomPos(data.rndXZ || 5, data.rndY || 5);
        const id = randomUUID();
        const actor = {
            type,
            maxHealth: 1,
            health: 1,
            pos: { x: 0, y: 0, z: 0 },
            rot: { x: 0, y: 0, z: 0, w: 1 },
            ...data,
            time: performance.now(),
            netId: id,
            active: true,
        }
        this._actors.push(actor);
        this.io.emit('newActor', actor);
        return actor;
    }
    getActorById(id) {
        return this._actors.find(a => a.netId === id);
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
    remainingDuration(actor) {
        const time = actor.time;
        const dur = actor.dur;
        if (!dur) return true;
        const active = performance.now() - time < dur;
        if (active) {
            return true;
        } else {
            this.removeActor(actor);
        }
        return active;
    }
    getActorsOfWorld(world) {
        return this._actors.filter(a => a.active && (a.solWorld === world) && this.remainingDuration(a));
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
}