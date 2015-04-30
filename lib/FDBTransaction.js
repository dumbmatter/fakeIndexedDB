'use strict';

var Event = require('./Event');
var EventTarget = require('./EventTarget');
var FDBObjectStore = require('./FDBObjectStore');
var FDBRequest = require('./FDBRequest');
var AbortError = require('./errors/AbortError');
var TransactionInactiveError = require('./errors/TransactionInactiveError');
var NotFoundError = require('./errors/NotFoundError');
var InvalidStateError = require('./errors/InvalidStateError');

// http://www.w3.org/TR/IndexedDB/#transaction
module.exports = function (storeNames, mode) {
    this._scope = storeNames;
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

        this._requests.forEach(function (request) {
            if (request.readyState !== 'done') {
                request.readyState = 'done'; // This will cancel execution of this request's operation
                request.result = undefined;
                request.error = new AbortError();

                var event = new Event('error', {
                    bubbles: true,
                    cancelable: true
                });
                event._eventPath = [this.db, this];
                request.dispatchEvent(event);
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
            request = new FDBRequest();
            request.source = source;
            request.transaction = source.transaction;
        }
        this._requests.push(request);

        var cb = function () {
            if (request.readyState === 'done') {
                // Must have been aborted transaction, so stop this.
                return;
            }

            for (var i = 0; i < this._requests.length; i++) {
                if (this._requests[i] === request) {
                    break;
                }

                if (this._requests[i].readyState === 'pending') {
                    return setImmediate(cb);
                }
            }

            var defaultAction, event;
            try {
                var result = operation();
                request.readyState = 'done';
                request.result = result;
                request.error = undefined;

//console.log("HERE");
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
                event._eventPath = [this.db, this];
                request.dispatchEvent(event);
                this._active = false;

                defaultAction = function () {
                    this.abort(err.name); // Don't seem to make sense, but works
                }.bind(this);
            }

            event._eventPath = [this.db, this];
            request.dispatchEvent(event);
            this._active = false;

// If an exception was propagated out from any event handler while dispatching the event in step 3, abort the transaction by following the steps for aborting a transaction using transaction as transaction parameter, and AbortError as error. This is done even if the error event is not canceled.
//     This means that if an error event is fired and any of the event handlers throw an exception, the error property on the transaction is set to an AbortError rather than whatever DOMError the error property on the request was set to. Even if preventDefault is never called.

            // Default action of event
            if (!event._canceled) { // Not sure if this is what the above 2 comments are referring to
                if (defaultAction) { // Not sure if this is what the above 2 comments are referring to
//                    this._abort('AbortErrorAAAAA');
                    defaultAction();
                }
            }
        }.bind(this);

        setImmediate(cb);

        return request;
    };

    this._checkComplete = function () {
        var complete = this._requests.every(function (request) {
            return request.readyState === 'done';
        });

        if (!this._finished) { // Either aborted or committed already
            if (complete) {
                this._active = false;

                if (!this.error) {
                    var event = new Event();
                    event.target = this;
                    event.type = 'complete';

                    this.dispatchEvent(event);
                }
            } else {
                setImmediate(this._checkComplete.bind(this));
            }
        }
    };

    setImmediate(this._checkComplete.bind(this));
//    setTimeout(this._checkComplete.bind(this), 100);

    EventTarget.call(this);

    return this;
};