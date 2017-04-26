import {DataError} from "./errors";

// https://w3c.github.io/IndexedDB/#convert-a-value-to-a-key
const valueToKey = (key: any, seen?: Set<object>) => {
    if (typeof key === "number") {
        if (isNaN(key)) {
            throw new DataError();
        }
        return key;
    } else if (key instanceof Date) {
        const ms = key.valueOf();
        if (isNaN(ms)) {
            throw new DataError();
        }
        return new Date(ms);
    } else if (typeof key === "string") {
        return key;
    } else if (
        (key instanceof ArrayBuffer) ||
        (typeof ArrayBuffer !== "undefined" && ArrayBuffer.isView && ArrayBuffer.isView(key))
    ) {
        if (key instanceof ArrayBuffer) {
            return new Uint8Array(key).buffer;
        }
        return new Uint8Array(key.buffer).buffer;
    } else if (Array.isArray(key)) {
        seen = seen !== undefined ? seen : new Set();
        for (const x of key) {
            // Only need to test objects, because otherwise [0, 0] shows up as circular
            if (typeof x === "object" && seen.has(x)) {
                throw new DataError();
            }
            seen.add(x);
        }

        let count = 0;
        key = key.map((item) => {
            count += 1;
            return valueToKey(item, seen);
        });
        if (count !== key.length) {
            throw new DataError();
        }
        return key;
    } else {
        throw new DataError();
    }
};

export default valueToKey;
