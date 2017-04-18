const FDBCursor = require('./FDBCursor');

class FDBCursorWithValue extends FDBCursor {
    constructor(source, range, direction, request) {
        super(source, range, direction, request);

        this.value = undefined;
    }

    toString() {
        return '[object IDBCursorWithValue]';
    }
}

module.exports = FDBCursorWithValue;