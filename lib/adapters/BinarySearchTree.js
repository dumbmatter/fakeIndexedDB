'use strict';

var AVLTree = require('binary-search-tree').AVLTree;
var FDBKeyRange = require('../FDBKeyRange');

var DUMMY_HUGE_VALUE = [[[[[[[[[[1]]]]]]]]]];

function keyRangeToBounds(keyRange) {
    var bounds = {};
    if (keyRange.lower !== undefined && keyRange.lowerOpen) {
        bounds.$gt = {key: keyRange.lower};
    } else if (keyRange.lower !== undefined) {
        bounds.$gte = {key: keyRange.lower};
    }

    if (keyRange.upper !== undefined && keyRange.upperOpen) {
        bounds.$lt = {key: keyRange.upper, value: DUMMY_HUGE_VALUE};
    } else if (keyRange.upper !== undefined) {
        bounds.$lte = {key: keyRange.upper, value: DUMMY_HUGE_VALUE};
    }

    return bounds;
}

function RecordStore(options) {
    this.options = options;
    this.tree = new AVLTree(this.options);
}

RecordStore.prototype.get = function (key) {
    return this.getAll(key)[0];
};

RecordStore.prototype.getAll = function (key) {
    if (key === undefined) {
        return this.tree.betweenBounds({});
    }

    if (key instanceof FDBKeyRange) {
        var bounds = keyRangeToBounds(key);
        return this.tree.betweenBounds(bounds);
    }

    //return this.tree.search({key: key});
    // Horrible hack to deal with the problem of getting all values from an Index matching key when there could be multiple values
    return this.tree.betweenBounds({$gte: {key: key}, $lte: {key: key, value: DUMMY_HUGE_VALUE}});
};

RecordStore.prototype.add = function (newRecord) {
    // Key needs both because Indexes use value in sorting
    // Value needs both for convenience in other functions here
    this.tree.insert(newRecord, newRecord);
};

RecordStore.prototype.delete = function (range) {
    var deletedRecords = this.getAll(range);

    deletedRecords.forEach(function (record) {
        this.tree.delete(record);
    }.bind(this));

    return deletedRecords;
};

RecordStore.prototype.clear = function () {
    var deletedRecords = this.getAll();

    this.tree = new AVLTree(this.options);

    return deletedRecords;
};

// Finds the first record within range where f returns true. Direction is either forward from lower bound ("next") or backwards from upper bound ("prev")
RecordStore.prototype.find = function (range, direction, f) {
    // The filters only makes things slower in this adapter, but it is here to ensure that `range` is actually properly defined, because other adapters will use it.
    var filteredRecords = this.getAll(range);

    if (direction === "prev") {
        // Like filteredRecords.find(f) but in reverse
        for (var i = filteredRecords.length - 1; i >= 0; i--) {
            if (f(filteredRecords[i])) {
                return filteredRecords[i];
            }
        }
    }

    return filteredRecords.find(f);
};

module.exports = RecordStore;