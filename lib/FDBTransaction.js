module.exports = function (storeNames, mode) {
    this.scope = storeNames;
    this.active = true;
    this.requests = [];

    this.mode = mode;
    this.db = null;
    this.error = null;
    this.onabort = null;
    this.oncomplete = null;
    this.onerror = null;

    this.abort = function () {
        throw new Error('Not implemented');
    };

    this.objectStore = function (name) {
        if (this.scope.indexOf(name) < 0) {
            throw new Error('NotFoundError');
        }

        if (!this.active) {
            throw new Error('InvalidStateError');
        }

        return this.db.objectStores[name];
    };

    return this;
};