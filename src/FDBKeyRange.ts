import cmp from "./lib/cmp";
import {DataError} from "./lib/errors";
import {Key} from "./lib/types";
import validateKey from "./lib/validateKey";

// http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#range-concept
class FDBKeyRange {
    public static only(value: Key) {
        if (value === undefined) { throw new TypeError(); }
        validateKey(value);
        return new FDBKeyRange(value, value, false, false);
    }

    public static lowerBound(lower: Key, open: boolean = false) {
        if (lower === undefined) { throw new TypeError(); }
        validateKey(lower);
        return new FDBKeyRange(lower, undefined, open, true);
    }

    public static upperBound(upper: Key, open: boolean = false) {
        if (upper === undefined) { throw new TypeError(); }
        validateKey(upper);
        return new FDBKeyRange(undefined, upper, true, open);
    }

    public static bound(lower: Key, upper: Key, lowerOpen: boolean = false, upperOpen: boolean = false) {
        if (lower === undefined || upper === undefined) { throw new TypeError(); }

        const cmpResult = cmp(lower, upper);
        if (cmpResult === 1 || (cmpResult === 0 && (lowerOpen || upperOpen))) {
            throw new DataError();
        }

        validateKey(lower);
        validateKey(upper);
        return new FDBKeyRange(lower, upper, lowerOpen, upperOpen);
    }

    public static check(keyRange: FDBKeyRange, key: Key) {
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

    public readonly lower: Key | void;
    public readonly upper: Key | void;
    public readonly lowerOpen: boolean;
    public readonly upperOpen: boolean;

    constructor(lower: Key | void, upper: Key | void, lowerOpen: boolean, upperOpen: boolean) {
        this.lower = lower;
        this.upper = upper;
        this.lowerOpen = lowerOpen;
        this.upperOpen = upperOpen;
    }

    public toString() {
        return "[object IDBKeyRange]";
    }
}

export default FDBKeyRange;
