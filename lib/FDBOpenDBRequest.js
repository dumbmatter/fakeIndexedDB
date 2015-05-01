'use strict';

var util = require('util');
var FDBRequest = require('./FDBRequest');

function FDBOpenDBRequest() {
    FDBRequest.call(this);

    this.onupgradeneeded = null;
    this.onblocked = null;
}
util.inherits(FDBOpenDBRequest, FDBRequest);

module.exports = FDBOpenDBRequest;