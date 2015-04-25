var util = require('util');

function InvalidAccessError(message) {
    this.name = this.constructor.name;
    this.message = message;
    Error.captureStackTrace(this);
}
util.inherits(InvalidAccessError, Error);

module.exports = InvalidAccessError;