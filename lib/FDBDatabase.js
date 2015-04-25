var FDBObjectStore = require('./FDBObjectStore');
var FDBTransaction = require('./FDBTransaction');
var ConstraintError = require('./errors/ConstraintError');
var InvalidAccessError = require('./errors/InvalidAccessError');
var InvalidStateError = require('./errors/InvalidStateError');
var NotFoundError = require('./errors/NotFoundError');
var TransactionInactiveError = require('./errors/TransactionInactiveError');
var TypeError = require('./errors/TypeError');

// http://www.w3.org/TR/IndexedDB/#database-interface
module.exports = function () {
    this._closePending = false;

    this.name = null;
    this.version = null;
    this.objectStoreNames = [];

    this.transactions = []; // FDB
    this.objectStores = {}; // FDB

    this.createObjectStore = function (name, optionalParameters) {
        var hasVersionchange = this.transactions.some(function (transaction) {
            return transaction.mode === 'versionchange';
        });
        if (!hasVersionchange) {
            throw new InvalidStateError();
        }

        var transaction = this.transactions.find(function (transaction) {
            return transaction._active && transaction.mode === 'versionchange';
        });
        if (!transaction) {
            throw new TransactionInactiveError();
        }

        if (this.objectStoreNames.indexOf(name) >= 0) {
            throw new ConstraintError();
        }

        optionalParameters = optionalParameters || {};
        var keyPath = optionalParameters.keyPath !== undefined ? optionalParameters.keyPath : null;
        var autoIncrement = optionalParameters.autoIncrement !== undefined ? optionalParameters.autoIncrement : false;

        var objectStore = new FDBObjectStore(name, keyPath, autoIncrement);
        objectStore.transaction = transaction;
        this.objectStoreNames.push(name);
        this.objectStores[name] = objectStore;

        return objectStore;
    };

    this.deleteObjectStore = function () {
        throw new Error('Not implemented');
    };

    this.transaction = function (storeNames, mode) {
        mode = mode !== undefined ? mode : 'readonly';
        if (mode !== 'readonly' && mode !== 'readwrite' && mode !== 'versionchange') {
            throw new TypeError('Invalid mode: ' + mode);
        }

        var hasActiveVersionchange = this.transactions.some(function (transaction) {
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
        this.transactions.push(tx);

        return tx;
    };

    this.close = function () {
        this._closePending = true;
    };

    return this;
};