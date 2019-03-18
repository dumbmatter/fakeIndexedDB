import FDBCursor from "./FDBCursor";
import FDBCursorWithValue from "./FDBCursorWithValue";
import FDBIndex from "./FDBIndex";
import FDBKeyRange from "./FDBKeyRange";
import FDBRequest from "./FDBRequest";
import FDBTransaction from "./FDBTransaction";
import canInjectKey from "./lib/canInjectKey";
import enforceRange from "./lib/enforceRange";
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
import {
    FakeDOMStringList,
    FDBCursorDirection,
    Key,
    KeyPath,
    Value,
} from "./lib/types";
import validateKeyPath from "./lib/validateKeyPath";
import valueToKey from "./lib/valueToKey";
import valueToKeyRange from "./lib/valueToKeyRange";

const confirmActiveTransaction = (objectStore: FDBObjectStore) => {
    if (objectStore._rawObjectStore.deleted) {
        throw new InvalidStateError();
    }

    if (objectStore.transaction._state !== "active") {
        throw new TransactionInactiveError();
    }
};

const buildRecordAddPut = (
    objectStore: FDBObjectStore,
    value: Value,
    key: Key,
) => {
    confirmActiveTransaction(objectStore);

    if (objectStore.transaction.mode === "readonly") {
        throw new ReadOnlyError();
    }

    if (objectStore.keyPath !== null) {
        if (key !== undefined) {
            throw new DataError();
        }
    }

    const clone = structuredClone(value);

    if (objectStore.keyPath !== null) {
        const tempKey = extractKey(objectStore.keyPath, clone);

        if (tempKey !== undefined) {
            valueToKey(tempKey);
        } else {
            if (!objectStore._rawObjectStore.keyGenerator) {
                throw new DataError();
            } else if (!canInjectKey(objectStore.keyPath, clone)) {
                throw new DataError();
            }
        }
    }

    if (
        objectStore.keyPath === null &&
        objectStore._rawObjectStore.keyGenerator === null &&
        key === undefined
    ) {
        throw new DataError();
    }

    if (key !== undefined) {
        key = valueToKey(key);
    }

    return {
        key,
        value: clone,
    };
};

// http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#object-store
class FDBObjectStore {
    public _rawObjectStore: ObjectStore;
    public _indexesCache: Map<string, FDBIndex> = new Map();

    public keyPath: KeyPath | null;
    public autoIncrement: boolean;
    public transaction: FDBTransaction;
    public indexNames: FakeDOMStringList;

    private _name: string;

    constructor(transaction: FDBTransaction, rawObjectStore: ObjectStore) {
        this._rawObjectStore = rawObjectStore;

        this._name = rawObjectStore.name;
        this.keyPath = rawObjectStore.keyPath;
        this.autoIncrement = rawObjectStore.autoIncrement;
        this.transaction = transaction;
        this.indexNames = fakeDOMStringList(
            Array.from(rawObjectStore.rawIndexes.keys()),
        ).sort();
    }

    get name() {
        return this._name;
    }

