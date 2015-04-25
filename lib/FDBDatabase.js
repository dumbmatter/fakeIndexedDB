var FDBObjectStore = require('./FDBObjectStore');
var FDBTransaction = require('./FDBTransaction');
var InvalidAccessError = require('./errors/InvalidAccessError');
var InvalidStateError = require('./errors/InvalidStateError');
var NotFoundError = require('./errors/NotFoundError');
var TypeError = require('./errors/TypeError');

module.exports = function () {
    this.closePending = false;

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
            throw new Error('InvalidStateError');
        }

        var hasActiveVersionchange = this.transactions.some(function (transaction) {
            return transaction.active && transaction.mode === 'versionchange';
        });
        if (!hasActiveVersionchange) {
            throw new Error('TransactionInactiveError');
        }

        if (this.objectStoreNames.indexOf(name) >= 0) {
            throw new Error('ConstraintError');
        }

        optionalParameters = optionalParameters || {};
        var keyPath = optionalParameters.keyPath !== undefined ? optionalParameters.keyPath : null;

        var objectStore = new FDBObjectStore(name, keyPath);
        this.objectStoreNames.push(name);
        this.objectStores[name] = objectStore;

        return objectStore;
    };

    this.deleteObjectStore = function () {
        throw new Error('Not implemented');
    };

    this.transaction = function (storeNames, mode) {
        if (this.closePending) {
            throw new InvalidStateError('Connection closed');
        }

        if (!Array.isArray(storeNames)) {
            storeNames = [storeNames];
        }
        if (storeNames.length === 0 && mode !== 'versionchange') {
            throw new InvalidAccessError('No storeNames provided to transaction');
        }
        storeNames.forEach(function (storeName) {
            if (this.objectStoreNames.indexOf(storeName) < 0) {
                throw new NotFoundError('No objectStore named ' + storeName + ' in this database');
            }
        }.bind(this));

        mode = mode !== undefined ? mode : 'readonly';
        if (mode !== 'readonly' && mode !== 'readwrite' && mode !== 'versionchange') {
            throw new TypeError('Invalid mode: ' + mode);
        }

        var tx = new FDBTransaction(storeNames, mode);
        tx.db = this;
        this.transactions.push(tx);

        setImmediate(function () {
            tx.active = false;

            if (tx.oncomplete) {
                tx.oncomplete();
            }
        });

        return tx;
    };

    this.close = function () {
        this.closePending = true;
    };

    return this;
};