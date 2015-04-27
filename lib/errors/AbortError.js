'use strict';

var util = require('util');

function AbortError(message) {
    this.name = this.constructor.name;
    this.message = message !== undefined ? message : ' A request was aborted, for example through a call to IDBTransaction.abort.';
    Error.captureStackTrace(this);
}
util.inherits(AbortError, Error);

module.exports = AbortError;