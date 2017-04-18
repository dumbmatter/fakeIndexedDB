const Event = require('./lib/Event');

class FDBVersionChangeEvent extends Event {
    constructor(type, parameters = {}) {
        super(type);

        this.oldVersion = parameters.oldVersion !== undefined ? parameters.oldVersion : 0;
        this.newVersion = parameters.newVersion !== undefined ? parameters.newVersion : null;
    }

    toString () {
        return '[object IDBVersionChangeEvent]';
    }
}

module.exports = FDBVersionChangeEvent;