    // http://w3c.github.io/IndexedDB/#dom-idbobjectstore-name
    set name(name: any) {
        const transaction = this.transaction;

        if (!transaction.db._runningVersionchangeTransaction) {
            throw new InvalidStateError();
        }

        confirmActiveTransaction(this);

        name = String(name);

        if (name === this._name) {
            return;
        }

        if (this._rawObjectStore.rawDatabase.rawObjectStores.has(name)) {
            throw new ConstraintError();
        }

        const oldName = this._name;
        const oldObjectStoreNames = transaction.db.objectStoreNames.slice();

        this._name = name;
        this._rawObjectStore.name = name;
        this.transaction._objectStoresCache.delete(oldName);
        this.transaction._objectStoresCache.set(name, this);
        this._rawObjectStore.rawDatabase.rawObjectStores.delete(oldName);
        this._rawObjectStore.rawDatabase.rawObjectStores.set(
            name,
            this._rawObjectStore,
        );
        transaction.db.objectStoreNames = fakeDOMStringList(
            Array.from(
                this._rawObjectStore.rawDatabase.rawObjectStores.keys(),
            ).filter(objectStoreName => {
                const objectStore = this._rawObjectStore.rawDatabase.rawObjectStores.get(
                    objectStoreName,
                );
                return objectStore && !objectStore.deleted;
            }),
        ).sort();

        const oldScope = new Set(transaction._scope);
        const oldTransactionObjectStoreNames = transaction.objectStoreNames.slice();
        this.transaction._scope.delete(oldName);
        transaction._scope.add(name);
        transaction.objectStoreNames = fakeDOMStringList(
            Array.from(transaction._scope).sort(),
        );

        transaction._rollbackLog.push(() => {
            this._name = oldName;
            this._rawObjectStore.name = oldName;
            this.transaction._objectStoresCache.delete(name);
            this.transaction._objectStoresCache.set(oldName, this);
            this._rawObjectStore.rawDatabase.rawObjectStores.delete(name);
            this._rawObjectStore.rawDatabase.rawObjectStores.set(
                oldName,
                this._rawObjectStore,
            );
            transaction.db.objectStoreNames = fakeDOMStringList(
                oldObjectStoreNames,
            );

            transaction._scope = oldScope;
            transaction.objectStoreNames = fakeDOMStringList(
                oldTransactionObjectStoreNames,
            );
        });
    }

    public put(value: Value, key?: Key) {
        if (arguments.length === 0) {
            throw new TypeError();
        }
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
        if (arguments.length === 0) {
            throw new TypeError();
        }
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
        if (arguments.length === 0) {
            throw new TypeError();
        }
        confirmActiveTransaction(this);

        if (this.transaction.mode === "readonly") {
            throw new ReadOnlyError();
        }

        if (!(key instanceof FDBKeyRange)) {
            key = valueToKey(key);
        }

        return this.transaction._execRequestAsync({
            operation: this._rawObjectStore.deleteRecord.bind(
                this._rawObjectStore,
                key,
                this.transaction._rollbackLog,
            ),
            source: this,
        });
    }

    public get(key?: FDBKeyRange | Key) {
        if (arguments.length === 0) {
            throw new TypeError();
        }
        confirmActiveTransaction(this);

        if (!(key instanceof FDBKeyRange)) {
            key = valueToKey(key);
        }

        return this.transaction._execRequestAsync({
            operation: this._rawObjectStore.getValue.bind(
                this._rawObjectStore,
                key,
            ),
            source: this,
        });
    }

    // http://w3c.github.io/IndexedDB/#dom-idbobjectstore-getall
    public getAll(query?: FDBKeyRange | Key, count?: number) {
        if (arguments.length > 1 && count !== undefined) {
            count = enforceRange(count, "unsigned long");
        }
        confirmActiveTransaction(this);

        const range = valueToKeyRange(query);

        return this.transaction._execRequestAsync({
            operation: this._rawObjectStore.getAllValues.bind(
                this._rawObjectStore,
                range,
                count,
            ),
            source: this,
        });
    }

    // http://w3c.github.io/IndexedDB/#dom-idbobjectstore-getkey
    public getKey(key?: FDBKeyRange | Key) {
        if (arguments.length === 0) {
            throw new TypeError();
        }
        confirmActiveTransaction(this);

        if (!(key instanceof FDBKeyRange)) {
            key = valueToKey(key);
        }

        return this.transaction._execRequestAsync({
            operation: this._rawObjectStore.getKey.bind(
                this._rawObjectStore,
                key,
            ),
            source: this,
        });
    }

    // http://w3c.github.io/IndexedDB/#dom-idbobjectstore-getallkeys
    public getAllKeys(query?: FDBKeyRange | Key, count?: number) {
        if (arguments.length > 1 && count !== undefined) {
            count = enforceRange(count, "unsigned long");
        }
        confirmActiveTransaction(this);

        const range = valueToKeyRange(query);

        return this.transaction._execRequestAsync({
            operation: this._rawObjectStore.getAllKeys.bind(
                this._rawObjectStore,
                range,
                count,
            ),
            source: this,
        });
    }

