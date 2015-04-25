var clone = require('structured-clone');
var FDBRequest = require('./FDBRequest');
var fireEvent = require('./fireEvent');

module.exports = function (name, keyPath) {
    this.records = []; // FDB: to store data

    this.name = name;
    this.keyPath = keyPath;
    this.indexNames = [];
    this.transaction = null;
    this.autoIncrement = null;

    this.put = function (value, key) {
        var request = new FDBRequest();
        request.transaction = this.transaction;

        if (keyPath !== null && key !== undefined) {
            fireEvent('error', request, new Error('DataError'));
        }
        if (keyPath === null && key === undefined) {
            fireEvent('error', request, new Error('DataError'));
        }

        if (keyPath !== null) {
            key = value[keyPath];
        }

        var i = this.records.findIndex(function (record) {
            return record.key === key;
        });

        var newRecord = {
            key: key,
            value: clone(value)
        };

        if (i >= 0) {
            this.records[i] = newRecord;
        } else {
            this.records.push(newRecord);
        }

        fireEvent('success', request, newRecord.value);

        return request;
    };

    this.add = function () {
        throw new Error('Not implemented');
    };

    this.delete = function () {
        throw new Error('Not implemented');
    };

    this.get = function (key) {
        var value = this.records.find(function (record) {
            return record.key === key;
        }).value;

        var request = new FDBRequest();
        request.transaction = this.transaction;

        fireEvent('success', request, value);

        return request;
    };

    this.clear = function () {
        throw new Error('Not implemented');
    };

    this.openCursor = function () {
        throw new Error('Not implemented');
    };

    this.createIndex = function () {
        throw new Error('Not implemented');
    };

    this.index = function () {
        throw new Error('Not implemented');
    };

    this.deleteIndex = function () {
        throw new Error('Not implemented');
    };

    this.count = function () {
        throw new Error('Not implemented');
    };

    return this;
};