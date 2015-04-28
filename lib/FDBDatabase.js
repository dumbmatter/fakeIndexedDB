'use strict';

var EventTarget = require('./EventTarget');
var FDBTransaction = require('./FDBTransaction');
var ObjectStore = require('./ObjectStore');
var ConstraintError = require('./errors/ConstraintError');
var InvalidAccessError = require('./errors/InvalidAccessError');
var InvalidStateError = require('./errors/InvalidStateError');
var NotFoundError = require('./errors/NotFoundError');
var TransactionInactiveError = require('./errors/TransactionInactiveError');

function confirmActiveVersionchangeTransaction(database) {
    if (!database._runningVersionchangeTransaction) {
        throw new InvalidStateError();
    }

    var transaction = database._rawDatabase.transactions.find(function (transaction) {
        return transaction._active && transaction.mode === 'versionchange';
    });
    if (!transaction) {
        throw new TransactionInactiveError();
    }

    return transaction;
}

function closeDatabase(connection) {
    var transactionsComplete = connection._rawDatabase.transactions.some(function (transaction) {
        return !transaction._finished;
    });

    if (transactionsComplete) {
        connection._closed = true;
    } else {
        setImmediate(function () {
            closeDatabase(connection);
        });
    }
}

// http://www.w3.org/TR/IndexedDB/#database-interface
module.exports = function (rawDatabase) {
    this._closePending = false;
    this._closed = false;
    this._runningVersionchangeTransaction = false;
    this._rawDatabase = rawDatabase;

    this.name = rawDatabase.name;
    this.version = rawDatabase.version;
    this.objectStoreNames = Object.keys(rawDatabase.rawObjectStores);

    this.createObjectStore = function (name, optionalParameters) {
        if (name === undefined) { throw new TypeError(); }
        var transaction = confirmActiveVersionchangeTransaction(this);

        if (this._rawDatabase.rawObjectStores.hasOwnProperty(name)) {
            throw new ConstraintError();
        }

        optionalParameters = optionalParameters || {};
        var keyPath = optionalParameters.keyPath !== undefined ? optionalParameters.keyPath : null;
        var autoIncrement = optionalParameters.autoIncrement !== undefined ? optionalParameters.autoIncrement : false;

        var objectStore = new ObjectStore(this._rawDatabase, name, keyPath, autoIncrement);
        this.objectStoreNames.push(name);
        this._rawDatabase.rawObjectStores[name] = objectStore;

        return transaction.objectStore(name);
    };

    this.deleteObjectStore = function (name) {
        if (name === undefined) { throw new TypeError(); }
        confirmActiveVersionchangeTransaction(this);

        if (!this._rawDatabase.rawObjectStores.hasOwnProperty(name)) {
            throw new NotFoundError();
        }

        this.objectStoreNames = this.objectStoreNames.filter(function (objectStoreName) {
            return objectStoreName !== name;
        });

        this._rawDatabase.rawObjectStores[name].deleted = true;
        delete this._rawDatabase.rawObjectStores[name];
    };

    this.transaction = function (storeNames, mode) {
        mode = mode !== undefined ? mode : 'readonly';
        if (mode !== 'readonly' && mode !== 'readwrite' && mode !== 'versionchange') {
            throw new TypeError('Invalid mode: ' + mode);
        }

        var hasActiveVersionchange = this._rawDatabase.transactions.some(function (transaction) {
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
        storeNames.forEach(function (storeName) {
            if (this.objectStoreNames.indexOf(storeName) < 0) {
                throw new NotFoundError('No objectStore named ' + storeName + ' in this database');
            }
        }.bind(this));

        var tx = new FDBTransaction(storeNames, mode);
        tx.db = this;
        this._rawDatabase.transactions.push(tx);

        return tx;
    };

    this.close = function () {
        this._closePending = true;

        closeDatabase(this);
    };

    EventTarget.call(this);

    return this;
};