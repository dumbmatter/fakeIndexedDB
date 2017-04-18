const structuredClone = require('./lib/structuredClone');
const Index = require('./lib/Index');
const FDBCursor = require('./FDBCursor');
const FDBCursorWithValue = require('./FDBCursorWithValue');
const FDBIndex = require('./FDBIndex');
const FDBKeyRange = require('./FDBKeyRange');
const FDBRequest = require('./FDBRequest');
const {ConstraintError, DataError, InvalidAccessError, InvalidStateError, NotFoundError, ReadOnlyError, TransactionInactiveError} = require('./lib/errors');
const addDomStringListMethods = require('./lib/addDomStringListMethods');
const extractKey = require('./lib/extractKey');
const validateKey = require('./lib/validateKey');
const validateKeyPath = require('./lib/validateKeyPath');

const confirmActiveTransaction = (objectStore) => {
    if (objectStore._rawObjectStore.deleted) {
        throw new InvalidStateError();
    }

    if (!objectStore.transaction._active) {
        throw new TransactionInactiveError();
    }
};

const buildRecordAddPut = (objectStore, value, key) => {
    if (objectStore.transaction.mode === 'readonly') {
        throw new ReadOnlyError();
    }

    confirmActiveTransaction(objectStore);

    if (objectStore.keyPath !== null) {
        if (key !== undefined) {
            throw new DataError();
        }

        const tempKey = extractKey(objectStore.keyPath, value);

        if (tempKey !== undefined) {
            validateKey(tempKey);
        } else {
            if (!objectStore._rawObjectStore.keyGenerator) {
                throw new DataError();
            }
        }
    }

    if (objectStore.keyPath === null && objectStore._rawObjectStore.keyGenerator === null && key === undefined) {
        throw new DataError();
    }

    if (key !== undefined) {
        validateKey(key);
    }

    return {
        key: structuredClone(key),
        value: structuredClone(value)
    };
};

// http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#object-store
class FDBObjectStore {
    constructor(transaction, rawObjectStore) {
        this._rawObjectStore = rawObjectStore;
        this._rawIndexesCache = {}; // Store the FDBIndex objects

        this.name = rawObjectStore.name;
        this.keyPath = rawObjectStore.keyPath;
        this.autoIncrement = rawObjectStore.autoIncrement;
        this.transaction = transaction;
        this.indexNames = Object.keys(rawObjectStore.rawIndexes).sort();
        addDomStringListMethods(this.indexNames);
    }

    put(value, key) {
        const record = buildRecordAddPut(this, value, key);

        return this.transaction._execRequestAsync({
            source: this,
            operation: this._rawObjectStore.storeRecord.bind(this._rawObjectStore, record, false, this.transaction._rollbackLog)
        });
    }

    add(value, key) {
        const record = buildRecordAddPut(this, value, key);

        return this.transaction._execRequestAsync({
            source: this,
            operation: this._rawObjectStore.storeRecord.bind(this._rawObjectStore, record, true, this.transaction._rollbackLog)
        });
    }

    delete(key) {
        if (this.transaction.mode === 'readonly') {
            throw new ReadOnlyError();
        }
        confirmActiveTransaction(this);


        if (!(key instanceof FDBKeyRange)) {
            key = structuredClone(validateKey(key));
        }

        return this.transaction._execRequestAsync({
            source: this,
            operation: this._rawObjectStore.deleteRecord.bind(this._rawObjectStore, key, this.transaction._rollbackLog)
        });
    }

    get(key) {
        confirmActiveTransaction(this);

        if (!(key instanceof FDBKeyRange)) {
            key = structuredClone(validateKey(key));
        }

        return this.transaction._execRequestAsync({
            source: this,
            operation: this._rawObjectStore.getValue.bind(this._rawObjectStore, key)
        });
    }

    clear() {
        if (this.transaction.mode === 'readonly') {
            throw new ReadOnlyError();
        }
        confirmActiveTransaction(this);

        return this.transaction._execRequestAsync({
            source: this,
            operation: this._rawObjectStore.clear.bind(this._rawObjectStore, this.transaction._rollbackLog)
        });
    }

    openCursor(range, direction) {
        confirmActiveTransaction(this);

        if (range === null) { range = undefined; }
        if (range !== undefined && !(range instanceof FDBKeyRange)) {
            range = FDBKeyRange.only(structuredClone(validateKey(range)));
        }

        const request = new FDBRequest();
        request.source = this;
        request.transaction = this.transaction;

        const cursor = new FDBCursorWithValue(this, range, direction);
        cursor._request = request;

        return this.transaction._execRequestAsync({
            source: this,
            operation: cursor._iterate.bind(cursor),
            request: request
        });
    }

