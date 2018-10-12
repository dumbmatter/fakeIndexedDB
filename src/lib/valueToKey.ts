import { DataError } from "./errors";
import { Key } from "./types";

// https://w3c.github.io/IndexedDB/#convert-a-value-to-a-input
const valueToKey = (input: any, seen?: Set<object>): Key | Key[] => {
    if (typeof input === "number") {
        if (isNaN(input)) {
            throw new DataError();
        }
        return input;
    } else if (input instanceof Date) {
        const ms = input.valueOf();
        if (isNaN(ms)) {
            throw new DataError();
        }
        return new Date(ms);
    } else if (typeof input === "string") {
        return input;
    } else if (
        input instanceof ArrayBuffer ||
        (typeof ArrayBuffer !== "undefined" &&
            ArrayBuffer.isView &&
            ArrayBuffer.isView(input))
    ) {
        if (input instanceof ArrayBuffer) {
            return new Uint8Array(input).buffer;
        }
        return new Uint8Array(input.buffer).buffer;
    } else if (Array.isArray(input)) {
        if (seen === undefined) {
            seen = new Set();
        } else if (seen.has(input)) {
            throw new DataError();
        }
        seen.add(input);

        const keys = [];
        for (let i = 0; i < input.length; i++) {
            const hop = input.hasOwnProperty(i);
            if (!hop) {
                throw new DataError();
            }
            const entry = input[i];
            const key = valueToKey(entry, seen);
            keys.push(key);
        }
        return keys;
    } else {
        throw new DataError();
    }
};

export default valueToKey;
