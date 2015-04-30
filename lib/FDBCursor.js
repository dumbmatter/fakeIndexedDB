'use strict';

var clone = require('structured-clone');
var FDBObjectStore = require('./FDBObjectStore');
var DataError = require('./errors/DataError');
var InvalidStateError = require('./errors/InvalidStateError');
var ReadOnlyError = require('./errors/ReadOnlyError');
var TransactionInactiveError = require('./errors/TransactionInactiveError');
var cmp = require('./cmp');
var validateKey = require('./validateKey');

function getEffectiveObjectStore(cursor) {
    if (cursor.source.hasOwnProperty('_rawIndex')) {
        return cursor.source.objectStore;
    }
    return cursor.source;
}

function getEffectiveKey(cursor) {
    if (cursor.source.hasOwnProperty('_rawIndex')) {
        return cursor._rawIndex.getValue(cursor._position);
    }
    return cursor._position;
}

// http://www.w3.org/TR/IndexedDB/#cursor
module.exports = function (source, range, direction, request) {
    this._gotValue = false;
    this._range = range;
    this._position = undefined; // Key of previously returned record
    this._objectStorePosition = undefined;
    this._request = request;

    this.source = source;
    this.direction = direction !== undefined ? direction : 'next';
    this.key = undefined;
    this.primaryKey = undefined;
    this.value = undefined;

    // http://www.w3.org/TR/IndexedDB/#dfn-steps-for-iterating-a-cursor
    this._iterate = function (key) {
        var sourceIsObjectStore = this.source instanceof FDBObjectStore.constructor;

        var effectiveObjectStore = getEffectiveObjectStore(this);

        var foundRecord;
        if (this.direction === "next") {
            foundRecord = effectiveObjectStore._rawObjectStore.records.find(function (record) {
                if (key !== undefined) {
                    if (cmp(record.key, key) === -1) {
                        return false;
                    }
                }
                if (this._position !== undefined && sourceIsObjectStore) {
                    if (cmp(record.key, this._position) !== 1) {
                        return false;
                    }
                }
                if (this._position !== undefined && !sourceIsObjectStore) {
                    var cmpResult = cmp(record.key, this._position);
                    if (cmpResult === -1) {
                        return false;
                    }
                    if (cmpResult === 0 && cmp(record.value, this._objectStorePosition) !== 1) {
                        return false;
                    }
                }
                return true;
// If range is defined, the record's key is in range.
            }.bind(this));
        } else if (this.direction === "nextunique") {
            foundRecord = effectiveObjectStore._rawObjectStore.records.find(function (record) {
                if (key !== undefined) {
                    if (cmp(record.key, key) === -1) {
                        return false;
                    }
                }
                if (this._position !== undefined) {
                    if (cmp(record.key, this._position) !== 1) {
                        return false;
                    }
                }
                return true;
// If range is defined, the record's key is in range.
            }.bind(this));
        } else if (this.direction === "prev") {
            foundRecord = effectiveObjectStore._rawObjectStore.records.reverse().find(function (record) {
                if (key !== undefined) {
                    if (cmp(record.key, key) === 1) {
                        return false;
                    }
                }
                if (this._position !== undefined && sourceIsObjectStore) {
                    if (cmp(record.key, this._position) !== -1) {
                        return false;
                    }
                }
                if (this._position !== undefined && !sourceIsObjectStore) {
                    var cmpResult = cmp(record.key, this._position);
                    if (cmpResult === 1) {
                        return false;
                    }
                    if (cmpResult === 0 && cmp(record.value, this._objectStorePosition) !== -1) {
                        return false;
                    }
                }
                return true;
// If range is defined, the record's key is in range.
            }.bind(this));
            this.source._rawObjectStore.records.reverse();
        } else if (this.direction === "prevunique") {
            foundRecord = effectiveObjectStore._rawObjectStore.records.reverse().find(function (record) {
                if (key !== undefined) {
                    if (cmp(record.key, key) === 1) {
                        return false;
                    }
                }
                if (this._position !== undefined) {
                    if (cmp(record.key, this._position) !== -1) {
                        return false;
                    }
                }
                return true;
// If range is defined, the record's key is in range.
            }.bind(this));
            effectiveObjectStore._rawObjectStore.records.reverse();
        }

        var result;
        if (!foundRecord) {
            this.key = undefined;
            if (!sourceIsObjectStore) { this._objectStorePosition = undefined; }
            this.value = undefined;
            result = null;
        } else {
            this._position = foundRecord.key;
            if (!sourceIsObjectStore) { this._objectStorePosition = foundRecord.value; }
            this.key = foundRecord.key;
            this.value = clone(foundRecord.value);
            this._gotValue = true;
            result = this;
        }

        return result;
    };

    this.update = function () {
        throw new Error('Not implemented');
    };

    this.advance = function () {
        throw new Error('Not implemented');
    };

    // http://www.w3.org/TR/IndexedDB/#widl-IDBCursor-continue-void-any-key
    this.continue = function (key) {
        var effectiveObjectStore = getEffectiveObjectStore(this);
        var transaction = effectiveObjectStore.transaction;

        if (!transaction._active) {
            throw new TransactionInactiveError();
        }

        if (effectiveObjectStore._rawObjectStore.deleted) {
            throw new InvalidStateError();
        }

        if (!this._gotValue) {
            throw new InvalidStateError();
        }

        if (key !== undefined) {
            validateKey(key);

            var cmpResult = cmp(key, this._position);

            if ((cmpResult <= 0 && (this.direction === 'next' || this.direction === 'nextunique')) ||
                (cmpResult >= 0 && (this.direction === 'prev' || this.direction === 'prevunique'))) {
                throw new DataError();
            }
        }

        this._request.readyState = 'pending';
        this.source.transaction._execRequestAsync(this.source, this._iterate.bind(this, key), this._request);

        this._gotValue = false;
    };

    this.delete = function () {
        var effectiveObjectStore = getEffectiveObjectStore(this);
        var effectiveKey = getEffectiveKey(this);
        var transaction = effectiveObjectStore.transaction;

        if (transaction.mode === 'readonly') {
            throw new ReadOnlyError();
        }

        if (!transaction._active) {
            throw new TransactionInactiveError();
        }

        if (effectiveObjectStore._rawObjectStore.deleted) {
            throw new InvalidStateError();
        }

        if (!this._gotValue || !this.value) {
            throw new InvalidStateError();
        }

        return transaction._execRequestAsync(this, effectiveObjectStore._rawObjectStore.deleteRecord.bind(effectiveObjectStore._rawObjectStore, effectiveKey));
    };
};