import FDBKeyRange from "../FDBKeyRange";
import {DataError} from "./errors";
import validateKey from "./validateKey";

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

    const key = validateKey(value);

    return FDBKeyRange.only(key);
};

export default valueToKeyRange;
