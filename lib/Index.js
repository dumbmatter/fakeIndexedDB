'use strict';

// http://www.w3.org/TR/IndexedDB/#dfn-index
module.exports = function (name, objectStore, keyPath, multiEntry, unique) {
    this.records = [];

    this.name = name;
    this.objectStore = objectStore;
    this.keyPath = keyPath;
    this.multiEntry = multiEntry;
    this.unique = unique;
};