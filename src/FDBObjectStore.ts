import FDBCursor from "./FDBCursor";
import FDBCursorWithValue from "./FDBCursorWithValue";
import FDBIndex from "./FDBIndex";
import FDBKeyRange from "./FDBKeyRange";
import FDBRequest from "./FDBRequest";
import FDBTransaction from "./FDBTransaction";
import {
    ConstraintError,
    DataError,
    InvalidAccessError,
    InvalidStateError,
    NotFoundError,
    ReadOnlyError,
    TransactionInactiveError,
} from "./lib/errors";
import extractKey from "./lib/extractKey";
import fakeDOMStringList from "./lib/fakeDOMStringList";
import Index from "./lib/Index";
import ObjectStore from "./lib/ObjectStore";
import structuredClone from "./lib/structuredClone";
import {FakeDOMStringList, FDBCursorDirection, Key, KeyPath, Value} from "./lib/types";
import validateKey from "./lib/validateKey";
import validateKeyPath from "./lib/validateKeyPath";

const confirmActiveTransaction = (objectStore: FDBObjectStore) => {
    if (objectStore._rawObjectStore.deleted) {
        throw new InvalidStateError();
    }

    if (!objectStore.transaction._active) {
        throw new TransactionInactiveError();
    }
};

const buildRecordAddPut = (objectStore: FDBObjectStore, value: Value, key: Key) => {
    if (objectStore.transaction.mode === "readonly") {
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
        value: structuredClone(value),
    };
};

// http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#object-store
class FDBObjectStore {
    public _rawObjectStore: ObjectStore;

    public name: string;
    public keyPath: KeyPath | null;
    public autoIncrement: boolean;
    public transaction: FDBTransaction;
    public indexNames: FakeDOMStringList;

    private _rawIndexesCache: Map<string, FDBIndex> = new Map();

    constructor(transaction: FDBTransaction, rawObjectStore: ObjectStore) {
        this._rawObjectStore = rawObjectStore;

        this.name = rawObjectStore.name;
        this.keyPath = rawObjectStore.keyPath;
        this.autoIncrement = rawObjectStore.autoIncrement;
        this.transaction = transaction;
        this.indexNames = fakeDOMStringList(Array.from(rawObjectStore.rawIndexes.keys())).sort();
    }

    public put(value: Value, key?: Key) {
        const record = buildRecordAddPut(this, value, key);

        return this.transaction._execRequestAsync({
            operation: this._rawObjectStore.storeRecord.bind(
                this._rawObjectStore,
                record,
                false,
                this.transaction._rollbackLog,
            ),
            source: this,
        });
    }

    public add(value: Value, key?: Key) {
        const record = buildRecordAddPut(this, value, key);

        return this.transaction._execRequestAsync({
            operation: this._rawObjectStore.storeRecord.bind(
                this._rawObjectStore,
                record,
                true,
                this.transaction._rollbackLog,
            ),
            source: this,
        });
    }

    public delete(key: Key) {
        if (this.transaction.mode === "readonly") {
            throw new ReadOnlyError();
        }
        confirmActiveTransaction(this);

        if (!(key instanceof FDBKeyRange)) {
            key = structuredClone(validateKey(key));
        }

        return this.transaction._execRequestAsync({
            operation: this._rawObjectStore.deleteRecord.bind(this._rawObjectStore, key, this.transaction._rollbackLog),
            source: this,
        });
    }

    public get(key?: Key) {
        confirmActiveTransaction(this);

        if (!(key instanceof FDBKeyRange)) {
            key = structuredClone(validateKey(key));
        }

        return this.transaction._execRequestAsync({
            operation: this._rawObjectStore.getValue.bind(this._rawObjectStore, key),
            source: this,
        });
    }

    public clear() {
        if (this.transaction.mode === "readonly") {
            throw new ReadOnlyError();
        }
        confirmActiveTransaction(this);

        return this.transaction._execRequestAsync({
            operation: this._rawObjectStore.clear.bind(this._rawObjectStore, this.transaction._rollbackLog),
            source: this,
        });
    }

