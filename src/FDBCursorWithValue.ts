import FDBCursor from "./FDBCursor";
import {
    CursorRange,
    CursorSource,
    FDBCursorDirection,
    Value,
} from "./lib/types";

class FDBCursorWithValue extends FDBCursor {
    public value: Value = undefined;

    constructor(
        source: CursorSource,
        range: CursorRange,
        direction?: FDBCursorDirection,
        request?: any,
    ) {
        super(source, range, direction, request);
    }

    public toString() {
        return "[object IDBCursorWithValue]";
    }
}

export default FDBCursorWithValue;
