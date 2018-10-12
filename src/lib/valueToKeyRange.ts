import FDBKeyRange from "../FDBKeyRange";
import { DataError } from "./errors";
import valueToKey from "./valueToKey";

// http://w3c.github.io/IndexedDB/#convert-a-value-to-a-key-range
const valueToKeyRange = (value: any, nullDisallowedFlag: boolean = false) => {
    if (value instanceof FDBKeyRange) {
        return value;
    }

    if (value === null || value === undefined) {
        if (nullDisallowedFlag) {
            throw new DataError();
        }
        return new FDBKeyRange(undefined, undefined, false, false);
    }

    const key = valueToKey(value);

    return FDBKeyRange.only(key);
};

export default valueToKeyRange;
