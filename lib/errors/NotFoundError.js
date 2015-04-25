var util = require('util');

function NotFoundError(message) {
    this.name = this.constructor.name;
    this.message = message;
    Error.captureStackTrace(this);
}
util.inherits(NotFoundError, Error);

module.exports = NotFoundError;