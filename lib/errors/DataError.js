'use strict';

var util = require('util');

function DataError(message) {
    this.name = this.constructor.name;
    this.message = message !== undefined ? message : 'Data provided to an operation does not meet requirements.';
    Error.captureStackTrace(this);
}
util.inherits(DataError, Error);

module.exports = DataError;