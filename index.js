var Event = require('./lib/Event');
var FDBOpenDBRequest = require('./lib/FDBOpenDBRequest');
var FDBDatabase = require('./lib/FDBDatabase');
var FDBVersionChangeEvent = require('./lib/FDBVersionChangeEvent');
var TypeError = require('./lib/errors/TypeError');
var cmp = require('./lib/cmp');

var databases = {};

function fireOpenSuccessEvent(request, db) {
    request.result = db;
    var event = new Event();
    event.target = request;
    event.type = 'success';
    request.dispatchEvent(event);
}

var fndexedDB = {};

fndexedDB.cmp = cmp;

// http://www.w3.org/TR/IndexedDB/#widl-IDBFactory-open-IDBOpenDBRequest-DOMString-name-unsigned-long-long-version
fndexedDB.open = function (name, version) {
    if (version === 0) {
        throw new TypeError();
    }

    var request = new FDBOpenDBRequest();
    request.source = null;

    // http://www.w3.org/TR/IndexedDB/#dfn-steps-for-opening-a-database
    process.nextTick(function () {
        if (!databases.hasOwnProperty(name)) {
            databases[name] = new FDBDatabase();

            request.result = databases[name];
            request.transaction = databases[name].transaction(databases[name].objectStoreNames, 'versionchange');
            request.transaction.addEventListener('complete', function () {
                request.transaction = null;

                process.nextTick(fireOpenSuccessEvent.bind(null, request, databases[name]));
            });

            var event = new FDBVersionChangeEvent();
            event.target = request;
            event.type = 'upgradeneeded';
            request.dispatchEvent(event);
        } else {
            fireOpenSuccessEvent(request, databases[name]);
        }
    });

    return request;
};

module.exports = fndexedDB;