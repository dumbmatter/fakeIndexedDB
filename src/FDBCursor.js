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

// This takes a key range, a list of lower bounds, and a list of upper bounds and combines them all into a single key
// range. It does not handle gt/gte distinctions, because it doesn't really matter much anyway, since for next/prev
// cursor iteration it'd also have to look at values to be precise, which would be complicated. This should get us 99%
// of the way there.
const makeKeyRange = (range, lowers, uppers) => {
    // Start with bounds from range
    let lower = range !== undefined ? range.lower : undefined;
    let upper = range !== undefined ? range.upper : undefined;

    // Augment with values from lowers and uppers
    for (const lowerTemp of lowers) {
        if (lowerTemp === undefined) {
            continue;
        }

        if (lower === undefined || cmp(lower, lowerTemp) === 1) {
            lower = lowerTemp;
        }
    }
    for (const upperTemp of uppers) {
        if (upperTemp === undefined) {
            continue;
        }

        if (upper === undefined || cmp(upper, upperTemp) === -1) {
            upper = upperTemp;
        }
    }

    if (lower !== undefined && upper !== undefined) {
        return FDBKeyRange.bound(lower, upper);
    }
    if (lower !== undefined) {
        return FDBKeyRange.lowerBound(lower);
    }
    if (upper !== undefined) {
        return FDBKeyRange.upperBound(upper);
    }
}

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
            const range = makeKeyRange(this._range, [key, this._position], []);
            for (const record of records.values(range)) {
                if (key !== undefined) {
                    if (cmp(record.key, key) === -1) {
                        continue;
                    }
                }
                if (this._position !== undefined && sourceIsObjectStore) {
                    if (cmp(record.key, this._position) !== 1) {
                        continue;
                    }
                }
                if (this._position !== undefined && !sourceIsObjectStore) {
                    const cmpResult = cmp(record.key, this._position);
                    if (cmpResult === -1) {
                        continue;
                    }
                    if (cmpResult === 0 && cmp(record.value, this._objectStorePosition) !== 1) {
                        continue;
                    }
                }
                if (this._range !== undefined) {
                    if (!FDBKeyRange.check(this._range, record.key)) {
                        continue;
                    }
                }
                foundRecord = record;
                break;
            }
        } else if (this.direction === "nextunique") {
            // This could be done without iterating, if the range was defined slightly better (to handle gt/gte cases).
            // But the performance difference should be small, and that wouldn't work anyway for directions where the
            // value needs to be used (like next and prev).
            const range = makeKeyRange(this._range, [key, this._position], []);
            for (const record of records.values(range)) {
                if (key !== undefined) {
                    if (cmp(record.key, key) === -1) {
                        continue;
                    }
                }
                if (this._position !== undefined) {
                    if (cmp(record.key, this._position) !== 1) {
                        continue;
                    }
                }
                if (this._range !== undefined) {
                    if (!FDBKeyRange.check(this._range, record.key)) {
                        continue;
                    }
                }
                foundRecord = record;
                break;
            }
        } else if (this.direction === "prev") {
            const range = makeKeyRange(this._range, [], [key, this._position]);
            for (const record of records.values(range, 'prev')) {
                if (key !== undefined) {
                    if (cmp(record.key, key) === 1) {
                        continue;
                    }
                }
                if (this._position !== undefined && sourceIsObjectStore) {
                    if (cmp(record.key, this._position) !== -1) {
                        continue;
                    }
                }
                if (this._position !== undefined && !sourceIsObjectStore) {
                    const cmpResult = cmp(record.key, this._position);
                    if (cmpResult === 1) {
                        continue;
                    }
                    if (cmpResult === 0 && cmp(record.value, this._objectStorePosition) !== -1) {
                        continue;
                    }
                }
                if (this._range !== undefined) {
                    if (!FDBKeyRange.check(this._range, record.key)) {
                        continue;
                    }
                }
                foundRecord = record;
                break;
            }
        } else if (this.direction === "prevunique") {
            let tempRecord;
            const range = makeKeyRange(this._range, [], [key, this._position]);
            for (const record of records.values(range, 'prev')) {
                if (key !== undefined) {
                    if (cmp(record.key, key) === 1) {
                        continue;
                    }
                }
                if (this._position !== undefined) {
                    if (cmp(record.key, this._position) !== -1) {
                        continue;
                    }
                }
                if (this._range !== undefined) {
                    if (!FDBKeyRange.check(this._range, record.key)) {
                        continue;
                    }
                }
                tempRecord = record;
                break;
            }

            if (tempRecord) {
                foundRecord = records.get(tempRecord.key);
            }
        }

        let result;
        if (!foundRecord) {
            this._key = undefined;
            if (!sourceIsObjectStore) { this._objectStorePosition = undefined; }
            if (this.constructor.name === 'FDBCursorWithValue') {
                this.value = undefined;
            }
            result = null;
        } else {
            this._position = foundRecord.key;
            if (!sourceIsObjectStore) { this._objectStorePosition = foundRecord.value; }
            this._key = foundRecord.key;
            if (sourceIsObjectStore) {
                this._primaryKey = structuredClone(foundRecord.key);
                if (this.constructor.name === 'FDBCursorWithValue') {
                    this.value = structuredClone(foundRecord.value);
                }
            } else {
                this._primaryKey = structuredClone(foundRecord.value);
                if (this.constructor.name === 'FDBCursorWithValue') {
                    this.value = structuredClone(this.source.objectStore._rawObjectStore.getValue(foundRecord.value));
                }
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
