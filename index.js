var FDBOpenDBRequest = require('./lib/FDBOpenDBRequest');
var FDBDatabase = require('./lib/FDBDatabase');
var fireEvent = require('./lib/fireEvent');

var databases = {};

var fndexedDB = {};

fndexedDB.open = function (name) {
    var request = new FDBOpenDBRequest();

    if (!databases.hasOwnProperty(name)) {
        databases[name] = new FDBDatabase();

        fireEvent('upgradeneeded', request, databases[name]);
    } else {
        fireEvent('success', request, databases[name]);
    }

    return request;
};

module.exports = fndexedDB;