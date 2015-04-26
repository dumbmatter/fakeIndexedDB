// http://www.w3.org/TR/IndexedDB/#idl-def-IDBIndex
module.exports = function () {
    this._records = [];

    this.name = undefined;
    this.objectStore = undefined;
    this.keyPath = undefined;
    this.multiEntry = undefined;
    this.unique = undefined;

    this.openCursor = function (range, direction) {
        throw new Error('Not implemented');
    };

    this.openKeyCursor = function (range, direction) {
        throw new Error('Not implemented');
    };

    this.get = function (key) {
        throw new Error('Not implemented');
    };

    this.getKey = function (key) {
        throw new Error('Not implemented');
    };

    this.count = function (key) {
        throw new Error('Not implemented');
    };
};