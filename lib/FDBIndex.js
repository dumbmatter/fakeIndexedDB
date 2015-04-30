'use strict';

var clone = require('structured-clone');
var FDBCursor = require('./FDBCursor');
var FDBKeyRange = require('./FDBKeyRange');
var FDBRequest = require('./FDBRequest');
var InvalidStateError = require('./errors/InvalidStateError');
var TransactionInactiveError = require('./errors/TransactionInactiveError');
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

        var cursor = new FDBCursor(this, range, direction);
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

    this.getKey = function () {
        throw new Error('Not implemented');
    };

    this.count = function () {
        throw new Error('Not implemented');
    };
};