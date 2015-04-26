'use strict';

var Event = require('./Event');
var EventTarget = require('./EventTarget');
var FDBObjectStore = require('./FDBObjectStore');
var FDBRequest = require('./FDBRequest');
var TransactionInactiveError = require('./errors/TransactionInactiveError');
var NotFoundError = require('./errors/NotFoundError');
var InvalidStateError = require('./errors/InvalidStateError');

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
            throw new NotFoundError();
        }

        if (!this._active) {
            throw new InvalidStateError();
        }

        return new FDBObjectStore(this, this.db._database.objectStores[name]);
    };

    this._execRequestAsync = function (source, operation, request) {
        if (!this._active) {
            throw new TransactionInactiveError();
        }

        // Request should only be passed for cursors
        if (!request) {
            request = new FDBRequest();
            request.source = source;
            request.transaction = source.transaction;
            this._requests.push(request);
        }

        var cb = function () {
            for (var i = 0; i < this._requests.length; i++) {
                if (this._requests[i] === request) {
                    break;
                }

                if (this._requests[i].readyState === 'pending') {
                    return setTimeout(cb, 10);
                }
            }

            var event;
            try {
                var result = operation();
                request.readyState = 'done';
                request.result = result;
                request.error = undefined;

                // http://www.w3.org/TR/IndexedDB/#dfn-fire-a-success-event
                this._active = true;
                event = new Event();
                event.target = request;
                event.type = 'success';
                request.dispatchEvent(event);
                this._active = false;
            } catch (err) {
                request.readyState = 'done';
                request.result = undefined;
                request.error = err;

                // http://www.w3.org/TR/IndexedDB/#dfn-fire-an-error-event
                this._active = true;
                event = new Event();
                event.target = request;
                event.type = 'error';
                request.dispatchEvent(event);
                this._active = false;
            }
        }.bind(this);

        process.nextTick(cb);

        return request;
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