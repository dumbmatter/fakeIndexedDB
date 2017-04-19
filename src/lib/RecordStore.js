const FDBKeyRange = require('../FDBKeyRange');
const cmp = require('./cmp');

class RecordStore {
    constructor() {
        this._records = [];
    }

    get(key) {
        if (key instanceof FDBKeyRange) {
            return this._records.find((record) => {
                return FDBKeyRange.check(key, record.key);
            });
        }

        return this._records.find((record) => {
            return cmp(record.key, key) === 0;
        });
    }

    add(newRecord) {
        // Find where to put it so it's sorted by key
        let i;
        if (this._records.length === 0) {
            i = 0;
        } else {
            i = this._records.findIndex((record) => {
                return cmp(record.key, newRecord.key) === 1;
            });

            if (i === -1) {
                // If no matching key, add to end
                i = this._records.length;
            } else {
                // If matching key, advance to appropriate position based on value (used in indexes)
                while (i < this._records.length && cmp(this._records[i].key, newRecord.key) === 0) {
                    if (cmp(this._records[i].value, newRecord.value) !== -1) {
                        // Record value >= newRecord value, so insert here
                        break;
                    }

                    i += 1; // Look at next record
                }
            }
        }

        this._records.splice(i, 0, newRecord);
    }

    delete(key) {
        const range = key instanceof FDBKeyRange ? key : FDBKeyRange.only(key);

        const deletedRecords = [];

        this._records = this._records.filter((record) => {
            const shouldDelete = FDBKeyRange.check(range, record.key);

            if (shouldDelete) {
                deletedRecords.push(record);
            }

            return !shouldDelete;
        });

        return deletedRecords;
    }

    deleteByValue(key) {
        const range = key instanceof FDBKeyRange ? key : FDBKeyRange.only(key);

        const deletedRecords = [];

        this._records = this._records.filter((record) => {
            const shouldDelete = FDBKeyRange.check(range, record.value);

            if (shouldDelete) {
                deletedRecords.push(record);
            }

            return !shouldDelete;
        });

        return deletedRecords;
    }

    clear() {
        const deletedRecords = this._records.slice();
        this._records = [];
        return deletedRecords;
    }

    values(direction = 'next') {
        return {
            [Symbol.iterator]: () => {
                let i = direction === 'next' ? -1 : this._records.length;

                return {
                    next: () => {
                        let done;
                        if (direction === 'next') {
                            i += 1;
                            done = i >= this._records.length;
                        } else {
                            i -= 1;
                            done = i < 0;
                        }

                        return {
                            value: this._records[i],
                            done,
                        }
                    },
                };
            },
        };
    }
}

module.exports = RecordStore;
