const RecordStore = require('./RecordStore');
const {ConstraintError} = require('./errors');
const extractKey = require('./extractKey');
const validateKey = require('./validateKey');

// http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#dfn-index
class Index {
    constructor(rawObjectStore, name, keyPath, multiEntry, unique) {
        this.records = new RecordStore();
        this.rawObjectStore = rawObjectStore;
        this.initialized = false;
        this.deleted = false;
// Initialized should be used to decide whether to throw an error or abort the versionchange transaction when there is a constraint

        this.name = name;
        this.keyPath = keyPath;
        this.multiEntry = multiEntry;
        this.unique = unique;
    }

    // http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#dfn-steps-for-retrieving-a-value-from-an-index
    getKey(key) {
        const record = this.records.get(key);

        return record !== undefined ? record.value : undefined;
    }

    // http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#index-referenced-value-retrieval-operation
    getValue(key) {
        const record = this.records.get(key);

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
                const existingRecord = this.records.get(indexKey);
                if (existingRecord) {
                    throw new ConstraintError();
                }
            }
        } else {
            if (this.unique) {
                for (const individualIndexKey of indexKey) {
                    const existingRecord = this.records.get(individualIndexKey);
                    if (existingRecord) {
                        throw new ConstraintError();
                    }
                }
            }
        }

        if (!this.multiEntry || !Array.isArray(indexKey)) {
            this.records.add({
                key: indexKey,
                value: newRecord.key
            });
        } else {
            for (const individualIndexKey of indexKey) {
                this.records.add({
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
                    for (const record of this.rawObjectStore.records.values()) {
                        this.storeRecord(record);
                    }

                    this.initialized = true;
                } catch (err) {
//console.error(err);
                    transaction._abort(err.name);
                }
            },
        });
    }
}

module.exports = Index;
