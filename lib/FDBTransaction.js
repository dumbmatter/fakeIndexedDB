var Event = require('./Event');
var EventTarget = require('./EventTarget');

// http://www.w3.org/TR/IndexedDB/#transaction
module.exports = function (storeNames, mode) {
    this._scope = storeNames;
    this._active = true;
    this._requests = [];

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
        if (this._scope.indexOf(name) < 0) {
            throw new Error('NotFoundError');
        }

        if (!this._active) {
            throw new Error('InvalidStateError');
        }

        this.db.objectStores[name].transaction = this;

        return this.db.objectStores[name];
    };

    setImmediate(function () {
        this._active = false;

        var event = new Event();
        event.target = this;
        event.type = 'complete';

        this.dispatchEvent(event);
    }.bind(this));

    EventTarget.call(this);

    return this;
};