    // http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#widl-IDBObjectStore-createIndex-IDBIndex-DOMString-name-DOMString-sequence-DOMString--keyPath-IDBIndexParameters-optionalParameters
    createIndex(name, keyPath, optionalParameters) {
        if (keyPath === undefined) { throw new TypeError(); }

        optionalParameters = optionalParameters !== undefined ? optionalParameters : {};
        const multiEntry = optionalParameters.multiEntry !== undefined ? optionalParameters.multiEntry : false;
        const unique = optionalParameters.unique !== undefined ? optionalParameters.unique : false;

        if (this.transaction.mode !== 'versionchange') {
            throw new InvalidStateError();
        }

        confirmActiveTransaction(this);

        if (this.indexNames.indexOf(name) >= 0) {
            throw new ConstraintError();
        }

        validateKeyPath(keyPath);

        if (Array.isArray(keyPath) && multiEntry) {
            throw new InvalidAccessError();
        }

// The index that is requested to be created can contain constraints on the data allowed in the index's referenced object store, such as requiring uniqueness of the values referenced by the index's keyPath. If the referenced object store already contains data which violates these constraints, this MUST NOT cause the implementation of createIndex to throw an exception or affect what it returns. The implementation MUST still create and return an IDBIndex object. Instead the implementation must queue up an operation to abort the "versionchange" transaction which was used for the createIndex call.

        this.transaction._rollbackLog.push(function (indexNames) {
            this.indexNames = indexNames;
            addDomStringListMethods(this.indexNames);
            delete this._rawObjectStore.rawIndexes[name];
        }.bind(this, this.indexNames.slice()));

        const index = new Index(this._rawObjectStore, name, keyPath, multiEntry, unique);
        this.indexNames.push(name);
        this.indexNames.sort();
        this._rawObjectStore.rawIndexes[name] = index;

        index.initialize(this.transaction); // This is async by design

        return new FDBIndex(this, index);
    }

    index(name) {
        if (name === undefined) { throw new TypeError(); }

        if (this._rawIndexesCache.hasOwnProperty(name)) {
            return this._rawIndexesCache[name];
        }

        if (this.indexNames.indexOf(name) < 0) {
            throw new NotFoundError();
        }

        if (this._rawObjectStore.deleted) {
            throw new InvalidStateError();
        }

        const index = new FDBIndex(this, this._rawObjectStore.rawIndexes[name]);
        this._rawIndexesCache[name] = index;

        return index;
    }

    deleteIndex(name) {
        if (name === undefined) { throw new TypeError(); }

        if (this.transaction.mode !== 'versionchange') {
            throw new InvalidStateError();
        }

        confirmActiveTransaction(this);

        if (!this._rawObjectStore.rawIndexes.hasOwnProperty(name)) {
            throw new NotFoundError();
        }

        this.transaction._rollbackLog.push(function (index) {
            index.deleted = false;
            this._rawObjectStore.rawIndexes[name] = index;
            this.indexNames.push(name);
            this.indexNames.sort();
        }.bind(this, this._rawObjectStore.rawIndexes[name]));

        this.indexNames = this.indexNames.filter((indexName) => {
            return indexName !== name;
        });
        addDomStringListMethods(this.indexNames);
        this._rawObjectStore.rawIndexes[name].deleted = true; // Not sure if this is supposed to happen synchronously

        this.transaction._execRequestAsync({
            source: this,
            operation: () => {
                delete this._rawObjectStore.rawIndexes[name];
            },
        });
    }

    // http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#widl-IDBObjectStore-count-IDBRequest-any-key
    count(key) {
        confirmActiveTransaction(this);

        if (key === null) { key = undefined; }
        if (key !== undefined && !(key instanceof FDBKeyRange)) {
            key = FDBKeyRange.only(structuredClone(validateKey(key)));
        }

        return this.transaction._execRequestAsync({
            source: this,
            operation: () => {
                let count = 0;

                const cursor = new FDBCursor(this, key);
                while (cursor._iterate() !== null) {
                    count += 1;
                }

                return count;
            },
        });
    }

    toString() {
        return '[object IDBObjectStore]';
    }
}

module.exports = FDBObjectStore;
