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
            }
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
            type,
            maxHealth: 1,
            health: 1,
            pos: { x: 0, y: 0, z: 0 },
            rot: { x: 0, y: 0, z: 0, w: 1 },
            ...data,
            netId: id,
            active: true,
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
    getPlayerActorsOfWorld(world) {
        return this.playerActors.filter(a => a.solWorld === world)
    }
    getNonPlayerActorsOfWorld(world) {
        return this.nonPlayerActors.filter(a => a.solWorld === world)
    }
    getActorsOfWorld(world) {
        return this._actors.filter(a => (a.solWorld === world) && a.active);
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