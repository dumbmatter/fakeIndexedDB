'use strict';

var EventTarget = require('./EventTarget');

module.exports = function () {
    this.result = null;
    this.error = null;
    this.source = null;
    this.transaction = null;
    this.readyState = 'pending';
    this.onsuccess = null;
    this.onerror = null;

    EventTarget.call(this);

    return this;
};