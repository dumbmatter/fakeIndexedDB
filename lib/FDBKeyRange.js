var DataError = require('./errors/DataError');
var TypeError = require('./errors/TypeError');
var cmp = require('./cmp');
var validateKey = require('./validateKey');

// http://www.w3.org/TR/IndexedDB/#range-concept
function FDBKeyRange() {
    this.lower = undefined;
    this.upper = undefined;
    this.lowerOpen = undefined;
    this.upperOpen = undefined;

    this._check = function (key) {
        if (this.lower !== undefined) {
            var cmpResult = cmp(this.lower, key);

            if (cmpResult === 1 || (cmpResult === 0 && !this.lowerOpen)) {
                return false;
            }
        }
        if (this.upper !== undefined) {
            var cmpResult = cmp(this.upper, key);

            if (cmpResult === -1 || (cmpResult === 0 && !this.upperOpen)) {
                return false;
            }
        }
        return true;
    };
}

FDBKeyRange.only = function (value) {
    if (value === undefined) { throw new TypeError(); }
    validateKey(value);
    var keyRange = new FDBKeyRange();
    keyRange.lower = value;
    keyRange.upper = value;
    return keyRange;
};

FDBKeyRange.lowerBound = function (lower, open) {
    if (lower === undefined) { throw new TypeError(); }
    validateKey(lower);
    var keyRange = new FDBKeyRange();
    keyRange.lower = lower;
    keyRange.lowerOpen = open === true ? true : false;
    keyRange.upperOpen = true;
    return keyRange;
};

FDBKeyRange.upperBound = function (upper, open) {
    if (upper === undefined) { throw new TypeError(); }
    validateKey(upper);
    var keyRange = new FDBKeyRange();
    keyRange.upper = upper;
    keyRange.lowerOpen = true;
    keyRange.upperOpen = open === true ? true : false;
    return keyRange;
};

FDBKeyRange.bound = function (lower, upper, lowerOpen, upperOpen) {
    if (lower === undefined || upper === undefined) { throw new TypeError(); }

    var cmpResult = cmp(lower, upper);
    if (cmpResult === 1 || (cmpResult === 0 && (lowerOpen || upperOpen))) {
        throw new DataError();
    }

    validateKey(lower);
    validateKey(upper);
    var keyRange = new FDBKeyRange();
    keyRange.lower = lower;
    keyRange.upper = upper;
    keyRange.lowerOpen = lowerOpen === true ? true : false;
    keyRange.upperOpen = upperOpen === true ? true : false;
    return keyRange;
};

module.exports = FDBKeyRange;