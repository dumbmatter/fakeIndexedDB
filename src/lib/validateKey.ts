import {DataError} from "./errors";

// http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#dfn-valid-key
const validateKey = (key: any, seen?: Set<object>) => {
    if (typeof key === "number") {
        if (isNaN(key)) {
            throw new DataError();
        }
    } else if (key instanceof Date) {
        if (isNaN(key.valueOf())) {
            throw new DataError();
        }
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
            return validateKey(item, seen);
        });
        if (count !== key.length) {
            throw new DataError();
        }
        return key;
    } else if (typeof key !== "string") {
        throw new DataError();
    }

    return key;
};

export default validateKey;
