const structuredClone = require('./lib/structuredClone');
const FDBKeyRange = require('./FDBKeyRange');
const {DataError, InvalidStateError, ReadOnlyError, TransactionInactiveError} = require('./lib/errors');
const cmp = require('./lib/cmp');
const extractKey = require('./lib/extractKey');
const validateKey = require('./lib/validateKey');

const getEffectiveObjectStore = (cursor) => {
    if (cursor.source.hasOwnProperty('_rawIndex')) {
        return cursor.source.objectStore;
    }
    return cursor.source;
};

// http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#cursor
class FDBCursor {
    constructor(source, range, direction = 'next', request) {
        this._gotValue = false;
        this._range = range;
        this._position = undefined; // Key of previously returned record
        this._objectStorePosition = undefined;
        this._request = request;

        this._source = source;
        this._direction = direction;
        this._key = undefined;
        this._primaryKey = undefined;
    }

    // Read only properties
    get source() {
        return this._source;
    }
    get direction() {
        return this._direction;
    }
    get key() {
        return this._key;
    }
    get primaryKey() {
        return this._primaryKey;
    }

    // http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#dfn-steps-for-iterating-a-cursor
    _iterate(key) {
        const sourceIsObjectStore = !this.source.hasOwnProperty('_rawIndex');

        const records = sourceIsObjectStore ? this.source._rawObjectStore.records : this.source._rawIndex.records;

        let foundRecord;
        if (this.direction === "next") {
            foundRecord = records.find((record) => {
                if (key !== undefined) {
                    if (cmp(record.key, key) === -1) {
                        return false;
                    }
                }
                if (this._position !== undefined && sourceIsObjectStore) {
                    if (cmp(record.key, this._position) !== 1) {
                        return false;
                    }
                }
                if (this._position !== undefined && !sourceIsObjectStore) {
                    const cmpResult = cmp(record.key, this._position);
                    if (cmpResult === -1) {
                        return false;
                    }
                    if (cmpResult === 0 && cmp(record.value, this._objectStorePosition) !== 1) {
                        return false;
                    }
                }
                if (this._range !== undefined) {
                    if (!FDBKeyRange.check(this._range, record.key)) {
                        return false;
                    }
                }
                return true;
            });
        } else if (this.direction === "nextunique") {
            foundRecord = records.find((record) => {
                if (key !== undefined) {
                    if (cmp(record.key, key) === -1) {
                        return false;
                    }
                }
                if (this._position !== undefined) {
                    if (cmp(record.key, this._position) !== 1) {
                        return false;
                    }
                }
                if (this._range !== undefined) {
                    if (!FDBKeyRange.check(this._range, record.key)) {
                        return false;
                    }
                }
                return true;
            });
        } else if (this.direction === "prev") {
            foundRecord = records.reverse().find((record) => {
                if (key !== undefined) {
                    if (cmp(record.key, key) === 1) {
                        return false;
                    }
                }
                if (this._position !== undefined && sourceIsObjectStore) {
                    if (cmp(record.key, this._position) !== -1) {
                        return false;
                    }
                }
                if (this._position !== undefined && !sourceIsObjectStore) {
                    const cmpResult = cmp(record.key, this._position);
                    if (cmpResult === 1) {
                        return false;
                    }
                    if (cmpResult === 0 && cmp(record.value, this._objectStorePosition) !== -1) {
                        return false;
                    }
                }
                if (this._range !== undefined) {
                    if (!FDBKeyRange.check(this._range, record.key)) {
                        return false;
                    }
                }
                return true;
            });
            records.reverse();
        } else if (this.direction === "prevunique") {
            const tempRecord = records.reverse().find((record) => {
                if (key !== undefined) {
                    if (cmp(record.key, key) === 1) {
                        return false;
                    }
                }
                if (this._position !== undefined) {
                    if (cmp(record.key, this._position) !== -1) {
                        return false;
                    }
                }
                if (this._range !== undefined) {
                    if (!FDBKeyRange.check(this._range, record.key)) {
                        return false;
                    }
                }
                return true;
            });
            records.reverse();


            if (tempRecord) {
                foundRecord = records.find((record) => {
                    return cmp(record.key, tempRecord.key) === 0;
                });
            }
        }

        let result;
        if (!foundRecord) {
            this._key = undefined;
            if (!sourceIsObjectStore) { this._objectStorePosition = undefined; }
            this.value = undefined;
            result = null;
        } else {
            this._position = foundRecord.key;
            if (!sourceIsObjectStore) { this._objectStorePosition = foundRecord.value; }
            this._key = foundRecord.key;
            if (sourceIsObjectStore) {
                this.value = structuredClone(foundRecord.value);
            } else {
                this.value = structuredClone(this.source.objectStore._rawObjectStore.getValue(foundRecord.value));
                this._primaryKey = structuredClone(foundRecord.value);
            }
            this._gotValue = true;
            result = this;
        }

        return result;
    }

