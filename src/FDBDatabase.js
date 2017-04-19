const EventTarget = require('./lib/EventTarget').default;
const FDBTransaction = require('./FDBTransaction').default;
const ObjectStore = require('./lib/ObjectStore').default;
const {ConstraintError, InvalidAccessError, InvalidStateError, NotFoundError, TransactionInactiveError} = require('./lib/errors');
const addDomStringListMethods = require('./lib/addDomStringListMethods');
const validateKeyPath = require('./lib/validateKeyPath').default;

const confirmActiveVersionchangeTransaction = (database) => {
    if (!database._runningVersionchangeTransaction) {
        throw new InvalidStateError();
    }

    const transaction = database._rawDatabase.transactions.find((transaction) => {
        return transaction._active && transaction.mode === 'versionchange';
    });
    if (!transaction) {
        throw new TransactionInactiveError();
    }

    return transaction;
};

// http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#database-closing-steps
const closeConnection = (connection) => {
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
class FDBDatabase extends EventTarget {
    constructor(rawDatabase) {
        super();

        this._closePending = false;
        this._closed = false;
        this._runningVersionchangeTransaction = false;
        this._rawDatabase = rawDatabase;
        this._rawDatabase.connections.push(this);

        this.name = rawDatabase.name;
        this.version = rawDatabase.version;
        this.objectStoreNames = Object.keys(rawDatabase.rawObjectStores).sort();
        addDomStringListMethods(this.objectStoreNames);
    }

    createObjectStore(name, optionalParameters) {
        if (name === undefined) { throw new TypeError(); }
        const transaction = confirmActiveVersionchangeTransaction(this);

        if (this._rawDatabase.rawObjectStores.hasOwnProperty(name)) {
            throw new ConstraintError();
        }

        optionalParameters = optionalParameters || {};
        const keyPath = optionalParameters.keyPath !== undefined ? optionalParameters.keyPath : null;
        const autoIncrement = optionalParameters.autoIncrement !== undefined ? optionalParameters.autoIncrement : false;

        if (keyPath !== null) {
            validateKeyPath(keyPath);
        }

        if (autoIncrement && (keyPath === '' || Array.isArray(keyPath))) {
            throw new InvalidAccessError();
        }

        transaction._rollbackLog.push(function (objectStoreNames) {
            this.objectStoreNames = objectStoreNames;
            addDomStringListMethods(this.objectStoreNames);
            delete this._rawDatabase.rawObjectStores[name];
        }.bind(this, this.objectStoreNames.slice()));

        const objectStore = new ObjectStore(this._rawDatabase, name, keyPath, autoIncrement);
        this.objectStoreNames.push(name);
        this.objectStoreNames.sort();
        this._rawDatabase.rawObjectStores[name] = objectStore;

        return transaction.objectStore(name);
    }

    deleteObjectStore(name) {
        if (name === undefined) { throw new TypeError(); }
        const transaction = confirmActiveVersionchangeTransaction(this);

        if (!this._rawDatabase.rawObjectStores.hasOwnProperty(name)) {
            throw new NotFoundError();
        }

        this.objectStoreNames = this.objectStoreNames.filter((objectStoreName) => {
            return objectStoreName !== name;
        });
        addDomStringListMethods(this.objectStoreNames);

        transaction._rollbackLog.push(function (store) {
            store.deleted = false;
            this._rawDatabase.rawObjectStores[name] = store;
            this.objectStoreNames.push(name);
            this.objectStoreNames.sort();
        }.bind(this, this._rawDatabase.rawObjectStores[name]));

        this._rawDatabase.rawObjectStores[name].deleted = true;
        delete this._rawDatabase.rawObjectStores[name];
    }

    transaction(storeNames, mode) {
        mode = mode !== undefined ? mode : 'readonly';
        if (mode !== 'readonly' && mode !== 'readwrite' && mode !== 'versionchange') {
            throw new TypeError('Invalid mode: ' + mode);
        }

        const hasActiveVersionchange = this._rawDatabase.transactions.some((transaction) => {
            return transaction._active && transaction.mode === 'versionchange';
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
        if (storeNames.length === 0 && mode !== 'versionchange') {
            throw new InvalidAccessError();
        }
        for (const storeName of storeNames) {
            if (this.objectStoreNames.indexOf(storeName) < 0) {
                throw new NotFoundError('No objectStore named ' + storeName + ' in this database');
            }
        }

        const tx = new FDBTransaction(storeNames, mode, this);
        this._rawDatabase.transactions.push(tx);
        this._rawDatabase.processTransactions(); // See if can start right away (async)

        return tx;
    }

    close() {
        closeConnection(this);
    }

    toString() {
        return '[object IDBDatabase]';
    }
}

module.exports = FDBDatabase;
