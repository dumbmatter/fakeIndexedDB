const {DataError} = require('./lib/errors');
const cmp = require('./lib/cmp');
const validateKey = require('./lib/validateKey');

// http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#range-concept
class FDBKeyRange {
    constructor() {
        this.lower = undefined;
        this.upper = undefined;
        this.lowerOpen = undefined;
        this.upperOpen = undefined;
    }

    static only(value) {
        if (value === undefined) { throw new TypeError(); }
        validateKey(value);
        const keyRange = new FDBKeyRange();
        keyRange.lower = value;
        keyRange.upper = value;
        keyRange.lowerOpen = false;
        keyRange.upperOpen = false;
        return keyRange;
    }

    static lowerBound(lower, open) {
        if (lower === undefined) { throw new TypeError(); }
        validateKey(lower);
        const keyRange = new FDBKeyRange();
        keyRange.lower = lower;
        keyRange.lowerOpen = open === true ? true : false;
        keyRange.upperOpen = true;
        return keyRange;
    }

    static upperBound(upper, open) {
        if (upper === undefined) { throw new TypeError(); }
        validateKey(upper);
        const keyRange = new FDBKeyRange();
        keyRange.upper = upper;
        keyRange.lowerOpen = true;
        keyRange.upperOpen = open === true ? true : false;
        return keyRange;
    }

    static bound(lower, upper, lowerOpen, upperOpen) {
        if (lower === undefined || upper === undefined) { throw new TypeError(); }

        const cmpResult = cmp(lower, upper);
        if (cmpResult === 1 || (cmpResult === 0 && (lowerOpen || upperOpen))) {
            throw new DataError();
        }

        validateKey(lower);
        validateKey(upper);
        const keyRange = new FDBKeyRange();
        keyRange.lower = lower;
        keyRange.upper = upper;
        keyRange.lowerOpen = lowerOpen === true ? true : false;
        keyRange.upperOpen = upperOpen === true ? true : false;
        return keyRange;
    }

    static check(keyRange, key) {
        if (keyRange.lower !== undefined) {
            const cmpResult = cmp(keyRange.lower, key);

            if (cmpResult === 1 || (cmpResult === 0 && keyRange.lowerOpen)) {
                return false;
            }
        }
        if (keyRange.upper !== undefined) {
            const cmpResult = cmp(keyRange.upper, key);

            if (cmpResult === -1 || (cmpResult === 0 && keyRange.upperOpen)) {
                return false;
            }
        }
        return true;
    }

    toString() {
        return '[object IDBKeyRange]';
    }
}

module.exports = FDBKeyRange;
