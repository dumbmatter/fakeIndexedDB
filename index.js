var FDBOpenDBRequest = require('./lib/FDBOpenDBRequest');
var FDBDatabase = require('./lib/FDBDatabase');
var cmp = require('./lib/cmp');
var fireEvent = require('./lib/fireEvent');

var databases = {};

var fndexedDB = {};

fndexedDB.cmp = cmp;

// http://www.w3.org/TR/IndexedDB/#widl-IDBFactory-open-IDBOpenDBRequest-DOMString-name-unsigned-long-long-version
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