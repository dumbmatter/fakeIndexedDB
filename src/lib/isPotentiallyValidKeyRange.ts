import FDBKeyRange from "../FDBKeyRange.js";
import { FDBGetAllOptions, Key } from "./types.js";

// https://www.w3.org/TR/IndexedDB/#is-a-potentially-valid-key-range
const isPotentiallyValidKeyRange = (
    value: any,
): value is Exclude<
    FDBKeyRange | Key | FDBGetAllOptions,
    FDBKeyRange | Key
> => {
    // Many of these conditions recapitulate the same conditions in `valueToKeyRange.ts`
    return (
        // FDBKeyRange
        value instanceof FDBKeyRange ||
        // null/undefined - nullDisallowedFlag=false is assumed here
        value === null ||
        value === undefined ||
        // Number
        typeof value === "number" ||
        // Date
        Object.prototype.toString.call(value) === "[object Date]" ||
        // string
        typeof value === "string" ||
        // buffer source type
        value instanceof ArrayBuffer ||
        (typeof SharedArrayBuffer !== "undefined" &&
            value instanceof SharedArrayBuffer) ||
        (typeof ArrayBuffer !== "undefined" &&
            ArrayBuffer.isView &&
            ArrayBuffer.isView(value)) ||
        // array exotic type
        Array.isArray(value)
    );
};

export default isPotentiallyValidKeyRange;
