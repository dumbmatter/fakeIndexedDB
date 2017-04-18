const EventTarget = require('./lib/EventTarget');

class FDBRequest extends EventTarget {
    constructor() {
        super();

        this.result = null;
        this.error = null;
        this.source = null;
        this.transaction = null;
        this.readyState = 'pending';
        this.onsuccess = null;
        this.onerror = null;
    }

    toString() {
        return '[object IDBRequest]';
    }
}

module.exports = FDBRequest;
