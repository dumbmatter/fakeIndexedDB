'use strict';

var Event = require('./Event');

module.exports = function (type, parameters) {
    parameters = parameters !== undefined ? parameters : {};
    this.oldVersion = parameters.oldVersion !== undefined ? parameters.oldVersion : 0;
    this.newVersion = parameters.newVersion !== undefined ? parameters.newVersion : null;

    Event.call(this, type);

    return this;
};