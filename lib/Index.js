'use strict';

// http://www.w3.org/TR/IndexedDB/#dfn-index
module.exports = function (objectStore, name, keyPath, multiEntry, unique) {
    this.records = [];
    this._objectStore = objectStore;

    this.name = name;
    this.keyPath = keyPath;
    this.multiEntry = multiEntry;
    this.unique = unique;
};