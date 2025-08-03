import FDBKeyRange from "../FDBKeyRange.js";
import { FDBCursorDirection, FDBGetAllOptions, Key } from "./types.js";
import isPotentiallyValidKeyRange from "./isPotentiallyValidKeyRange.js";
import enforceRange from "./enforceRange.js";

// https://www.w3.org/TR/IndexedDB/#create-request-to-retrieve-multiple-items
const extractGetAllOptions = (
    queryOrOptions: FDBKeyRange | Key | FDBGetAllOptions,
    count: number | undefined,
    numArguments: number,
) => {
    let query: FDBKeyRange | Key;
    let direction: FDBCursorDirection | undefined;

    if (isPotentiallyValidKeyRange(queryOrOptions)) {
        // queryOrOptions is FDBKeyRange | Key
        query = queryOrOptions;
        if (numArguments > 1 && count !== undefined) {
            count = enforceRange(count, "unsigned long");
        }
    } else {
        // queryOrOptions is FDBGetAllOptions
        const getAllOptions = queryOrOptions as FDBGetAllOptions;
        if (getAllOptions.query !== undefined) {
            query = getAllOptions.query;
        }
        if (getAllOptions.count !== undefined) {
            count = enforceRange(getAllOptions.count, "unsigned long");
        }
        if (getAllOptions.direction !== undefined) {
            direction = getAllOptions.direction;
        }
    }
    return {
        query,
        count,
        direction,
    };
};

export default extractGetAllOptions;
