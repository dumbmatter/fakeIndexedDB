import FDBKeyRange from "../FDBKeyRange";
import Database from "./Database";
import { ConstraintError, DataError } from "./errors";
import extractKey from "./extractKey";
import Index from "./Index";
import KeyGenerator from "./KeyGenerator";
import RecordStore from "./RecordStore";
import structuredClone from "./structuredClone";
import { Key, KeyPath, Record, RollbackLog } from "./types";

// http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#dfn-object-store
class ObjectStore {
    public deleted = false;
    public readonly rawDatabase: Database;
    public readonly records = new RecordStore();
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
    public getAllKeys(range: FDBKeyRange, count?: number) {
        if (count === undefined || count === 0) {
            count = Infinity;
        }

        const records = [];
        for (const record of this.records.values(range)) {
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
    public getAllValues(range: FDBKeyRange, count?: number) {
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

    // http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#dfn-steps-for-storing-a-record-into-an-object-store
    public storeRecord(
        newRecord: Record,
        noOverwrite: boolean,
        rollbackLog?: RollbackLog,
    ) {
        if (this.keyPath !== null) {
            const key = extractKey(this.keyPath, newRecord.value);
            if (key !== undefined) {
                newRecord.key = key;
            }
        }

        if (this.keyGenerator !== null && newRecord.key === undefined) {
            if (rollbackLog) {
                const keyGeneratorBefore = this.keyGenerator.num;
                rollbackLog.push(() => {
                    if (this.keyGenerator) {
                        this.keyGenerator.num = keyGeneratorBefore;
                    }
                });
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

                        if (!object.hasOwnProperty(identifier)) {
                            object[identifier] = {};
                        }

                        object = object[identifier];
                    }
                }

                identifier = remainingKeyPath;

                object[identifier] = newRecord.key;
            }
        } else if (
            this.keyGenerator !== null &&
            typeof newRecord.key === "number"
        ) {
            this.keyGenerator.setIfLarger(newRecord.key);
        }

        const existingRecord = this.records.get(newRecord.key);
        if (existingRecord) {
            if (noOverwrite) {
                throw new ConstraintError();
            }
            this.deleteRecord(newRecord.key, rollbackLog);
        }

        this.records.add(newRecord);

        if (rollbackLog) {
            rollbackLog.push(() => {
                this.deleteRecord(newRecord.key);
            });
        }

        // Update indexes
        for (const rawIndex of this.rawIndexes.values()) {
            if (rawIndex.initialized) {
                rawIndex.storeRecord(newRecord);
            }
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
}

export default ObjectStore;