    public openCursor(range: FDBKeyRange | Key, direction?: FDBCursorDirection) {
        confirmActiveTransaction(this);

        if (range === null) { range = undefined; }
        if (range !== undefined && !(range instanceof FDBKeyRange)) {
            range = FDBKeyRange.only(structuredClone(validateKey(range)));
        }

        const request = new FDBRequest();
        request.source = this;
        request.transaction = this.transaction;

        const cursor = new FDBCursorWithValue(this, range, direction, request);

        return this.transaction._execRequestAsync({
            operation: cursor._iterate.bind(cursor),
            request,
            source: this,
        });
    }

    // tslint:disable-next-line max-line-length
    // http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#widl-IDBObjectStore-createIndex-IDBIndex-DOMString-name-DOMString-sequence-DOMString--keyPath-IDBIndexParameters-optionalParameters
    public createIndex(
        name: string,
        keyPath: KeyPath,
        optionalParameters: {multiEntry?: boolean, unique?: boolean} = {},
    ) {
        if (keyPath === undefined) { throw new TypeError(); }

        const multiEntry = optionalParameters.multiEntry !== undefined ? optionalParameters.multiEntry : false;
        const unique = optionalParameters.unique !== undefined ? optionalParameters.unique : false;

        if (this.transaction.mode !== "versionchange") {
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

        // The index that is requested to be created can contain constraints on the data allowed in the index's
        // referenced object store, such as requiring uniqueness of the values referenced by the index's keyPath. If the
        // referenced object store already contains data which violates these constraints, this MUST NOT cause the
        // implementation of createIndex to throw an exception or affect what it returns. The implementation MUST still
        // create and return an IDBIndex object. Instead the implementation must queue up an operation to abort the
        // "versionchange" transaction which was used for the createIndex call.

        const indexNames = this.indexNames.slice();
        this.transaction._rollbackLog.push(() => {
            this.indexNames = fakeDOMStringList(indexNames);
            this._rawObjectStore.rawIndexes.delete(name);
        });

        const index = new Index(this._rawObjectStore, name, keyPath, multiEntry, unique);
        this.indexNames.push(name);
        this.indexNames.sort();
        this._rawObjectStore.rawIndexes.set(name, index);

        index.initialize(this.transaction); // This is async by design

        return new FDBIndex(this, index);
    }

    public index(name: string) {
        if (name === undefined) { throw new TypeError(); }

        const rawIndex = this._rawIndexesCache.get(name);
        if (rawIndex !== undefined) {
            return rawIndex;
        }

        const rawIndex2 = this._rawObjectStore.rawIndexes.get(name);
        if (this.indexNames.indexOf(name) < 0 || rawIndex2 === undefined) {
            throw new NotFoundError();
        }

        if (this._rawObjectStore.deleted) {
            throw new InvalidStateError();
        }

        const index = new FDBIndex(this, rawIndex2);
        this._rawIndexesCache.set(name, index);

        return index;
    }

    public deleteIndex(name: string) {
        if (name === undefined) { throw new TypeError(); }

        if (this.transaction.mode !== "versionchange") {
            throw new InvalidStateError();
        }

        confirmActiveTransaction(this);

        const rawIndex = this._rawObjectStore.rawIndexes.get(name);
        if (rawIndex === undefined) {
            throw new NotFoundError();
        }

        this.transaction._rollbackLog.push(() => {
            rawIndex.deleted = false;
            this._rawObjectStore.rawIndexes.set(name, rawIndex);
            this.indexNames.push(name);
            this.indexNames.sort();
        });

        this.indexNames = fakeDOMStringList(this.indexNames.filter((indexName) => {
            return indexName !== name;
        }));
        rawIndex.deleted = true; // Not sure if this is supposed to happen synchronously

        this.transaction._execRequestAsync({
            operation: () => {
                this._rawObjectStore.rawIndexes.delete(name);
            },
            source: this,
        });
    }

    // http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#widl-IDBObjectStore-count-IDBRequest-any-key
    public count(key?: Key | FDBKeyRange) {
        confirmActiveTransaction(this);

        if (key === null) { key = undefined; }
        if (key !== undefined && !(key instanceof FDBKeyRange)) {
            key = FDBKeyRange.only(structuredClone(validateKey(key)));
        }

        return this.transaction._execRequestAsync({
            operation: () => {
                let count = 0;

                const cursor = new FDBCursor(this, key);
                while (cursor._iterate() !== null) {
                    count += 1;
                }

                return count;
            },
            source: this,
        });
    }

    public toString() {
        return "[object IDBObjectStore]";
    }
}

export default FDBObjectStore;
