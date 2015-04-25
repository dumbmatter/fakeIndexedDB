var Event = require('./Event');
var EventTarget = require('./EventTarget');

module.exports = function (storeNames, mode) {
    this.scope = storeNames;
    this.active = true;
    this.requests = [];

    this.mode = mode;
    this.db = null;
    this.error = null;
    this.onabort = null;
    this.oncomplete = null;
    this.onerror = null;

    this.abort = function () {
        throw new Error('Not implemented');
    };

    this.objectStore = function (name) {
        if (this.scope.indexOf(name) < 0) {
            throw new Error('NotFoundError');
        }

        if (!this.active) {
            throw new Error('InvalidStateError');
        }

        this.db.objectStores[name].transaction = this;

        return this.db.objectStores[name];
    };

    setImmediate(function () {
        this.active = false;

        var event = new Event();
        event.target = this;
        event.type = 'complete';

        this.dispatchEvent(event);
    }.bind(this));

    EventTarget.call(this);

    return this;
};