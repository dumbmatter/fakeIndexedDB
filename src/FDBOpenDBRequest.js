const FDBRequest = require('./FDBRequest');

class FDBOpenDBRequest extends FDBRequest {
    constructor() {
        super();

        this.onupgradeneeded = null;
        this.onblocked = null;
    }

    toString() {
        return '[object IDBOpenDBRequest]';
    }
}

module.exports = FDBOpenDBRequest;
