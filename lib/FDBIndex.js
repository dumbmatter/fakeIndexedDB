'use strict';

var clone = require('structured-clone');
var FDBCursorWithValue = require('./FDBCursorWithValue');
var FDBKeyRange = require('./FDBKeyRange');
var FDBRequest = require('./FDBRequest');
var InvalidStateError = require('./errors/InvalidStateError');
var TransactionInactiveError = require('./errors/TransactionInactiveError');
var cmp = require('./cmp');
var validateKey = require('./validateKey');

function confirmActiveTransaction(index) {
    if (!index.objectStore.transaction._active) {
        throw new TransactionInactiveError();
    }

    if (index._rawIndex.deleted || index.objectStore._rawObjectStore.deleted) {
        throw new InvalidStateError();
    }
}

// http://www.w3.org/TR/IndexedDB/#idl-def-IDBIndex
module.exports = function (objectStore, rawIndex) {
    this._rawIndex = rawIndex;

    this.name = rawIndex.name;
    this.objectStore = objectStore;
    this.keyPath = rawIndex.keyPath;
    this.multiEntry = rawIndex.multiEntry;
    this.unique = rawIndex.unique;

    this.openCursor = function (range, direction) {
        confirmActiveTransaction(this);

        if (range === null) { range = undefined; }
        if (range !== undefined && !(range instanceof FDBKeyRange)) {
            range = FDBKeyRange.only(clone(validateKey(range)));
        }

        var request = new FDBRequest();
        request.source = this;
        request.transaction = this.objectStore.transaction;

        var cursor = new FDBCursorWithValue(this, range, direction);
        cursor.source = this;
        cursor._request = request;

        return this.objectStore.transaction._execRequestAsync(this, cursor._iterate.bind(cursor), request);
    };

    this.openKeyCursor = function () {
        throw new Error('Not implemented');
    };

    this.get = function (key) {
        confirmActiveTransaction(this);

        if (!(key instanceof FDBKeyRange)) {
            key = clone(validateKey(key));
        }

        return this.objectStore.transaction._execRequestAsync(this, this._rawIndex.getValue.bind(this._rawIndex, key));
    };

    // http://www.w3.org/TR/IndexedDB/#widl-IDBIndex-getKey-IDBRequest-any-key
    this.getKey = function (key) {
        confirmActiveTransaction(this);

        if (!(key instanceof FDBKeyRange)) {
            key = clone(validateKey(key));
        }

        return this.objectStore.transaction._execRequestAsync(this, this._rawIndex.getKey.bind(this._rawIndex, key));
    };

    // http://www.w3.org/TR/IndexedDB/#widl-IDBIndex-count-IDBRequest-any-key
    this.count = function (key) {
        confirmActiveTransaction(this);

        if (key !== undefined && !(key instanceof FDBKeyRange)) {
            key = clone(validateKey(key));
        }

// Should really use a cursor under the hood
        return this.objectStore.transaction._execRequestAsync(this, function () {
            var count;

            if (key instanceof FDBKeyRange) {
                count = 0;
                this._rawIndex.records.forEach(function (record) {
                    if (FDBKeyRange.check(key, record.key)) {
                        count += 1;
                    }
                });
            } else if (key !== undefined) {
                count = 0;
                this._rawIndex.records.forEach(function (record) {
                    if (cmp(record.key, key) === 0) {
                        count += 1;
                    }
                });
            } else {
                count = this._rawIndex.records.length;
            }

            return count;
        }.bind(this));
    };

    this.toString = function () {
        return '[object IDBIndex]';
    };
};