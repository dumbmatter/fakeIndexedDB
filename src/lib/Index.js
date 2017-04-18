const FDBKeyRange = require('../FDBKeyRange');
const {ConstraintError} = require('./errors');
const cmp = require('./cmp');
const extractKey = require('./extractKey');
const validateKey = require('./validateKey');

// http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#dfn-index
class Index {
    constructor(rawObjectStore, name, keyPath, multiEntry, unique) {
        this.records = [];
        this.rawObjectStore = rawObjectStore;
        this.initialized = false;
        this.deleted = false;
// Initialized should be used to decide whether to throw an error or abort the versionchange transaction when there is a constraint

        this.name = name;
        this.keyPath = keyPath;
        this.multiEntry = multiEntry;
        this.unique = unique;
    }

    _getRecord(key) {
        if (key instanceof FDBKeyRange) {
            return this.records.find((record) => {
                return FDBKeyRange.check(key, record.key);
            });
        }

        return this.records.find((record) => {
            return cmp(record.key, key) === 0;
        });
    }

    // http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#dfn-steps-for-retrieving-a-value-from-an-index
    getKey(key) {
        const record = this._getRecord(key);

        return record !== undefined ? record.value : undefined;
    }

    // http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#index-referenced-value-retrieval-operation
    getValue(key) {
        const record = this._getRecord(key);

        return record !== undefined ? this.rawObjectStore.getValue(record.value) : undefined;
    }

    // http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#dfn-steps-for-storing-a-record-into-an-object-store (step 7)
    storeRecord(newRecord) {
        let indexKey;
        try {
            indexKey = extractKey(this.keyPath, newRecord.value);
        } catch (err) {
            if (err.name === 'DataError') {
                // Invalid key is not an actual error, just means we do not store an entry in this index
                return;
            }

            throw err;
        }

        if (!this.multiEntry || !Array.isArray(indexKey)) {
            try {
                validateKey(indexKey);
            } catch (e) {
                return;
            }
        } else {
            // remove any elements from index key that are not valid keys and remove any duplicate elements from index key such that only one instance of the duplicate value remains.
            const keep = [];
            for (const part of indexKey) {
                if (keep.indexOf(part) < 0) {
                    try {
                        validateKey(part);
                        keep.push(part);
                    } catch (err) { /* Do nothing */ }
                }
            }
            indexKey = keep;
        }

        if (!this.multiEntry || !Array.isArray(indexKey)) {
            if (this.unique) {
                const i = this.records.findIndex((record) => {
                    return cmp(record.key, indexKey) === 0;
                });
                if (i >= 0) {
                    throw new ConstraintError();
                }
            }
        } else {
            if (this.unique) {
                for (const individualIndexKey of indexKey) {
                    for (const record of this.records) {
                        if (cmp(record.key, individualIndexKey) === 0) {
                            throw new ConstraintError();
                        }
                    }
                }
            }
        }

        // Store record {key (indexKey) and value (recordKey)} sorted ascending by key (primarily) and value (secondarily)
        const storeInIndex = (newRecord) => {
            let i = this.records.findIndex((record) => {
                return cmp(record.key, newRecord.key) >= 0;
            });

            // If no matching key, add to end
            if (i === -1) {
                i = this.records.length;
            } else {
                // If matching key, advance to appropriate position based on value
                while (i < this.records.length && cmp(this.records[i].key, newRecord.key) === 0) {
                    if (cmp(this.records[i].value, newRecord.value) !== -1) {
                        // Record value >= newRecord value, so insert here
                        break;
                    }

                    i += 1; // Look at next record
                }
            }

            this.records.splice(i, 0, newRecord);
        };

        if (!this.multiEntry || !Array.isArray(indexKey)) {
            storeInIndex({
                key: indexKey,
                value: newRecord.key
            });
        } else {
            for (const individualIndexKey of indexKey) {
                storeInIndex({
                    key: individualIndexKey,
                    value: newRecord.key
                });
            }
        }
    }

    initialize(transaction) {
        if (this.initialized) {
            throw new Error("Index already initialized");
        }

        transaction._execRequestAsync({
            source: null,
            operation: () => {
                try {
                    // Create index based on current value of objectstore
                    for (const record of this.rawObjectStore.records) {
                        this.storeRecord(record);
                    }

                    this.initialized = true;
                } catch (err) {
                    transaction._abort(err.name);
                }
            },
        });
    }
}

module.exports = Index;
