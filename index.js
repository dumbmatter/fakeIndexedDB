var FDBOpenRequest = require('./lib/FDBOpenRequest');
var FDBDatabase = require('./lib/FDBDatabase');
var fireEvent = require('./lib/fireEvent');

var databases = {};

var fndexedDB = {};

fndexedDB.open = function (name) {
    var request = new FDBOpenRequest();

    if (!databases.hasOwnProperty(name)) {
        databases[name] = new FDBDatabase();

        fireEvent('upgradeneeded', request, databases[name]);
    } else {
        fireEvent('success', request, databases[name]);
    }

    return request;
};

module.exports = fndexedDB;