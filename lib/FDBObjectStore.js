'use strict';

var clone = require('structured-clone');
var Index = require('./Index');
var FDBCursor = require('./FDBCursor');
var FDBIndex = require('./FDBIndex');
var FDBKeyRange = require('./FDBKeyRange');
var FDBRequest = require('./FDBRequest');
var ConstraintError = require('./errors/ConstraintError');
var DataError = require('./errors/DataError');
var InvalidAccessError = require('./errors/InvalidAccessError');
var InvalidStateError = require('./errors/InvalidStateError');
var NotFoundError = require('./errors/NotFoundError');
var ReadOnlyError = require('./errors/ReadOnlyError');
var TransactionInactiveError = require('./errors/TransactionInactiveError');
var cmp = require('./cmp');
var extractKey = require('./extractKey');
var validateKey = require('./validateKey');
var validateKeyPath = require('./validateKeyPath');

function confirmActiveTransaction(transaction) {
    if (!transaction._active) {
        throw new TransactionInactiveError();
    }
}

function buildRecordAddPut(value, key) {
    if (this.transaction.mode === 'readonly') {
        throw new ReadOnlyError();
    }

    if (this._rawObjectStore.deleted) {
        throw new InvalidStateError();
    }

    confirmActiveTransaction(this.transaction);

    if (this.keyPath !== null) {
        if (key !== undefined) {
            throw new DataError();
        }

        var tempKey = extractKey(this.keyPath, value);

        if (tempKey !== undefined) {
            validateKey(tempKey);
        } else {
            if (!this._rawObjectStore.keyGenerator) {
                throw new DataError();
            }
        }
    }

    if (this.keyPath === null && this._rawObjectStore.keyGenerator === null && key === undefined) {
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
module.exports = function (transaction, rawObjectStore) {
    this._rawObjectStore = rawObjectStore;
    this._rawIndexesCache = {}; // Store the FDBIndex objects

    this.name = rawObjectStore.name;
    this.keyPath = rawObjectStore.keyPath;
    this.indexNames = Object.keys(rawObjectStore.indexes);
    this.autoIncrement = rawObjectStore.autoIncrement;
    this.transaction = transaction;

    this.put = function (value, key) {
        var record = buildRecordAddPut.call(this, value, key);

        return this.transaction._execRequestAsync(this, this._rawObjectStore.storeRecord.bind(this._rawObjectStore, record, false));
    };

    this.add = function (value, key) {
        var record = buildRecordAddPut.call(this, value, key);

        return this.transaction._execRequestAsync(this, this._rawObjectStore.storeRecord.bind(this._rawObjectStore, record, true));
    };

    this.delete = function () {
        throw new Error('Not implemented');
    };

    this.get = function (key) {
        confirmActiveTransaction(this.transaction);

        if (!(key instanceof FDBKeyRange)) {
            key = clone(validateKey(key));
        }

        return this.transaction._execRequestAsync(this, this._rawObjectStore.getValue.bind(this._rawObjectStore, key));
    };

    this.clear = function () {
        throw new Error('Not implemented');
    };

    this.openCursor = function (range, direction) {
        confirmActiveTransaction(this.transaction);

// Confirm range is valid key or keyRange

        var request = new FDBRequest();
        request.transaction = this.transaction;

        var cursor = new FDBCursor(this, range, direction);
        cursor._request = request;
        cursor.continue();

        return request;
    };

    this.createIndex = function (name, keyPath, optionalParameters) {
        if (keyPath === undefined) { throw new TypeError(); }

        optionalParameters = optionalParameters !== undefined ? optionalParameters : {};
        var multiEntry = optionalParameters.multiEntry !== undefined ? optionalParameters.multiEntry : false;
        var unique = optionalParameters.unique !== undefined ? optionalParameters.unique : false;

        if (this.transaction.mode !== 'versionchange') {
            throw new InvalidStateError();
        }

        if (this._rawObjectStore.deleted) {
            throw new InvalidStateError();
        }

        if (!this.transaction._active) {
            throw new TransactionInactiveError();
        }

        if (this.indexNames.indexOf(name) >= 0) {
            throw new ConstraintError();
        }

        validateKeyPath(keyPath);

        if (Array.isArray(keyPath) && multiEntry) {
            throw new InvalidAccessError();
        }

// The index that is requested to be created can contain constraints on the data allowed in the index's referenced object store, such as requiring uniqueness of the values referenced by the index's keyPath. If the referenced object store already contains data which violates these constraints, this MUST NOT cause the implementation of createIndex to throw an exception or affect what it returns. The implementation MUST still create and return an IDBIndex object. Instead the implementation must queue up an operation to abort the "versionchange" transaction which was used for the createIndex call.

        var index = new Index(this._rawObjectStore, name, keyPath, multiEntry, unique);
        this.indexNames.push(name);
        this._rawObjectStore.indexes[name] = index;

        index.initialize(this.transaction); // This is async by design

        return new FDBIndex(this, index);
    };

    this.index = function (name) {
        if (name === undefined) { throw new TypeError(); }

        if (this._rawIndexesCache.hasOwnProperty(name)) {
            return this._rawIndexesCache[name];
        }

        if (this.indexNames.indexOf(name) < 0) {
            throw new NotFoundError();
        }

        var index = new FDBIndex(this, this._rawObjectStore.indexes[name]);
        this._rawIndexesCache[name] = index;

        return index;
    };

    this.deleteIndex = function (name) {
        if (name === undefined) { throw new TypeError(); }

        if (this.transaction.mode !== 'versionchange') {
            throw new InvalidStateError();
        }

        if (!this.transaction._active) {
            throw new TransactionInactiveError();
        }

// If the object store has been deleted, the implementation MUST throw a DOMException of type InvalidStateError.

        if (!this._rawObjectStore.indexes.hasOwnProperty(name)) {
            throw new NotFoundError();
        }

        this.indexNames = this.indexNames.filter(function (indexName) {
            return indexName !== name;
        });
        this._rawObjectStore.indexes[name].deleted = true; // Not sure if this is supposed to happen synchronously

        this.transaction._execRequestAsync(this, function () {
            delete this._rawObjectStore.indexes[name];
        }.bind(this));
    };

    // http://www.w3.org/TR/IndexedDB/#widl-IDBObjectStore-count-IDBRequest-any-key
    this.count = function (key) {
        confirmActiveTransaction(this.transaction);

        if (key !== undefined) {
            key = clone(validateKey(key));
        }

// Should really use a cursor under the hood
        return this.transaction._execRequestAsync(this, function () {
            var count;

            if (key !== undefined) {
                count = 0;
                this._rawObjectStore.records.forEach(function (record) {
                    if (cmp(record.key, key) === 0) {
                        count += 1;
                    }
                });
            } else {
                count = this._rawObjectStore.records.length;
            }

            return count;
        }.bind(this));
    };
};