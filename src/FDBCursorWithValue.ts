import FDBCursor from "./FDBCursor";
import {FDBCursorDirection, Value} from "./lib/types";

class FDBCursorWithValue extends FDBCursor {
    public value: Value = undefined;

    constructor(source: any, range: any, direction?: FDBCursorDirection, request?: any) {
        super(source, range, direction, request);
    }

    public toString() {
        return "[object IDBCursorWithValue]";
    }
}

export default FDBCursorWithValue;
