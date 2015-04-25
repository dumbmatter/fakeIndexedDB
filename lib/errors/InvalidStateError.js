var util = require('util');

function InvalidStateError(message) {
    this.name = this.constructor.name;
    this.message = message;
    Error.captureStackTrace(this);
}
util.inherits(InvalidStateError, Error);

module.exports = InvalidStateError;