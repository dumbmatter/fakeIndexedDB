'use strict';

// http://www.w3.org/TR/IndexedDB/#idl-def-IDBIndex
module.exports = function () {
    this._records = [];

    this.name = undefined;
    this.objectStore = undefined;
    this.keyPath = undefined;
    this.multiEntry = undefined;
    this.unique = undefined;

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