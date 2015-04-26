'use strict';

var clone = require('structured-clone');
var FDBCursor = require('./FDBCursor');
var FDBKeyRange = require('../lib/FDBKeyRange');
var FDBRequest = require('./FDBRequest');
var DataError = require('./errors/DataError');
var ReadOnlyError = require('./errors/ReadOnlyError');
var TransactionInactiveError = require('./errors/TransactionInactiveError');
var cmp = require('./cmp');
var extractKey = require('./extractKey');
var validateKey = require('./validateKey');

function confirmActiveTransaction() {
    if (!this.transaction._active) {
        throw new TransactionInactiveError();
    }
}

function buildRecordAddPut(value, key) {
    if (this.transaction.mode === 'readonly') {
        throw new ReadOnlyError();
    }

    confirmActiveTransaction.call(this);

// If the object store has been deleted, the implementation MUST throw a DOMException of type InvalidStateError.

    if (this.keyPath !== null) {
        if (key !== undefined) {
            throw new DataError();
        }

        var tempKey = extractKey(this.keyPath, value);

        if (tempKey !== undefined) {
            validateKey(tempKey);
        } else {
            if (!this._objectStore.keyGenerator) {
                throw new DataError();
            }
        }
    }

    if (this.keyPath === null && this._objectStore.keyGenerator === null && key === undefined) {
        throw new DataError();
    }

    if (key !== undefined) {
        validateKey(key);
    }

    return {
        key: clone(key),
        value: clone(value)
    };
}

// http://www.w3.org/TR/IndexedDB/#object-store
module.exports = function (transaction, objectStore) {
    this._objectStore = objectStore;

    this.name = objectStore.name;
    this.keyPath = objectStore.keyPath;
    this.indexNames = objectStore.indexNames;
    this.autoIncrement = objectStore.autoIncrement;
    this.transaction = transaction;

    this.put = function (value, key) {
        var record = buildRecordAddPut.call(this, value, key);

        return this.transaction._execRequestAsync(this, this._objectStore.storeRecord.bind(this._objectStore, record, false));
    };

    this.add = function (value, key) {
        var record = buildRecordAddPut.call(this, value, key);

        return this.transaction._execRequestAsync(this, this._objectStore.storeRecord.bind(this._objectStore, record, true));
    };

    this.delete = function () {
        throw new Error('Not implemented');
    };

    this.get = function (key) {
        confirmActiveTransaction.call(this);

        if (!(key instanceof FDBKeyRange)) {
            key = clone(validateKey(key));
        }

        return this.transaction._execRequestAsync(this, this._objectStore.getValue.bind(this._objectStore, key));
    };

    this.clear = function () {
        throw new Error('Not implemented');
    };

    this.openCursor = function (range, direction) {
        confirmActiveTransaction.call(this);

// Confirm range is valid key or keyRange

        var request = new FDBRequest();
        request.transaction = this.transaction;

        var cursor = new FDBCursor(this, range, direction);
        cursor._request = request;
        cursor.continue();

        return request;
    };

    this.createIndex = function () {
        throw new Error('Not implemented');
    };

    this.index = function () {
        throw new Error('Not implemented');
    };

    this.deleteIndex = function () {
        throw new Error('Not implemented');
    };

    // http://www.w3.org/TR/IndexedDB/#widl-IDBObjectStore-count-IDBRequest-any-key
    this.count = function (key) {
        confirmActiveTransaction.call(this);

        if (key !== undefined) {
            key = clone(validateKey(key));
        }

// Should really use a cursor under the hood
        return this.transaction._execRequestAsync(this, function () {
            var count;

            if (key !== undefined) {
                count = 0;
                this._objectStore.records.forEach(function (record) {
                    if (cmp(record.key, key) === 0) {
                        count += 1;
                    }
                });
            } else {
                count = this._objectStore.records.length;
            }

            return count;
        }.bind(this));
    };
};