var util = require('util');

function InvalidAccessError(message) {
    this.name = this.constructor.name;
    this.message = message !== undefined ? message : 'An invalid operation was performed on an object. For example transaction creation attempt was made, but an empty scope was provided.';
    Error.captureStackTrace(this);
}
util.inherits(InvalidAccessError, Error);

module.exports = InvalidAccessError;