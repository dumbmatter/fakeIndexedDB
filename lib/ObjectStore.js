var KeyGenerator = require('./KeyGenerator');

// http://www.w3.org/TR/IndexedDB/#dfn-object-store
module.exports = function (name, keyPath, autoIncrement) {
    this.records = [];
    this.keyGenerator = autoIncrement === true ? new KeyGenerator() : null;

    this.name = name;
    this.keyPath = keyPath;
    this.indexNames = [];
    this.autoIncrement = autoIncrement;
};