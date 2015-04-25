var clone = require('structured-clone');
var traverse = require('traverse');
var FDBRequest = require('./FDBRequest');
var ConstraintError = require('./errors/ConstraintError');
var DataError = require('./errors/DataError');
var ReadOnlyError = require('./errors/ReadOnlyError');
var TransactionInactiveError = require('./errors/TransactionInactiveError');
var cmp = require('./cmp');
var fireEvent = require('./fireEvent');

function confirmActiveTransaction(store) {
    if (!store.transaction._active) {
        throw new TransactionInactiveError();
    }
}

// http://www.w3.org/TR/IndexedDB/#dfn-valid-key
function validateKey(key, traversed) {
    if (typeof key === 'number') {
        if (isNaN(key)) {
            throw new DataError();
        }
    } else if (key instanceof Date) {
        if (isNaN(key.valueOf())) {
            throw new DataError();
        }
    } else if (Array.isArray(key)) {
        if (!traversed) {
            var seen = [];
            traverse(key).forEach(function (x) {
                if (seen.indexOf(x) >= 0) {
                    throw new DataError();
                }
                seen.push(x);
            });
        }

        var count = 0;
        key = key.map(function (item) {
            count += 1;
            return validateKey(item, true);
        });
        if (count !== key.length) {
            throw new DataError();
        }
        return key;
    } else if (typeof key !== 'string') {
        throw new DataError();
    }

    return clone(key);
}

// http://www.w3.org/TR/IndexedDB/#dfn-steps-for-extracting-a-key-from-a-value-using-a-key-path
function extractKey(keyPath, value) {
    if (Array.isArray(keyPath)) {
        var result = [];

        keyPath.forEach(function (item) {
            result.push(validateKey(extractKey(item, value)));
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

function getRecordAddPut(store, value, key) {
    confirmActiveTransaction(store);

    if (store.transaction.mode === 'readonly') {
        throw new ReadOnlyError();
    }
// If the object store has been deleted, the implementation MUST throw a DOMException of type InvalidStateError.

    if (store.keyPath !== null) {
        if (key !== undefined) {
            throw new DataError();
        }

        key = extractKey(store.keyPath, value);
        key = validateKey(key);
    }
    if (store.keyPath === null) {
        if (key === undefined) {
            throw new DataError();
        }
        key = validateKey(key);
    }

    return {
        key: key,
        value: clone(value)
    };
}

// http://www.w3.org/TR/IndexedDB/#dfn-steps-for-deleting-records-from-an-object-store
function deleteRecord(store, key) {
// Needs to support key as range!
    var i = store._records.findIndex(function (record) {
        return cmp(record.key, key) === 0;
    });

    store._records.splice(i, 1);

// Needs to delete key in indexes too!
}

// http://www.w3.org/TR/IndexedDB/#dfn-steps-for-storing-a-record-into-an-object-store
function storeRecord(store, newRecord, noOverwrite) {
    var i = store._records.findIndex(function (record) {
        return cmp(record.key, newRecord.key) === 0;
    });

    if (i >= 0) {
        if (noOverwrite) {
            throw new ConstraintError();
        } else {
            deleteRecord(store, newRecord.key);
        }
    }

// Shouldn't push, should place in where key is in order of array
    store._records.push(newRecord);

// Index stuff

    return newRecord.key;
}

// http://www.w3.org/TR/IndexedDB/#dfn-steps-for-retrieving-a-value-from-an-object-store
function getValue(store, key) {
// Keyrange stuff
    var record = store._records.find(function (record) {
        return cmp(record.key, key) === 0;
    });
    return record !== undefined ? record.value : undefined;
}

// http://www.w3.org/TR/IndexedDB/#object-store
module.exports = function (name, keyPath) {
    this._records = []; // FDB: to store data

    this.name = name;
    this.keyPath = keyPath;
    this.indexNames = [];
    this.transaction = null;
    this.autoIncrement = null;

    this.put = function (value, key) {
        var record = getRecordAddPut(this, value, key);
        storeRecord(this, record, false);

        var request = new FDBRequest();
        request.transaction = this.transaction;

        fireEvent('success', request, record.key);

        return request;
    };

    this.add = function (value, key) {
        var record = getRecordAddPut(this, value, key);
        storeRecord(this, record, false);

        var request = new FDBRequest();
        request.transaction = this.transaction;
        fireEvent('success', request, record.key);
        return request;
    };

    this.delete = function () {
        throw new Error('Not implemented');
    };

    this.get = function (key) {
        confirmActiveTransaction(this);

        key = validateKey(key);

        var value = getValue(this, key);

        var request = new FDBRequest();
        request.transaction = this.transaction;
        fireEvent('success', request, value);
        return request;
    };

    this.clear = function () {
        throw new Error('Not implemented');
    };

    this.openCursor = function () {
        throw new Error('Not implemented');
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
        confirmActiveTransaction(this);

        var count;
        if (key !== undefined) {
            key = validateKey(key);

            count = 0;
            this._records.forEach(function (record) {
                if (cmp(record.key, key) === 0) {
                    count += 1;
                }
            });
        } else {
            count = this._records.length;
        }

        var request = new FDBRequest();
        request.transaction = this.transaction;
        fireEvent('success', request, count);
        return request;
    };

    return this;
};