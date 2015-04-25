var clone = require('structured-clone');
var FDBObjectStore = require('./FDBObjectStore');
var FDBRequest = require('./FDBRequest');
var cmp = require('./cmp');
var fireEvent = require('./fireEvent');

// http://www.w3.org/TR/IndexedDB/#dfn-steps-for-iterating-a-cursor
function iterateOverCursor(cursor, key) {
    var sourceIsObjectStore = cursor.source instanceof FDBObjectStore.constructor;

    var foundRecord = cursor.source._records.find(function (record) {
        if (key !== undefined) {
            if (cmp(record.key, key) !== 1) {
                return false;
            }
        }
        if (cursor._position !== undefined && sourceIsObjectStore) {
            if (cmp(record.key, cursor._position) !== 1) {
                return false;
            }
        }
        return true;
// If position is defined, and source is an index, the record's key is equal to position and the record's value is greater than object store position or the record's key is greater than position.
// If range is defined, the record's key is in range. 
    });

    var result;
    if (!foundRecord) {
        cursor.key = undefined;
// If source is an index, set cursor's object store position to undefined.
        cursor.value = undefined;
        result = null;
    } else {
        cursor._position = foundRecord.key;
// If source is an index, set cursor's object store position to found record's value.
        cursor.key = foundRecord.key;
        cursor.value = clone(foundRecord.value);
        cursor._gotValue = true;
        result = cursor;
    }

    fireEvent('success', cursor._request, result);
}

// http://www.w3.org/TR/IndexedDB/#cursor
module.exports = function (source, range, direction, request) {
    if (range || direction) { throw new Error('Not implemented'); }
    this._gotValue = false;
    this._range = range;
    this._position = undefined; // Key of previously returned record
    this._request = request;

    this.source = source;
    this.direction = direction !== undefined ? direction : 'next';
    this.key = undefined;
    this.primaryKey = undefined;
    this.value = undefined;

    this.update = function () {
        throw new Error('Not implemented');
    };

    this.advance = function () {
        throw new Error('Not implemented');
    };

    // http://www.w3.org/TR/IndexedDB/#cursor-iteration-operation
    this.continue = function (key) {
        if (key !== undefined) { throw new Error('Not implemented'); }
        iterateOverCursor(this, key);

        this._gotValue = false;
    };

    this.delete = function () {
        throw new Error('Not implemented');
    };
};