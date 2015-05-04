'use strict';

var util = require('util');
var Event = require('./Event');
var EventTarget = require('./EventTarget');
var FDBObjectStore = require('./FDBObjectStore');
var FDBRequest = require('./FDBRequest');
var AbortError = require('./errors/AbortError');
var TransactionInactiveError = require('./errors/TransactionInactiveError');
var NotFoundError = require('./errors/NotFoundError');
var InvalidStateError = require('./errors/InvalidStateError');

// http://www.w3.org/TR/IndexedDB/#transaction
function FDBTransaction(storeNames, mode) {
    EventTarget.call(this);

    this._scope = storeNames;
    this._started = false;
    this._active = true;
    this._finished = false; // Set true after commit or abort
    this._requests = [];

    this.mode = mode;
    this.db = null;
    this.error = null;
    this.onabort = null;
    this.oncomplete = null;
    this.onerror = null;

    // http://www.w3.org/TR/IndexedDB/#dfn-steps-for-aborting-a-transaction
    this._abort = function (error) {
// Revert changes

        var e;
        if (error !== null) {
            e = new Error();
            e.name = error;
            this.error = e;
        }

// Should this directly remove from _requests?
        this._requests.forEach(function (r) {
            var request = r.request;
            if (request.readyState !== 'done') {
                request.readyState = 'done'; // This will cancel execution of this request's operation
                if (request.source) {
                    request.result = undefined;
                    request.error = new AbortError();

                    var event = new Event('error', {
                        bubbles: true,
                        cancelable: true
                    });
                    event._eventPath = [this.db, this];
                    request.dispatchEvent(event);
                }
            }
        }.bind(this));

        setImmediate(function () {
            var event = new Event('abort', {
                bubbles: true,
                cancelable: false
            });
            event._eventPath = [this.db];
            this.dispatchEvent(event);
        }.bind(this));

        this._finished = true;
    };

    this.abort = function () {
        if (this._finished) {
            throw new InvalidStateError();
        }
        this._active = false;

        this._abort(null);
    };

    this.objectStore = function (name) {
        if (this._scope.indexOf(name) < 0) {
            throw new NotFoundError();
        }

        if (!this._active) {
            throw new InvalidStateError();
        }

        return new FDBObjectStore(this, this.db._rawDatabase.rawObjectStores[name]);
    };

    // http://www.w3.org/TR/IndexedDB/#dfn-steps-for-asynchronously-executing-a-request
    this._execRequestAsync = function (source, operation, request) {
        if (!this._active) {
            throw new TransactionInactiveError();
        }

        // Request should only be passed for cursors
        if (!request) {
            if (!source) {
                // Special requests like indexes that just need to run some coe
                request = {
                    readyState: 'pending'
                };
            } else {
                request = new FDBRequest();
                request.source = source;
                request.transaction = source.transaction;
            }
        }

        this._requests.push({
            request: request,
            operation: operation
        });

        return request;
    };

    this._start = function () {
        var event;

        this._started = true;

        if (this._requests.length > 0) {
            // Remove from request queue - cursor ones will be added back if necessary by cursor.continue and such
            var r = this._requests.shift();

            var request = r.request;
            var operation = r.operation;

            if (request.readyState === 'done') {
                // Must have been aborted transaction, so stop this.
// Could probably look through and check these
                setImmediate(this._start.bind(this));
                return;
            }

            if (!request.source) {
                // Special requests like indexes that just need to run some coe
                operation();
            } else {
                var defaultAction;
                try {
                    var result = operation();
                    request.readyState = 'done';
                    request.result = result;
                    request.error = undefined;

                    // http://www.w3.org/TR/IndexedDB/#dfn-fire-a-success-event
                    this._active = true;
                    event = new Event('success', {
                        bubbles: false,
                        cancelable: false
                    });
                } catch (err) {
                    request.readyState = 'done';
                    request.result = undefined;
                    request.error = err;

                    // http://www.w3.org/TR/IndexedDB/#dfn-fire-an-error-event
                    this._active = true;
                    event = new Event('error', {
                        bubbles: true,
                        cancelable: true
                    });

                    defaultAction = this._abort.bind(this, err.name);
                }

                try {
                    event._eventPath = [this.db, this];
                    request.dispatchEvent(event);
                    this._active = false;
                } catch (err) {
//console.error(err);
                    this._abort('AbortError');
                    throw err;
                }

                // Default action of event
                if (!event._canceled) {
                    if (defaultAction) {
                        defaultAction();
                    }
                }
            }

            // On to the next one
            if (this._requests.length > 0) {
                this._start();
            } else {
                setImmediate(this._start.bind(this));
            }
            return;
        }

        // Check if transaction complete event needs to be fired
        if (!this._finished) { // Either aborted or committed already
            this._active = false;
            this._finished = true;

            if (!this.error) {
                event = new Event();
                event.type = 'complete';
                this.dispatchEvent(event);
            }
        }
    };

//    setImmediate(this._start.bind(this));

    this.toString = function () {
        return '[object IDBRequest]';
    };
}
util.inherits(FDBTransaction, EventTarget);

module.exports = FDBTransaction;