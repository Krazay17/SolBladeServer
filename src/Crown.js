export default class ItemManager {
    constructor(io) {
        this.io = io;
        this.timer = null;
        this.items = {};
    }

    startTimer() {
        this.timer = setInterval(() => {
        }, 5000);
    }

    spawnItem(type, position, id) {
        this.io.emit('spawnItem', { type, position, id });
    }

    addItem(item) {
        this.items[item.id] = item;
    }

    removeItem(item) {
        delete this.items[item.id];
    }

    getItems() {
        return Object.values(this.items);
    }
}