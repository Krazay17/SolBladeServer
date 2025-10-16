const actorDefaults = {
    julian: {
        maxHealth: 100,
        health: 100,
    },
    lavaGolem: {
        maxHealth: 1000,
        health: 1000,
    },
    item: {
        respawn: 15000,
        rndPos: true,
        rndXZ: 20,
        rndY: 15,
        solWorld: 'world2'
    },
    power: {
        respawn: 15000,
        rndPos: true,
        rndXZ: 20,
        rndY: 15,
        solWorld: 'world2',
    },
    crown: {
        solWorld: 'world2',
    }
}

export default actorDefaults;

export function randomPos(maxHoriz, maxHeight) {
    const x = (Math.random() * 2 - 1) * maxHoriz;
    const z = (Math.random() * 2 - 1) * maxHoriz;
    const y = Math.random() * maxHeight;

    return { x, y, z };
}