    public clear() {
        confirmActiveTransaction(this);

        if (this.transaction.mode === "readonly") {
            throw new ReadOnlyError();
        }

        return this.transaction._execRequestAsync({
            operation: this._rawObjectStore.clear.bind(
                this._rawObjectStore,
                this.transaction._rollbackLog,
            ),
            source: this,
        });
    }

    public openCursor(
        range?: FDBKeyRange | Key,
        direction?: FDBCursorDirection,
    ) {
        confirmActiveTransaction(this);

        if (range === null) {
            range = undefined;
        }
        if (range !== undefined && !(range instanceof FDBKeyRange)) {
            range = FDBKeyRange.only(valueToKey(range));
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

    public openKeyCursor(
        range?: FDBKeyRange | Key,
        direction?: FDBCursorDirection,
    ) {
        confirmActiveTransaction(this);

        if (range === null) {
            range = undefined;
        }
        if (range !== undefined && !(range instanceof FDBKeyRange)) {
            range = FDBKeyRange.only(valueToKey(range));
        }

        const request = new FDBRequest();
        request.source = this;
        request.transaction = this.transaction;

        const cursor = new FDBCursor(this, range, direction, request, true);

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
        optionalParameters: { multiEntry?: boolean; unique?: boolean } = {},
    ) {
        if (arguments.length < 2) {
            throw new TypeError();
        }

        const multiEntry =
            optionalParameters.multiEntry !== undefined
                ? optionalParameters.multiEntry
                : false;
        const unique =
            optionalParameters.unique !== undefined
                ? optionalParameters.unique
                : false;

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
            const index2 = this._rawObjectStore.rawIndexes.get(name);
            if (index2) {
                index2.deleted = true;
            }

            this.indexNames = fakeDOMStringList(indexNames);
            this._rawObjectStore.rawIndexes.delete(name);
        });

        const index = new Index(
            this._rawObjectStore,
            name,
            keyPath,
            multiEntry,
            unique,
        );
        this.indexNames.push(name);
        this.indexNames.sort();
        this._rawObjectStore.rawIndexes.set(name, index);

        index.initialize(this.transaction); // This is async by design

        return new FDBIndex(this, index);
    }

    // https://w3c.github.io/IndexedDB/#dom-idbobjectstore-index
    public index(name: string) {
        if (arguments.length === 0) {
            throw new TypeError();
        }

        if (
            this._rawObjectStore.deleted ||
            this.transaction._state === "finished"
        ) {
            throw new InvalidStateError();
        }

        const index = this._indexesCache.get(name);
        if (index !== undefined) {
            return index;
        }

        const rawIndex = this._rawObjectStore.rawIndexes.get(name);
        if (this.indexNames.indexOf(name) < 0 || rawIndex === undefined) {
            throw new NotFoundError();
        }

        const index2 = new FDBIndex(this, rawIndex);
        this._indexesCache.set(name, index2);

        return index2;
    }

    public deleteIndex(name: string) {
        if (arguments.length === 0) {
            throw new TypeError();
        }

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

        this.indexNames = fakeDOMStringList(
            this.indexNames.filter(indexName => {
                return indexName !== name;
            }),
        );
        rawIndex.deleted = true; // Not sure if this is supposed to happen synchronously

        this.transaction._execRequestAsync({
            operation: () => {
                const rawIndex2 = this._rawObjectStore.rawIndexes.get(name);

                // Hack in case another index is given this name before this async request is processed. It'd be better
                // to have a real unique ID for each index.
                if (rawIndex === rawIndex2) {
                    this._rawObjectStore.rawIndexes.delete(name);
                }
            },
            source: this,
        });
    }

    // http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#widl-IDBObjectStore-count-IDBRequest-any-key
    public count(key?: Key | FDBKeyRange) {
        confirmActiveTransaction(this);

        if (key === null) {
            key = undefined;
        }
        if (key !== undefined && !(key instanceof FDBKeyRange)) {
            key = FDBKeyRange.only(valueToKey(key));
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
