'use strict';

var FDBKeyRange = require('../FDBKeyRange');
var cmp = require('../cmp');

function Adapter() {
    this.records = [];
}

Adapter.prototype.get = function (key) {
    if (key instanceof FDBKeyRange) {
        return this.records.find(function (record) {
            return FDBKeyRange.check(key, record.key);
        });
    }

    return this.records.find(function (record) {
        return cmp(record.key, key) === 0;
    });
};

Adapter.prototype.getAll = function () {
    return this.records;
};

Adapter.prototype.add = function (newRecord) {
    var i;

    // Find where to put it so it's sorted by key
    i = this.records.findIndex(function (record) {
        return cmp(record.key, newRecord.key) === 1;
    });
    if (i === -1) {
        i = this.records.length;
    }
    this.records.splice(i, 0, newRecord);
};

Adapter.prototype.delete = function (range) {
    var deletedRecords = [];

    this.records = this.records.filter(function (record) {
        var shouldDelete = FDBKeyRange.check(range, record.key);

        if (shouldDelete) {
            deletedRecords.push(record);
        }

        return !shouldDelete;
    });

    return deletedRecords;
};

Adapter.prototype.clear = function () {
    var deletedRecords = this.records;

    this.records = [];

    return deletedRecords;
};

module.exports = Adapter;