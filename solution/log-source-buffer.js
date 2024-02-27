"use strict";

class LogSourceBuffer {
    constructor() {
        this.entries = [];
        this.drained = false;
    }
    size() {
        return this.entries.length;
    }

    isEmpty() {
        return this.entries.length === 0;
    }    

    push(entry) {
        this.entries.push(entry)
    }

    pop() {
        return this.entries.shift();
    }

    setDrained() {
        this.drained = true;
    }
}

module.exports = LogSourceBuffer;