'use strict';

// http://www.w3.org/TR/IndexedDB/#idl-def-IDBIndex
module.exports = function (objectStore, index) {
    this._records = [];

    this.name = index.name;
    this.objectStore = objectStore;
    this.keyPath = index.keyPath;
    this.multiEntry = index.multiEntry;
    this.unique = index.unique;

    this.openCursor = function () {
        throw new Error('Not implemented');
    };

    this.openKeyCursor = function () {
        throw new Error('Not implemented');
    };

    this.get = function () {
        throw new Error('Not implemented');
    };

    this.getKey = function () {
        throw new Error('Not implemented');
    };

    this.count = function () {
        throw new Error('Not implemented');
    };
};