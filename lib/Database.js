'use strict';

// http://www.w3.org/TR/IndexedDB/#dfn-database
module.exports = function (name, version) {
    this.deletePending = false;
    this.transactions = [];
    this.rawObjectStores = {};
    this.connections = [];

    this.name = name;
    this.version = version;
};