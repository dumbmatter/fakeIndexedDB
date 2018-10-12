import cmp from "./lib/cmp";
import { DataError } from "./lib/errors";
import { Key } from "./lib/types";
import valueToKey from "./lib/valueToKey";

// http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#range-concept
class FDBKeyRange {
    public static only(value: Key) {
        if (arguments.length === 0) {
            throw new TypeError();
        }
        value = valueToKey(value);
        return new FDBKeyRange(value, value, false, false);
    }

    public static lowerBound(lower: Key, open: boolean = false) {
        if (arguments.length === 0) {
            throw new TypeError();
        }
        lower = valueToKey(lower);
        return new FDBKeyRange(lower, undefined, open, true);
    }

    public static upperBound(upper: Key, open: boolean = false) {
        if (arguments.length === 0) {
            throw new TypeError();
        }
        upper = valueToKey(upper);
        return new FDBKeyRange(undefined, upper, true, open);
    }

    public static bound(
        lower: Key,
        upper: Key,
        lowerOpen: boolean = false,
        upperOpen: boolean = false,
    ) {
        if (arguments.length < 2) {
            throw new TypeError();
        }

        const cmpResult = cmp(lower, upper);
        if (cmpResult === 1 || (cmpResult === 0 && (lowerOpen || upperOpen))) {
            throw new DataError();
        }

        lower = valueToKey(lower);
        upper = valueToKey(upper);
        return new FDBKeyRange(lower, upper, lowerOpen, upperOpen);
    }

    public readonly lower: Key | undefined;
    public readonly upper: Key | undefined;
    public readonly lowerOpen: boolean;
    public readonly upperOpen: boolean;

    constructor(
        lower: Key | undefined,
        upper: Key | undefined,
        lowerOpen: boolean,
        upperOpen: boolean,
    ) {
        this.lower = lower;
        this.upper = upper;
        this.lowerOpen = lowerOpen;
        this.upperOpen = upperOpen;
    }

    // https://w3c.github.io/IndexedDB/#dom-idbkeyrange-includes
    public includes(key: Key) {
        if (arguments.length === 0) {
            throw new TypeError();
        }
        key = valueToKey(key);

        if (this.lower !== undefined) {
            const cmpResult = cmp(this.lower, key);

            if (cmpResult === 1 || (cmpResult === 0 && this.lowerOpen)) {
                return false;
            }
        }
        if (this.upper !== undefined) {
            const cmpResult = cmp(this.upper, key);

            if (cmpResult === -1 || (cmpResult === 0 && this.upperOpen)) {
                return false;
            }
        }
        return true;
    }

    public toString() {
        return "[object IDBKeyRange]";
    }
}

export default FDBKeyRange;
