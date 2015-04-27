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
    this._indexesCache = {}; // Store the FDBIndex objects

    this.name = objectStore.name;
    this.keyPath = objectStore.keyPath;
    this.indexNames = clone(objectStore.indexNames);
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

    this.createIndex = function (name, keyPath, optionalParameters) {
        if (keyPath === undefined) { throw new TypeError(); }

        optionalParameters = optionalParameters !== undefined ? optionalParameters : {};
        var multiEntry = optionalParameters.multiEntry !== undefined ? optionalParameters.multiEntry : false;
        var unique = optionalParameters.unique !== undefined ? optionalParameters.unique : false;

        if (this.transaction.mode !== 'versionchange') {
            throw new InvalidStateError();
        }

        if (!this.transaction._active) {
            throw new TransactionInactiveError();
        }

//  If the object store has been deleted, the implementation MUST throw a DOMException of type InvalidStateError.

        if (this.indexNames.indexOf(name) >= 0) {
            throw new ConstraintError();
        }

        validateKeyPath(keyPath);

        if (Array.isArray(keyPath) && multiEntry) {
            throw new InvalidAccessError();
        }

// The index that is requested to be created can contain constraints on the data allowed in the index's referenced object store, such as requiring uniqueness of the values referenced by the index's keyPath. If the referenced object store already contains data which violates these constraints, this MUST NOT cause the implementation of createIndex to throw an exception or affect what it returns. The implementation MUST still create and return an IDBIndex object. Instead the implementation must queue up an operation to abort the "versionchange" transaction which was used for the createIndex call.

        var index = new Index(this._objectStore, name, keyPath, multiEntry, unique);
        this.indexNames.push(name);
        this._objectStore.indexNames.push(name);
        this._objectStore.indexes[name] = index;

        index.initialize(this.transaction); // This is async by design

        return new FDBIndex(this, index);
    };

    this.index = function (name) {
        if (name === undefined) { throw new TypeError(); }

        if (this._indexesCache.hasOwnProperty(name)) {
            return this._indexesCache[name];
        }

        if (this.indexNames.indexOf(name) < 0) {
            throw new NotFoundError();
        }

        var index = new FDBIndex(this, this._objectStore.indexes[name]);
        this._indexesCache[name] = index;

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

        if (!this._objectStore.indexes.hasOwnProperty(name)) {
            throw new NotFoundError();
        }

        this.indexNames = this.indexNames.filter(function (indexName) {
            return indexName !== name;
        });
        this._objectStore.indexes[name].deleted = true; // Not sure if this is supposed to happen synchronously

        this.transaction._execRequestAsync(this, function () {
            delete this._objectStore.indexes[name];
            this._objectStore.indexNames = this._objectStore.indexNames.filter(function (indexName) {
                return indexName !== name;
            });
        }.bind(this));
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