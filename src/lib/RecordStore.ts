import FDBKeyRange from "../FDBKeyRange.js";
import cmp from "./cmp.js";
import BinarySearchTree from "./binarySearchTree.js";
import type { FDBCursorDirection, Key, Record } from "./types.js";

class RecordStore {
    private keysAreUnique: boolean;
    private records: BinarySearchTree;

    constructor(keysAreUnique: boolean) {
        this.keysAreUnique = keysAreUnique;
        this.records = new BinarySearchTree(this.keysAreUnique);
    }

    public get(key: Key | FDBKeyRange) {
        const range = key instanceof FDBKeyRange ? key : FDBKeyRange.only(key);
        return this.records.getRecords(range).next().value;
    }

    /**
     * Put a new record, and return the overwritten record if an overwrite occurred.
     * @param newRecord
     * @param noOverwrite - throw a ConstraintError in case of overwrite
     */
    public put(
        newRecord: Record,
        noOverwrite: boolean = false,
    ): Record | undefined {
        return this.records.put(newRecord, noOverwrite);
    }

    public delete(key: Key | FDBKeyRange) {
        const range = key instanceof FDBKeyRange ? key : FDBKeyRange.only(key);

        const deletedRecords = [...this.records.getRecords(range)];

        for (const record of deletedRecords) {
            this.records.delete(record);
        }

        return deletedRecords;
    }

    public deleteByValue(key: Key | FDBKeyRange) {
        const range = key instanceof FDBKeyRange ? key : FDBKeyRange.only(key);

        const deletedRecords: Record[] = [];
        for (const record of this.records.getAllRecords()) {
            if (range.includes(record.value)) {
                this.records.delete(record);
                deletedRecords.push(record);
            }
        }

        return deletedRecords;
    }

    public clear() {
        const deletedRecords = [...this.records.getAllRecords()];
        this.records = new BinarySearchTree(this.keysAreUnique);
        return deletedRecords;
    }

    public values(range?: FDBKeyRange, direction: FDBCursorDirection = "next") {
        const descending = direction === "prev" || direction === "prevunique";
        const records = range
            ? this.records.getRecords(range, descending)
            : this.records.getAllRecords(descending);

        return {
            [Symbol.iterator]: () => {
                const next = () => {
                    return records.next();
                };

                if (direction === "next" || direction === "prev") {
                    return { next };
                }

                // For nextunique/prevunique, return an iterator that skips seen values
                // Note that we must return the _lowest_ value regardless of direction:
                // > Iterating with "prevunique" visits the same records that "nextunique"
                // > visits, but in reverse order.
                // https://w3c.github.io/IndexedDB/#dom-idbcursordirection-prevunique
                if (direction === "nextunique") {
                    let previousValue: Record | undefined = undefined;
                    return {
                        next: (): IteratorResult<Record> => {
                            let current = next();
                            // for nextunique, continue if we already emitted the lowest unique value
                            while (
                                !current.done &&
                                previousValue !== undefined &&
                                cmp(previousValue.key, current.value.key) === 0
                            ) {
                                current = next();
                            }
                            previousValue = current.value;
                            return current;
                        },
                    };
                }

                // prevunique is a bit more complex due to needing to check the next value, which
                // invokes the iterable, so we need to keep a buffer of one "lookahead" result
                let current = next();
                let nextResult = next();

                return {
                    next: (): IteratorResult<Record> => {
                        while (
                            !nextResult.done &&
                            cmp(current.value.key, nextResult.value.key) === 0
                        ) {
                            // note we return the _lowest_ possible value, hence set the current
                            current = nextResult;
                            nextResult = next();
                        }
                        const result = current;
                        current = nextResult;
                        nextResult = next();
                        return result;
                    },
                };
            },
        };
    }

    public size(): number {
        return this.records.size();
    }
}

export default RecordStore;
