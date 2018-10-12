import FDBKeyRange from "../FDBKeyRange";
import FDBTransaction from "../FDBTransaction";
import { ConstraintError } from "./errors";
import extractKey from "./extractKey";
import ObjectStore from "./ObjectStore";
import RecordStore from "./RecordStore";
import structuredClone from "./structuredClone";
import { Key, KeyPath, Record } from "./types";
import valueToKey from "./valueToKey";

// http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#dfn-index
class Index {
    public deleted = false;
    // Initialized should be used to decide whether to throw an error or abort the versionchange transaction when there is a
    // constraint
    public initialized = false;
    public readonly rawObjectStore: ObjectStore;
    public readonly records = new RecordStore();
    public name: string;
    public readonly keyPath: KeyPath;
    public multiEntry: boolean;
    public unique: boolean;

    constructor(
        rawObjectStore: ObjectStore,
        name: string,
        keyPath: KeyPath,
        multiEntry: boolean,
        unique: boolean,
    ) {
        this.rawObjectStore = rawObjectStore;

        this.name = name;
        this.keyPath = keyPath;
        this.multiEntry = multiEntry;
        this.unique = unique;
    }

    // http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#dfn-steps-for-retrieving-a-value-from-an-index
    public getKey(key: FDBKeyRange | Key) {
        const record = this.records.get(key);

        return record !== undefined ? record.value : undefined;
    }

    // http://w3c.github.io/IndexedDB/#retrieve-multiple-referenced-values-from-an-index
    public getAllKeys(range: FDBKeyRange, count?: number) {
        if (count === undefined || count === 0) {
            count = Infinity;
        }

        const records = [];
        for (const record of this.records.values(range)) {
            records.push(structuredClone(record.value));
            if (records.length >= count) {
                break;
            }
        }

        return records;
    }

    // http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#index-referenced-value-retrieval-operation
    public getValue(key: FDBKeyRange | Key) {
        const record = this.records.get(key);

        return record !== undefined
            ? this.rawObjectStore.getValue(record.value)
            : undefined;
    }

    // http://w3c.github.io/IndexedDB/#retrieve-multiple-referenced-values-from-an-index
    public getAllValues(range: FDBKeyRange, count?: number) {
        if (count === undefined || count === 0) {
            count = Infinity;
        }

        const records = [];
        for (const record of this.records.values(range)) {
            records.push(this.rawObjectStore.getValue(record.value));
            if (records.length >= count) {
                break;
            }
        }

        return records;
    }

    // http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#dfn-steps-for-storing-a-record-into-an-object-store (step 7)
    public storeRecord(newRecord: Record) {
        let indexKey;
        try {
            indexKey = extractKey(this.keyPath, newRecord.value);
        } catch (err) {
            if (err.name === "DataError") {
                // Invalid key is not an actual error, just means we do not store an entry in this index
                return;
            }

            throw err;
        }

        if (!this.multiEntry || !Array.isArray(indexKey)) {
            try {
                valueToKey(indexKey);
            } catch (e) {
                return;
            }
        } else {
            // remove any elements from index key that are not valid keys and remove any duplicate elements from index
            // key such that only one instance of the duplicate value remains.
            const keep = [];
            for (const part of indexKey) {
                if (keep.indexOf(part) < 0) {
                    try {
                        keep.push(valueToKey(part));
                    } catch (err) {
                        /* Do nothing */
                    }
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
                value: newRecord.key,
            });
        } else {
            for (const individualIndexKey of indexKey) {
                this.records.add({
                    key: individualIndexKey,
                    value: newRecord.key,
                });
            }
        }
    }

    public initialize(transaction: FDBTransaction) {
        if (this.initialized) {
            throw new Error("Index already initialized");
        }

        transaction._execRequestAsync({
            operation: () => {
                try {
                    // Create index based on current value of objectstore
                    for (const record of this.rawObjectStore.records.values()) {
                        this.storeRecord(record);
                    }

                    this.initialized = true;
                } catch (err) {
                    // console.error(err);
                    transaction._abort(err.name);
                }
            },
            source: null,
        });
    }
}

export default Index;
