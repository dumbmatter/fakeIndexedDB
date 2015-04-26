'use strict';

var Event = require('./Event');

module.exports = function () {
    this.oldVersion = null;
    this.newVersion = null;

    Event.call(this);

    return this;
};