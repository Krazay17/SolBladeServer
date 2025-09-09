class EventEmitter {
    constructor() {
        this.events = new Map();
        this.onceWrappers = new WeakMap(); // Track once wrappers
    }

    on(event, listener) {
        if (!this.events.has(event)) this.events.set(event, []);
        this.events.get(event).push(listener);
    }

    once(event, listener) {
        const wrapper = (data) => {
            listener(data);
            this.off(event, listener); // remove original listener
        };
        this.onceWrappers.set(listener, wrapper);
        this.on(event, wrapper);
    }

    off(event, listener) {
        if (!this.events.has(event)) return;
        const wrappers = this.events.get(event);

        // Check if listener was wrapped by `once`
        const wrapper = this.onceWrappers.get(listener) || listener;

        this.events.set(
            event,
            wrappers.filter(l => l !== wrapper)
        );

        // Clean up WeakMap if it was a once wrapper
        if (this.onceWrappers.has(listener)) {
            this.onceWrappers.delete(listener);
        }
    }

    emit(event, data) {
        if (!this.events.has(event)) return;
        this.events.get(event).slice().forEach(listener => listener(data));
        // slice() ensures safe iteration in case listeners remove themselves
    }
}

// Export a singleton instance if you want a global emitter
export const MyEventEmitter = new EventEmitter();
export default MyEventEmitter;
