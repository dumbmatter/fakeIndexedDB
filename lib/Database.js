'use strict';

// http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#dfn-database
module.exports = function (options) {
    this.deletePending = false;
    this.transactions = [];
    this.rawObjectStores = {};
    this.connections = [];

    this.name = options.name;
    this.version = options.version;
    this.recordStoreAdapter = options.recordStoreAdapter;

    this.processTransactions = function () {
        setImmediate(function () {
            var anyRunning = this.transactions.some(function (transaction) {
                return transaction._started && !transaction._finished;
            });

            if (!anyRunning) {
                var next = this.transactions.find(function (transaction) {
                    return !transaction._started && !transaction._finished;
                });

                if (next) {
                    next._start();

                    next.addEventListener('complete', this.processTransactions.bind(this));
                    next.addEventListener('abort', this.processTransactions.bind(this));
                }
            }
        }.bind(this));
    };
};