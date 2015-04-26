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

console.log('abort', error);
        var e;
        if (error !== null) {
            e = new Error();
            e.name = error;
            this.error = e;
        }

// If the transaction's request list contain any requests whose done flag is still false, abort the steps for asynchronously executing a request for each such request and queue a task to perform the following steps: 

        process.nextTick(function () {
            var event = new Event('abort', {
                bubbles: true,
                cancelable: false
            });
            event._eventPath = [this.db];
            this.dispatchEvent(event);
        }.bind(this));

        this._finished = true;
    }

    this.abort = function () {
        if (this._finished) {
            throw new InvalidStateError();
        }
        this._active = false;

        abort(transaction, null);
        
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
                event = new Event('success');
//                event.target = request;
                request.dispatchEvent(event);
                this._active = false;
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
//                event.target = request;
                request.dispatchEvent(event);
                this._active = false;
// If an exception was propagated out from any event handler while dispatching the event in step 3, abort the transaction by following the steps for aborting a transaction using transaction as transaction parameter, and AbortError as error. This is done even if the error event is not canceled. 
//     This means that if an error event is fired and any of the event handlers throw an exception, the error property on the transaction is set to an AbortError rather than whatever DOMError the error property on the request was set to. Even if preventDefault is never called. 
                this._abort('AbortError'); // This doesn't match the above 2 comments
            }
        }.bind(this);

        process.nextTick(cb);

        return request;
    };

    setImmediate(function () {
        this._active = false;

        if (!this.error) {
            var event = new Event();
            event.target = this;
            event.type = 'complete';

            this.dispatchEvent(event);
        }
    }.bind(this));

    EventTarget.call(this);

    return this;
};