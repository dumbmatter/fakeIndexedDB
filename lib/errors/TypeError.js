'use strict';

var util = require('util');

function TypeError(message) {
    this.name = this.constructor.name;
    this.message = message;
    Error.captureStackTrace(this);
}
util.inherits(TypeError, Error);

module.exports = TypeError;