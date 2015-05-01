'use strict';

var util = require('util');
var FDBCursor = require('./FDBCursor');

function FDBCursorWithValue() {
    FDBCursor.apply(this, arguments);

    this.value = undefined;
}
util.inherits(FDBCursorWithValue, FDBCursor);

module.exports = FDBCursorWithValue;