'use strict';

var clone = require('structured-clone');
var FDBKeyRange = require('./FDBKeyRange');
var TransactionInactiveError = require('./errors/TransactionInactiveError');
var validateKey = require('./validateKey');

function confirmActiveTransaction() {
    if (!this.transaction._active) {
        throw new TransactionInactiveError();
    }
}

// http://www.w3.org/TR/IndexedDB/#idl-def-IDBIndex
module.exports = function (objectStore, index) {
    this._index = index;

    this.name = index.name;
    this.objectStore = objectStore;
    this.keyPath = index.keyPath;
    this.multiEntry = index.multiEntry;
    this.unique = index.unique;

    this.openCursor = function () {
        throw new Error('Not implemented');
    };

    this.openKeyCursor = function () {
        throw new Error('Not implemented');
    };

    this.get = function (key) {
        confirmActiveTransaction.call(this.objectStore);

        if (!(key instanceof FDBKeyRange)) {
            key = clone(validateKey(key));
        }

        return this.objectStore.transaction._execRequestAsync(this, this._index.getValue.bind(this._index, key));
    };

    this.getKey = function () {
        throw new Error('Not implemented');
    };

    this.count = function () {
        throw new Error('Not implemented');
    };
};