    // http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#widl-IDBCursor-update-IDBRequest-any-value
    update(value) {
        if (value === undefined) { throw new TypeError(); }

        const effectiveObjectStore = getEffectiveObjectStore(this);
        const effectiveKey = this.source.hasOwnProperty('_rawIndex') ? this.primaryKey : this._position;
        const transaction = effectiveObjectStore.transaction;

        if (transaction.mode === 'readonly') {
            throw new ReadOnlyError();
        }

        if (!transaction._active) {
            throw new TransactionInactiveError();
        }

        if (effectiveObjectStore._rawObjectStore.deleted) {
            throw new InvalidStateError();
        }

        if (!this._gotValue || !this.hasOwnProperty('value')) {
            throw new InvalidStateError();
        }

        if (effectiveObjectStore.keyPath !== null) {
            let tempKey;

            try {
                tempKey = extractKey(effectiveObjectStore.keyPath, value);
            } catch (err) { /* Handled immediately below */ }

            if (tempKey !== effectiveKey) {
                throw new DataError();
            }
        }

        const record = {
            key: effectiveKey,
            value: structuredClone(value)
        };

        return transaction._execRequestAsync({
            source: this,
            operation: effectiveObjectStore._rawObjectStore.storeRecord.bind(effectiveObjectStore._rawObjectStore, record, false, transaction._rollbackLog)
        });
    }

    // http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#widl-IDBCursor-advance-void-unsigned-long-count
    advance(count) {
        if (!Number.isInteger(count) || count <= 0) { throw new TypeError(); }

        const effectiveObjectStore = getEffectiveObjectStore(this);
        const transaction = effectiveObjectStore.transaction;

        if (!transaction._active) {
            throw new TransactionInactiveError();
        }

        if (effectiveObjectStore._rawObjectStore.deleted) {
            throw new InvalidStateError();
        }

        if (!this._gotValue) {
            throw new InvalidStateError();
        }

        this._request.readyState = 'pending';
        transaction._execRequestAsync({
            source: this.source,
            operation: () => {
                let result;
                for (let i = 0; i < count; i++) {
                    result = this._iterate();

                    // Not sure why this is needed
                    if (!result) {
                        break;
                    }
                }
                return result;
            },
            request: this._request
        });

        this._gotValue = false;
    }

    // http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#widl-IDBCursor-continue-void-any-key
    continue(key) {
        const effectiveObjectStore = getEffectiveObjectStore(this);
        const transaction = effectiveObjectStore.transaction;

        if (!transaction._active) {
            throw new TransactionInactiveError();
        }

        if (effectiveObjectStore._rawObjectStore.deleted) {
            throw new InvalidStateError();
        }

        if (!this._gotValue) {
            throw new InvalidStateError();
        }

        if (key !== undefined) {
            validateKey(key);

            const cmpResult = cmp(key, this._position);

            if ((cmpResult <= 0 && (this.direction === 'next' || this.direction === 'nextunique')) ||
                (cmpResult >= 0 && (this.direction === 'prev' || this.direction === 'prevunique'))) {
                throw new DataError();
            }
        }

        this._request.readyState = 'pending';
        transaction._execRequestAsync({
            source: this.source,
            operation: this._iterate.bind(this, key),
            request: this._request
        });

        this._gotValue = false;
    }

    delete() {
        const effectiveObjectStore = getEffectiveObjectStore(this);
        const effectiveKey = this.source.hasOwnProperty('_rawIndex') ? this.primaryKey : this._position;
        const transaction = effectiveObjectStore.transaction;

        if (transaction.mode === 'readonly') {
            throw new ReadOnlyError();
        }

        if (!transaction._active) {
            throw new TransactionInactiveError();
        }

        if (effectiveObjectStore._rawObjectStore.deleted) {
            throw new InvalidStateError();
        }

        if (!this._gotValue || !this.hasOwnProperty('value')) {
            throw new InvalidStateError();
        }

        return transaction._execRequestAsync({
            source: this,
            operation: effectiveObjectStore._rawObjectStore.deleteRecord.bind(effectiveObjectStore._rawObjectStore, effectiveKey, transaction._rollbackLog)
        });
    }

    toString() {
        return '[object IDBCursor]';
    }
}

module.exports = FDBCursor;
