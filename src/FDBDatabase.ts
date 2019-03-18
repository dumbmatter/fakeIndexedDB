import FDBTransaction from "./FDBTransaction";
import Database from "./lib/Database";
import {
    ConstraintError,
    InvalidAccessError,
    InvalidStateError,
    NotFoundError,
    TransactionInactiveError,
} from "./lib/errors";
import fakeDOMStringList from "./lib/fakeDOMStringList";
import FakeEventTarget from "./lib/FakeEventTarget";
import ObjectStore from "./lib/ObjectStore";
import { FakeDOMStringList, KeyPath, TransactionMode } from "./lib/types";
import validateKeyPath from "./lib/validateKeyPath";

const confirmActiveVersionchangeTransaction = (database: FDBDatabase) => {
    if (!database._runningVersionchangeTransaction) {
        throw new InvalidStateError();
    }

    // Find the latest versionchange transaction
    const transactions = database._rawDatabase.transactions.filter(tx => {
        return tx.mode === "versionchange";
    });
    const transaction = transactions[transactions.length - 1];

    if (!transaction || transaction._state === "finished") {
        throw new InvalidStateError();
    }

    if (transaction._state !== "active") {
        throw new TransactionInactiveError();
    }

    return transaction;
};

// http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#database-closing-steps
const closeConnection = (connection: FDBDatabase) => {
    connection._closePending = true;

    const transactionsComplete = connection._rawDatabase.transactions.every(
        transaction => {
            return transaction._state === "finished";
        },
    );

    if (transactionsComplete) {
        connection._closed = true;
        connection._rawDatabase.connections = connection._rawDatabase.connections.filter(
            otherConnection => {
                return connection !== otherConnection;
            },
        );
    } else {
        setImmediate(() => {
            closeConnection(connection);
        });
    }
};

// http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#database-interface
class FDBDatabase extends FakeEventTarget {
    public _closePending = false;
    public _closed = false;
    public _runningVersionchangeTransaction = false;
    public _rawDatabase: Database;

    public name: string;
    public version: number;
    public objectStoreNames: FakeDOMStringList;

    constructor(rawDatabase: Database) {
        super();

        this._rawDatabase = rawDatabase;
        this._rawDatabase.connections.push(this);

        this.name = rawDatabase.name;
        this.version = rawDatabase.version;
        this.objectStoreNames = fakeDOMStringList(
            Array.from(rawDatabase.rawObjectStores.keys()),
        ).sort();
    }

    // http://w3c.github.io/IndexedDB/#dom-idbdatabase-createobjectstore
    public createObjectStore(
        name: string,
        options: { autoIncrement?: boolean; keyPath?: KeyPath } | null = {},
    ) {
        if (name === undefined) {
            throw new TypeError();
        }
        const transaction = confirmActiveVersionchangeTransaction(this);

        const keyPath =
            options !== null && options.keyPath !== undefined
                ? options.keyPath
                : null;
        const autoIncrement =
            options !== null && options.autoIncrement !== undefined
                ? options.autoIncrement
                : false;

        if (keyPath !== null) {
            validateKeyPath(keyPath);
        }

        if (this._rawDatabase.rawObjectStores.has(name)) {
            throw new ConstraintError();
        }

        if (autoIncrement && (keyPath === "" || Array.isArray(keyPath))) {
            throw new InvalidAccessError();
        }

        const objectStoreNames = this.objectStoreNames.slice();
        transaction._rollbackLog.push(() => {
            const objectStore = this._rawDatabase.rawObjectStores.get(name);
            if (objectStore) {
                objectStore.deleted = true;
            }

            this.objectStoreNames = fakeDOMStringList(objectStoreNames);
            transaction._scope.delete(name);
            this._rawDatabase.rawObjectStores.delete(name);
        });

        const rawObjectStore = new ObjectStore(
            this._rawDatabase,
            name,
            keyPath,
            autoIncrement,
        );
        this.objectStoreNames.push(name);
        this.objectStoreNames.sort();
        transaction._scope.add(name);
        this._rawDatabase.rawObjectStores.set(name, rawObjectStore);
        transaction.objectStoreNames = fakeDOMStringList(
            this.objectStoreNames.slice(),
        );
        return transaction.objectStore(name);
    }

    public deleteObjectStore(name: string) {
        if (name === undefined) {
            throw new TypeError();
        }
        const transaction = confirmActiveVersionchangeTransaction(this);

        const store = this._rawDatabase.rawObjectStores.get(name);
        if (store === undefined) {
            throw new NotFoundError();
        }

        this.objectStoreNames = fakeDOMStringList(
            this.objectStoreNames.filter(objectStoreName => {
                return objectStoreName !== name;
            }),
        );
        transaction.objectStoreNames = fakeDOMStringList(
            this.objectStoreNames.slice(),
        );

        transaction._rollbackLog.push(() => {
            store.deleted = false;
            this._rawDatabase.rawObjectStores.set(name, store);
            this.objectStoreNames.push(name);
            this.objectStoreNames.sort();
        });

        store.deleted = true;
        this._rawDatabase.rawObjectStores.delete(name);
        transaction._objectStoresCache.delete(name);
    }

    public transaction(storeNames: string | string[], mode?: TransactionMode) {
        mode = mode !== undefined ? mode : "readonly";
        if (
            mode !== "readonly" &&
            mode !== "readwrite" &&
            mode !== "versionchange"
        ) {
            throw new TypeError("Invalid mode: " + mode);
        }

        const hasActiveVersionchange = this._rawDatabase.transactions.some(
            transaction => {
                return (
                    transaction._state === "active" &&
                    transaction.mode === "versionchange" &&
                    transaction.db === this
                );
            },
        );
        if (hasActiveVersionchange) {
            throw new InvalidStateError();
        }

        if (this._closePending) {
            throw new InvalidStateError();
        }

        if (!Array.isArray(storeNames)) {
            storeNames = [storeNames];
        }
        if (storeNames.length === 0 && mode !== "versionchange") {
            throw new InvalidAccessError();
        }
        for (const storeName of storeNames) {
            if (this.objectStoreNames.indexOf(storeName) < 0) {
                throw new NotFoundError(
                    "No objectStore named " + storeName + " in this database",
                );
            }
        }

        const tx = new FDBTransaction(storeNames, mode, this);
        this._rawDatabase.transactions.push(tx);
        this._rawDatabase.processTransactions(); // See if can start right away (async)

        return tx;
    }

    public close() {
        closeConnection(this);
    }

    public toString() {
        return "[object IDBDatabase]";
    }
}

export default FDBDatabase;
