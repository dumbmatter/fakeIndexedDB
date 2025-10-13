import FDBRecord from "../FDBRecord.js";
import { DataError } from "./errors.js";
import extractKey from "./extractKey.js";
import KeyGenerator from "./KeyGenerator.js";
import RecordStore from "./RecordStore.js";
import type Index from "./Index.js";
import type Database from "./Database.js";
import type FDBKeyRange from "../FDBKeyRange.js";
import type { Key, KeyPath, Record, RollbackLog } from "./types.js";

// http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#dfn-object-store
class ObjectStore {
    public deleted = false;
    public readonly rawDatabase: Database;
    public readonly records = new RecordStore(true);
    public readonly rawIndexes: Map<string, Index> = new Map();
    public name: string;
    public readonly keyPath: KeyPath | null;
    public readonly autoIncrement: boolean;
    public readonly keyGenerator: KeyGenerator | null;

    constructor(
        rawDatabase: Database,
        name: string,
        keyPath: KeyPath | null,
        autoIncrement: boolean,
    ) {
        this.rawDatabase = rawDatabase;
        this.keyGenerator = autoIncrement === true ? new KeyGenerator() : null;
        this.deleted = false;

        this.name = name;
        this.keyPath = keyPath;
        this.autoIncrement = autoIncrement;
    }

    // http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#dfn-steps-for-retrieving-a-value-from-an-object-store
    public getKey(key: FDBKeyRange | Key) {
        const record = this.records.get(key);

        return record !== undefined ? structuredClone(record.key) : undefined;
    }

    // http://w3c.github.io/IndexedDB/#retrieve-multiple-keys-from-an-object-store
    public getAllKeys(
        range: FDBKeyRange,
        count?: number,
        direction?: "next" | "prev",
    ) {
        if (count === undefined || count === 0) {
            count = Infinity;
        }

        const records = [];
        for (const record of this.records.values(range, direction)) {
            records.push(structuredClone(record.key));
            if (records.length >= count) {
                break;
            }
        }

        return records;
    }

    // http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#dfn-steps-for-retrieving-a-value-from-an-object-store
    public getValue(key: FDBKeyRange | Key) {
        const record = this.records.get(key);

        return record !== undefined ? structuredClone(record.value) : undefined;
    }

    // http://w3c.github.io/IndexedDB/#retrieve-multiple-values-from-an-object-store
    public getAllValues(
        range: FDBKeyRange,
        count?: number,
        direction?: "next" | "prev",
    ) {
        if (count === undefined || count === 0) {
            count = Infinity;
        }

        const records = [];
        for (const record of this.records.values(range, direction)) {
            records.push(structuredClone(record.value));
            if (records.length >= count) {
                break;
            }
        }

        return records;
    }

    // https://www.w3.org/TR/IndexedDB/#dom-idbobjectstore-getallrecords
    public getAllRecords(
        range: FDBKeyRange,
        count?: number,
        direction?: "next" | "prev",
    ) {
        if (count === undefined || count === 0) {
            count = Infinity;
        }

        const records = [];
        for (const record of this.records.values(range, direction)) {
            records.push(
                new FDBRecord(
                    structuredClone(record.key),
                    structuredClone(record.key),
                    structuredClone(record.value),
                ),
            );
            if (records.length >= count) {
                break;
            }
        }

        return records;
    }

