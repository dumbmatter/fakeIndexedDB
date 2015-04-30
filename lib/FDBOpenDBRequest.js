'use strict';

var FDBRequest = require('./FDBRequest');

module.exports = function () {
    this.onupgradeneeded = null;
    this.onblocked = null;

    FDBRequest.call(this);
};