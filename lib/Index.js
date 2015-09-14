'use strict';

var ConstraintError = require('./errors/ConstraintError');
var cmp = require('./cmp');
var extractKey = require('./extractKey');
var validateKey = require('./validateKey');
var RecordStore = require('./adapters').BinarySearchTree;

function compareKeys(a, b) {
    if (a === undefined) {
        return -1;
    }
    if (b === undefined) {
        return 1;
    }

    var cmpResult = cmp(a.key, b.key);

    if (cmpResult !== 0) {
        return cmpResult;
    }

    // Tiebreaker: sort by value, only for Indexes
    return cmp(a.value, b.value);
}

// http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#dfn-index
module.exports = function (rawObjectStore, name, keyPath, multiEntry, unique) {
    this.unique = !!unique;
    this.recordStore = new RecordStore({compareKeys: compareKeys, unique: this.unique});
    this.rawObjectStore = rawObjectStore;
    this.initialized = false;
    this.deleted = false;
// Initialized should be used to decide whether to throw an error or abort the versionchange transaction when there is a constraint

    this.name = name;
    this.keyPath = keyPath;
    this.multiEntry = multiEntry;

    this._getRecord = function (key) {
        var record = this.recordStore.get(key);

        return record;
    };

    // http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#dfn-steps-for-retrieving-a-value-from-an-index
    this.getKey = function (key) {
        var record = this._getRecord(key);

        return record !== undefined ? record.value : undefined;
    };

    // http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#index-referenced-value-retrieval-operation
    this.getValue = function (key) {
        var record = this._getRecord(key);

        return record !== undefined ? this.rawObjectStore.getValue(record.value) : undefined;
    };

    // http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#dfn-steps-for-storing-a-record-into-an-object-store (step 7)
    this.storeRecord = function (newRecord) {
        var indexKey = extractKey(this.keyPath, newRecord.value);
        if (indexKey === undefined) {
            return;
        }

        if (!this.multiEntry || !Array.isArray(indexKey)) {
            try {
                validateKey(indexKey);
            } catch (e) {
                return;
            }
        } else {
            // remove any elements from index key that are not valid keys and remove any duplicate elements from index key such that only one instance of the duplicate value remains.
            var keep = [];
            indexKey.forEach(function (part) {
                if (keep.indexOf(part) < 0) {
                    try {
                        validateKey(part);
                        keep.push(part);
                    } catch (err) { /* Do nothing */ }
                }
            });
            indexKey = keep;
        }

        if (!this.multiEntry || !Array.isArray(indexKey)) {
            if (this.unique) {
                if (this.recordStore.get(indexKey) !== undefined) {
                    throw new ConstraintError();
                }
            }
        } else {
            if (this.unique) {
                indexKey.forEach(function (individualIndexKey) {
                    if (this.recordStore.get(individualIndexKey) !== undefined) {
                        throw new ConstraintError();
                    }
                }.bind(this));
            }
        }

        if (!this.multiEntry || !Array.isArray(indexKey)) {
            this.recordStore.add({
                key: indexKey,
                value: newRecord.key
            });
        } else {
            indexKey.forEach(function (individualIndexKey) {
                this.recordStore.add({
                    key: individualIndexKey,
                    value: newRecord.key
                });
            }.bind(this));
        }
    };

    this.initialize = function (transaction) {
        if (this.initialized) {
            throw new Error("Index already initialized");
        }

        transaction._execRequestAsync({
            source: null,
            operation: function () {
                try {
                    // Create index based on current value of objectstore
                    this.rawObjectStore.recordStore.getAll().forEach(function (record) {
                        this.storeRecord(record);
                    }.bind(this));

                    this.initialized = true;
                } catch (err) {
                    transaction._abort(err.name);
                }
            }.bind(this)
        });
    };
};