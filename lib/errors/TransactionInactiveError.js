'use strict';

var util = require('util');

function TransactionInactiveError(message) {
    this.name = this.constructor.name;
    this.message = message !== undefined ? message : 'A request was placed against a transaction which is currently not active, or which is finished.';
    Error.captureStackTrace(this);
}
util.inherits(TransactionInactiveError, Error);

module.exports = TransactionInactiveError;