import { DataError } from "./errors.js";
import valueToKey from "./valueToKey.js";

const getType = (x: any) => {
    if (typeof x === "number") {
        return "Number";
    }
    if (Object.prototype.toString.call(x) === "[object Date]") {
        return "Date";
    }
    if (Array.isArray(x)) {
        return "Array";
    }
    if (typeof x === "string") {
        return "String";
    }
    if (x instanceof ArrayBuffer) {
        return "Binary";
    }

    throw new DataError();
};

/**
 * Compare two already-normalized IndexedDB keys (i.e. keys that have already
 * been run through `valueToKey`). Use this on internal/hot paths where keys
 * are known to be valid to avoid redundant `valueToKey` conversions.
 *
 * For comparing raw/untrusted input, use the default-exported `cmp` instead —
 * it validates and normalizes both arguments before comparing.
 */
export const cmpKeys = (first: any, second: any): -1 | 0 | 1 => {
    const t1 = getType(first);
    const t2 = getType(second);

    if (t1 !== t2) {
        if (t1 === "Array") {
            return 1;
        }
        if (
            t1 === "Binary" &&
            (t2 === "String" || t2 === "Date" || t2 === "Number")
        ) {
            return 1;
        }
        if (t1 === "String" && (t2 === "Date" || t2 === "Number")) {
            return 1;
        }
        if (t1 === "Date" && t2 === "Number") {
            return 1;
        }
        return -1;
    }

    // This block is effectively the same as the array comparison, but we avoid expensive `cmpKey` calls
    if (t1 === "Binary") {
        const firstBytes = new Uint8Array(first);
        const secondBytes = new Uint8Array(second);
        const firstLen = firstBytes.length;
        const secondLen = secondBytes.length;
        const length = Math.min(firstLen, secondLen);
        for (let i = 0; i < length; i++) {
            if (firstBytes[i] > secondBytes[i]) {
                return 1;
            }
            if (firstBytes[i] < secondBytes[i]) {
                return -1;
            }
        }

        if (firstLen > secondLen) {
            return 1;
        }
        if (firstLen < secondLen) {
            return -1;
        }
        return 0;
    }

    if (t1 === "Array") {
        const length = Math.min(first.length, second.length);
        for (let i = 0; i < length; i++) {
            const result = cmpKeys(first[i], second[i]);

            if (result !== 0) {
                return result;
            }
        }

        if (first.length > second.length) {
            return 1;
        }
        if (first.length < second.length) {
            return -1;
        }
        return 0;
    }

    if (t1 === "Date") {
        if (first.getTime() === second.getTime()) {
            return 0;
        }
    } else {
        if (first === second) {
            return 0;
        }
    }

    return first > second ? 1 : -1;
};

// https://w3c.github.io/IndexedDB/#compare-two-keys
const cmp = (first: any, second: any): -1 | 0 | 1 => {
    if (second === undefined) {
        throw new TypeError();
    }

    return cmpKeys(valueToKey(first), valueToKey(second));
};

export default cmp;
