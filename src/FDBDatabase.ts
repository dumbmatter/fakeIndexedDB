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
import {FakeDOMStringList, KeyPath, TransactionMode} from "./lib/types";
import validateKeyPath from "./lib/validateKeyPath";

const confirmActiveVersionchangeTransaction = (database: FDBDatabase) => {
    if (!database._runningVersionchangeTransaction) {
        throw new InvalidStateError();
    }

    const transaction = database._rawDatabase.transactions.find((tx) => {
        return tx._active && tx.mode === "versionchange";
    });
    if (!transaction) {
        throw new TransactionInactiveError();
    }

    return transaction;
};

// http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#database-closing-steps
const closeConnection = (connection: FDBDatabase) => {
    connection._closePending = true;

    const transactionsComplete = connection._rawDatabase.transactions.every((transaction) => {
        return transaction._finished;
    });

    if (transactionsComplete) {
        connection._closed = true;
        connection._rawDatabase.connections = connection._rawDatabase.connections.filter((otherConnection) => {
            return connection !== otherConnection;
        });
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
        this.objectStoreNames = fakeDOMStringList(Array.from(rawDatabase.rawObjectStores.keys())).sort();
    }

    public createObjectStore(
        name: string,
        optionalParameters: {autoIncrement?: boolean, keyPath?: KeyPath} = {},
    ) {
        if (name === undefined) { throw new TypeError(); }
        const transaction = confirmActiveVersionchangeTransaction(this);

        if (this._rawDatabase.rawObjectStores.has(name)) {
            throw new ConstraintError();
        }

        const keyPath = optionalParameters.keyPath !== undefined ? optionalParameters.keyPath : null;
        const autoIncrement = optionalParameters.autoIncrement !== undefined ? optionalParameters.autoIncrement : false;

        if (keyPath !== null) {
            validateKeyPath(keyPath);
        }

        if (autoIncrement && (keyPath === "" || Array.isArray(keyPath))) {
            throw new InvalidAccessError();
        }

        const objectStoreNames = this.objectStoreNames.slice();
        transaction._rollbackLog.push(() => {
            this.objectStoreNames = fakeDOMStringList(objectStoreNames);
            this._rawDatabase.rawObjectStores.delete(name);
        });

        const objectStore = new ObjectStore(this._rawDatabase, name, keyPath, autoIncrement);
        this.objectStoreNames.push(name);
        this.objectStoreNames.sort();
        this._rawDatabase.rawObjectStores.set(name, objectStore);
        transaction.objectStoreNames = fakeDOMStringList(this.objectStoreNames.slice());

        return transaction.objectStore(name);
    }

    public deleteObjectStore(name: string) {
        if (name === undefined) { throw new TypeError(); }
        const transaction = confirmActiveVersionchangeTransaction(this);

        const store = this._rawDatabase.rawObjectStores.get(name);
        if (store === undefined) {
            throw new NotFoundError();
        }

        this.objectStoreNames = fakeDOMStringList(this.objectStoreNames.filter((objectStoreName) => {
            return objectStoreName !== name;
        }));
        transaction.objectStoreNames = fakeDOMStringList(this.objectStoreNames.slice());

        transaction._rollbackLog.push(() => {
            store.deleted = false;
            this._rawDatabase.rawObjectStores.set(name, store);
            this.objectStoreNames.push(name);
            this.objectStoreNames.sort();
        });

        store.deleted = true;
        this._rawDatabase.rawObjectStores.delete(name);
    }

    public transaction(storeNames: string | string[], mode?: TransactionMode) {
        mode = mode !== undefined ? mode : "readonly";
        if (mode !== "readonly" && mode !== "readwrite" && mode !== "versionchange") {
            throw new TypeError("Invalid mode: " + mode);
        }

        const hasActiveVersionchange = this._rawDatabase.transactions.some((transaction) => {
            return transaction._active && transaction.mode === "versionchange";
        });
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
                throw new NotFoundError("No objectStore named " + storeName + " in this database");
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
