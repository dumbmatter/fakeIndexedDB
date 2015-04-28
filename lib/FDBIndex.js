'use strict';

var clone = require('structured-clone');
var FDBKeyRange = require('./FDBKeyRange');
var InvalidStateError = require('./errors/InvalidStateError');
var TransactionInactiveError = require('./errors/TransactionInactiveError');
var validateKey = require('./validateKey');

function confirmActiveTransaction() {
    if (!this.transaction._active) {
        throw new TransactionInactiveError();
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

    this.openCursor = function () {
        throw new Error('Not implemented');
    };

    this.openKeyCursor = function () {
        throw new Error('Not implemented');
    };

    this.get = function (key) {
        confirmActiveTransaction.call(this.objectStore);

        if (this._rawIndex.deleted) {
// Also if object store itself has been deleted
            throw new InvalidStateError();
        }

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