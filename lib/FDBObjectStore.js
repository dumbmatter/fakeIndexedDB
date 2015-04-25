var clone = require('structured-clone');
var traverse = require('traverse');
var FDBCursor = require('./FDBCursor');
var FDBRequest = require('./FDBRequest');
var KeyGenerator = require('./KeyGenerator');
var ConstraintError = require('./errors/ConstraintError');
var DataError = require('./errors/DataError');
var ReadOnlyError = require('./errors/ReadOnlyError');
var TransactionInactiveError = require('./errors/TransactionInactiveError');
var cmp = require('./cmp');

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

    value = clone(value);

    if (store.keyPath !== null) {
        if (key !== undefined) {
            throw new DataError();
        }

        key = extractKey(store.keyPath, value);
    }

console.log('init', key);
    if (store._keyGenerator !== null && key === undefined) {
        key = store._keyGenerator.next();

        // Set in value if keyPath defiend but led to no key
        // http://www.w3.org/TR/IndexedDB/#dfn-steps-to-assign-a-key-to-a-value-using-a-key-path
        if (store.keyPath !== null) {
            var remainingKeyPath = store.keyPath;
            var object = value;

            var i = 0; // Just to run the loop at least once
            while (i >= 0) {
                if (typeof object !== 'object') {
                    throw new DataError();
                }

                i = remainingKeyPath.indexOf('.');
                if (i >= 0) {
                    var identifier = remainingKeyPath.slice(0, i);
                    remainingKeyPath = remainingKeyPath.slice(i + 1);

                    if (!object.hasOwnProperty(identifier)) {
                        object[identifier] = {};
                    }

                    object = object[identifier];
                }
            }

            identifier = remainingKeyPath;

            object[identifier] = key;
        }
    } else if (store._keyGenerator !== null && typeof key === 'number') {
        store._keyGenerator.setIfLarger(key);
    }

    if (store.keyPath === null) {
        if (key === undefined) {
            throw new DataError();
        }
    }

console.log('pre-validate', key);
    key = validateKey(key);
console.log('final', key, '\n');

    return {
        key: key,
        value: value
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

    // Find where to put it so it's sorted by key
    if (store._records.length === 0) {
        i = 0;
    }
    i = store._records.findIndex(function (record) {
        return cmp(record.key, newRecord.key) === 1;
    });
    if (i === -1) {
        i = store._records.length;
    }
    store._records.splice(i, 0, newRecord);

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
module.exports = function (name, keyPath, autoIncrement) {
    this._records = []; // FDB: to store data
    this._keyGenerator = autoIncrement === true ? new KeyGenerator() : null;

    this.name = name;
    this.keyPath = keyPath;
    this.indexNames = [];
    this.transaction = null;
    this.autoIncrement = null;

    this.put = function (value, key) {
        var record = getRecordAddPut(this, value, key);

        return this.transaction._execRequestAsync(this, storeRecord.bind(null, this, record, false));
    };

    this.add = function (value, key) {
        var record = getRecordAddPut(this, value, key);

        return this.transaction._execRequestAsync(this, storeRecord.bind(null, this, record, true));
    };

    this.delete = function () {
        throw new Error('Not implemented');
    };

    this.get = function (key) {
        confirmActiveTransaction(this);

        key = validateKey(key);

        return this.transaction._execRequestAsync(this, getValue.bind(null, this, key));
    };

    this.clear = function () {
        throw new Error('Not implemented');
    };

    this.openCursor = function (range, direction) {
        confirmActiveTransaction(this);

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
        confirmActiveTransaction(this);

        if (key !== undefined) {
            key = validateKey(key);
        }

// Should really use a cursor under the hood
        return this.transaction._execRequestAsync(this, function () {
            var count;

            if (key !== undefined) {
                count = 0;
                this._records.forEach(function (record) {
                    if (cmp(record.key, key) === 0) {
                        count += 1;
                    }
                });
            } else {
                count = this._records.length;
            }

            return count;
        }.bind(this));
    };
};