    // http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#dfn-steps-for-storing-a-record-into-an-object-store
    public storeRecord(
        newRecord: Record,
        noOverwrite: boolean,
        rollbackLog?: RollbackLog,
    ) {
        if (this.keyPath !== null) {
            const key = extractKey(this.keyPath, newRecord.value).key;
            if (key !== undefined) {
                newRecord.key = key;
            }
        }

        let rollbackKeyGenerator;
        if (this.keyGenerator !== null && newRecord.key === undefined) {
            let rolledBack = false;
            const keyGeneratorBefore = this.keyGenerator.num;
            rollbackKeyGenerator = () => {
                if (rolledBack) {
                    return;
                }
                rolledBack = true;
                if (this.keyGenerator) {
                    this.keyGenerator.num = keyGeneratorBefore;
                }
            };
            if (rollbackLog) {
                rollbackLog.push(rollbackKeyGenerator);
            }

            newRecord.key = this.keyGenerator.next();

            // Set in value if keyPath defiend but led to no key
            // http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#dfn-steps-to-assign-a-key-to-a-value-using-a-key-path
            if (this.keyPath !== null) {
                if (Array.isArray(this.keyPath)) {
                    throw new Error(
                        "Cannot have an array key path in an object store with a key generator",
                    );
                }
                let remainingKeyPath = this.keyPath;
                let object = newRecord.value;
                let identifier;

                let i = 0; // Just to run the loop at least once
                while (i >= 0) {
                    if (typeof object !== "object") {
                        throw new DataError();
                    }

                    i = remainingKeyPath.indexOf(".");
                    if (i >= 0) {
                        identifier = remainingKeyPath.slice(0, i);
                        remainingKeyPath = remainingKeyPath.slice(i + 1);

                        if (!Object.hasOwn(object, identifier)) {
                            // Bypass prototype when setting (See `bindings-inject-values-bypass.any.js`)
                            // Equivalent to `object[identifier] = ...` without using `Object.prototype`
                            Object.defineProperty(object, identifier, {
                                configurable: true,
                                enumerable: true,
                                writable: true,
                                value: {},
                            });
                        }

                        object = object[identifier];
                    }
                }

                identifier = remainingKeyPath;

                // Bypass prototype when setting (See `bindings-inject-values-bypass.any.js`)
                // Equivalent to `object[identifier] = ...` without using `Object.prototype`
                Object.defineProperty(object, identifier, {
                    configurable: true,
                    enumerable: true,
                    writable: true,
                    value: newRecord.key,
                });
            }
        } else if (
            this.keyGenerator !== null &&
            typeof newRecord.key === "number"
        ) {
            this.keyGenerator.setIfLarger(newRecord.key);
        }

        const existingRecord = this.records.put(newRecord, noOverwrite);

        let rolledBack = false;
        const rollbackStoreRecord = () => {
            if (rolledBack) {
                return;
            }
            rolledBack = true;
            if (existingRecord) {
                // overwrite on rollback
                this.storeRecord(existingRecord, false);
            } else {
                // delete on rollback
                this.deleteRecord(newRecord.key);
            }
        };

        if (rollbackLog) {
            rollbackLog.push(rollbackStoreRecord);
        }

        // Delete existing indexes
        if (existingRecord) {
            for (const rawIndex of this.rawIndexes.values()) {
                rawIndex.records.deleteByValue(newRecord.key);
            }
        }

        // Update indexes
        try {
            for (const rawIndex of this.rawIndexes.values()) {
                if (rawIndex.initialized) {
                    rawIndex.storeRecord(newRecord);
                }
            }
        } catch (err) {
            // If this request fails here and preventDefault is used to stop the transaction from aborting, we need to roll back the addition of this record to the store, otherwise it will be present in subsequent requests on this transaction.
            if (err.name === "ConstraintError") {
                rollbackStoreRecord();
                if (rollbackKeyGenerator) {
                    rollbackKeyGenerator();
                }
            }

            throw err;
        }

        return newRecord.key;
    }

    // http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#dfn-steps-for-deleting-records-from-an-object-store
    public deleteRecord(key: Key, rollbackLog?: RollbackLog) {
        const deletedRecords = this.records.delete(key);

        if (rollbackLog) {
            for (const record of deletedRecords) {
                rollbackLog.push(() => {
                    this.storeRecord(record, true);
                });
            }
        }

        for (const rawIndex of this.rawIndexes.values()) {
            rawIndex.records.deleteByValue(key);
        }
    }

    // http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#dfn-steps-for-clearing-an-object-store
    public clear(rollbackLog: RollbackLog) {
        const deletedRecords = this.records.clear();

        if (rollbackLog) {
            for (const record of deletedRecords) {
                rollbackLog.push(() => {
                    this.storeRecord(record, true);
                });
            }
        }

        for (const rawIndex of this.rawIndexes.values()) {
            rawIndex.records.clear();
        }
    }

    public count(range: FDBKeyRange | undefined) {
        // optimization: if there is no range, or if the range is everything, then we can just count the total size
        if (
            range === undefined ||
            (range.lower === undefined && range.upper === undefined)
        ) {
            return this.records.size();
        }

        let count = 0;

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for (const record of this.records.values(range)) {
            count += 1;
        }

        return count;
    }
}

export default ObjectStore;
