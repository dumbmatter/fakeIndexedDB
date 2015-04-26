var clone = require('structured-clone');
var FDBCursor = require('./FDBCursor');
var FDBKeyRange = require('../lib/FDBKeyRange');
var FDBRequest = require('./FDBRequest');
var ConstraintError = require('./errors/ConstraintError');
var DataError = require('./errors/DataError');
var ReadOnlyError = require('./errors/ReadOnlyError');
var TransactionInactiveError = require('./errors/TransactionInactiveError');
var cmp = require('./cmp');
var validateKey = require('./validateKey');

function confirmActiveTransaction() {
    if (!this.transaction._active) {
        throw new TransactionInactiveError();
    }
}

// http://www.w3.org/TR/IndexedDB/#dfn-steps-for-extracting-a-key-from-a-value-using-a-key-path
function extractKey(keyPath, value) {
    if (Array.isArray(keyPath)) {
        var result = [];

        keyPath.forEach(function (item) {
            result.push(clone(validateKey(extractKey(item, value))));
        });

        return result;
    }

    if (keyPath === '') {
        return value;
    }

    var remainingKeyPath = keyPath;
    var object = value;

    while (remainingKeyPath !== null) {
        var identifier;

        var i = remainingKeyPath.indexOf('.');
        if (i >= 0) {
            identifier = remainingKeyPath.slice(0, i);
            remainingKeyPath = remainingKeyPath.slice(i + 1);
        } else {
            identifier = remainingKeyPath;
            remainingKeyPath = null;
        }

        if (!object.hasOwnProperty(identifier)) {
            return;
        }

        object = object[identifier];
    }

    return object;
}

function getRecordAddPut(value, key) {
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

// http://www.w3.org/TR/IndexedDB/#dfn-steps-for-deleting-records-from-an-object-store
function deleteRecord(store, key) {
// Needs to support key as range!
    var i = store.records.findIndex(function (record) {
        return cmp(record.key, key) === 0;
    });

    store.records.splice(i, 1);

// Needs to delete key in indexes too!
}

// http://www.w3.org/TR/IndexedDB/#dfn-steps-for-storing-a-record-into-an-object-store
function storeRecord(store, newRecord, noOverwrite) {
    if (store.keyPath) {
        var key = extractKey(store.keyPath, newRecord.value);
        if (key !== undefined) {
            newRecord.key = key;
        }
    }

    if (store.keyGenerator !== null && newRecord.key === undefined) {
        newRecord.key = store.keyGenerator.next();

        // Set in value if keyPath defiend but led to no key
        // http://www.w3.org/TR/IndexedDB/#dfn-steps-to-assign-a-key-to-a-value-using-a-key-path
        if (store.keyPath !== null) {
            var remainingKeyPath = store.keyPath;
            var object = newRecord.value;
            var identifier;

            var i = 0; // Just to run the loop at least once
            while (i >= 0) {
                if (typeof object !== 'object') {
                    throw new DataError();
                }

                i = remainingKeyPath.indexOf('.');
                if (i >= 0) {
                    identifier = remainingKeyPath.slice(0, i);
                    remainingKeyPath = remainingKeyPath.slice(i + 1);

                    if (!object.hasOwnProperty(identifier)) {
                        object[identifier] = {};
                    }

                    object = object[identifier];
                }
            }

            identifier = remainingKeyPath;

            object[identifier] = newRecord.key;
        }
    } else if (store.keyGenerator !== null && typeof newRecord.key === 'number') {
        store.keyGenerator.setIfLarger(newRecord.key);
    }

    var i = store.records.findIndex(function (record) {
        return cmp(record.key, newRecord.key) === 0;
    });

    if (i >= 0) {
        if (noOverwrite) {
            throw new ConstraintError();
        } else {
            deleteRecord(store, newRecord.key);
        }
    }

    // Find where to put it so it's sorted by key
    if (store.records.length === 0) {
        i = 0;
    }
    i = store.records.findIndex(function (record) {
        return cmp(record.key, newRecord.key) === 1;
    });
    if (i === -1) {
        i = store.records.length;
    }
    store.records.splice(i, 0, newRecord);

// Index stuff

    return newRecord.key;
}

// http://www.w3.org/TR/IndexedDB/#dfn-steps-for-retrieving-a-value-from-an-object-store
function getValue(store, key) {
    var record;
    if (key instanceof FDBKeyRange) {
        record = store.records.find(function (record) {
            return FDBKeyRange.check(key, record.key);
        });
    } else {
        record = store.records.find(function (record) {
            return cmp(record.key, key) === 0;
        });
    }

    return record !== undefined ? record.value : undefined;
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
        var record = getRecordAddPut.call(this, value, key);

        return this.transaction._execRequestAsync(this, storeRecord.bind(null, this._objectStore, record, false));
    };

    this.add = function (value, key) {
        var record = getRecordAddPut.call(this, value, key);

        return this.transaction._execRequestAsync(this, storeRecord.bind(null, this._objectStore, record, true));
    };

    this.delete = function () {
        throw new Error('Not implemented');
    };

    this.get = function (key) {
        confirmActiveTransaction.call(this);

        if (!(key instanceof FDBKeyRange)) {
            key = clone(validateKey(key));
        }

        return this.transaction._execRequestAsync(this, getValue.bind(null, this._objectStore, key));
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