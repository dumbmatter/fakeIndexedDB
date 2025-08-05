import FDBKeyRange from "../FDBKeyRange.js";
import {
    getByKey,
    getByKeyRange,
    getIndexByKey,
    getIndexByKeyGTE,
    getIndexByKeyRange,
} from "./binarySearch.js";
import cmp from "./cmp.js";
import { FDBCursorDirection, Key, Record } from "./types.js";

class RecordStore {
    private records: Record[] = [];

    public get(key: Key | FDBKeyRange) {
        if (key instanceof FDBKeyRange) {
            return getByKeyRange(this.records, key);
        }

        return getByKey(this.records, key);
    }

    public add(newRecord: Record) {
        // Find where to put it so it's sorted by key
        let i;
        if (this.records.length === 0) {
            i = 0;
        } else {
            i = getIndexByKeyGTE(this.records, newRecord.key);

            if (i === -1) {
                // If no matching key, add to end
                i = this.records.length;
            } else {
                // If matching key, advance to appropriate position based on value (used in indexes)
                while (
                    i < this.records.length &&
                    cmp(this.records[i].key, newRecord.key) === 0
                ) {
                    if (cmp(this.records[i].value, newRecord.value) !== -1) {
                        // Record value >= newRecord value, so insert here
                        break;
                    }

                    i += 1; // Look at next record
                }
            }
        }

        this.records.splice(i, 0, newRecord);
    }

    public delete(key: Key) {
        const deletedRecords: Record[] = [];

        const isRange = key instanceof FDBKeyRange;
        while (true) {
            const idx = isRange
                ? getIndexByKeyRange(this.records, key)
                : getIndexByKey(this.records, key);
            if (idx === -1) {
                break;
            }
            deletedRecords.push(this.records[idx]);
            this.records.splice(idx, 1);
        }
        return deletedRecords;
    }

    public deleteByValue(key: Key) {
        const range = key instanceof FDBKeyRange ? key : FDBKeyRange.only(key);

        const deletedRecords: Record[] = [];

        this.records = this.records.filter((record) => {
            const shouldDelete = range.includes(record.value);

            if (shouldDelete) {
                deletedRecords.push(record);
            }

            return !shouldDelete;
        });

        return deletedRecords;
    }

    public clear() {
        const deletedRecords = this.records.slice();
        this.records = [];
        return deletedRecords;
    }

    public values(range?: FDBKeyRange, direction: FDBCursorDirection = "next") {
        return {
            [Symbol.iterator]: () => {
                let i: number;
                if (direction === "next" || direction === "nextunique") {
                    i = 0;
                    if (range !== undefined && range.lower !== undefined) {
                        while (this.records[i] !== undefined) {
                            const cmpResult = cmp(
                                this.records[i].key,
                                range.lower,
                            );
                            if (
                                cmpResult === 1 ||
                                (cmpResult === 0 && !range.lowerOpen)
                            ) {
                                break;
                            }
                            i += 1;
                        }
                    }
                } else {
                    i = this.records.length - 1;
                    if (range !== undefined && range.upper !== undefined) {
                        while (this.records[i] !== undefined) {
                            const cmpResult = cmp(
                                this.records[i].key,
                                range.upper,
                            );
                            if (
                                cmpResult === -1 ||
                                (cmpResult === 0 && !range.upperOpen)
                            ) {
                                break;
                            }
                            i -= 1;
                        }
                    }
                }

                const next = () => {
                    let done;
                    let value;
                    if (direction === "next" || direction === "nextunique") {
                        value = this.records[i];
                        done = i >= this.records.length;
                        i += 1;

                        if (
                            !done &&
                            range !== undefined &&
                            range.upper !== undefined
                        ) {
                            const cmpResult = cmp(value.key, range.upper);
                            done =
                                cmpResult === 1 ||
                                (cmpResult === 0 && range.upperOpen);
                            if (done) {
                                value = undefined;
                            }
                        }
                    } else {
                        value = this.records[i];
                        done = i < 0;
                        i -= 1;

                        if (
                            !done &&
                            range !== undefined &&
                            range.lower !== undefined
                        ) {
                            const cmpResult = cmp(value.key, range.lower);
                            done =
                                cmpResult === -1 ||
                                (cmpResult === 0 && range.lowerOpen);
                            if (done) {
                                value = undefined;
                            }
                        }
                    }

                    // The weird "as IteratorResult<Record>" is needed because of
                    // https://github.com/Microsoft/TypeScript/issues/11375 and
                    // https://github.com/Microsoft/TypeScript/issues/2983
                    return {
                        done,
                        value,
                    } as IteratorResult<Record>;
                };

                if (direction === "next" || direction === "prev") {
                    return { next };
                }

                // For nextunique/prevunique, return an iterator that skips seen values
                let prevValue: Record | undefined = undefined;
                return {
                    next: () => {
                        let done: boolean | undefined = false;
                        while (!done) {
                            const current = next();
                            const { value } = current;
                            done = current.done;

                            if (
                                prevValue !== undefined &&
                                value !== undefined &&
                                cmp(prevValue.key, value.key) === 0
                            ) {
                                if (done) {
                                    break;
                                }
                            } else {
                                prevValue = value;
                                return {
                                    value,
                                    done,
                                } as IteratorResult<Record>;
                            }
                        }
                        return {
                            value: undefined,
                            done,
                        } as IteratorResult<Record>;
                    },
                };
            },
        };
    }
}

export default RecordStore;
