'use strict';

var Event = require('./lib/Event');
var Database = require('./lib/Database');
var FDBOpenDBRequest = require('./lib/FDBOpenDBRequest');
var FDBDatabase = require('./lib/FDBDatabase');
var FDBVersionChangeEvent = require('./lib/FDBVersionChangeEvent');
var cmp = require('./lib/cmp');

var databases = {};

function fireOpenSuccessEvent(request, db) {
    request.result = db;
    var event = new Event();
    event.target = request;
    event.type = 'success';
    request.dispatchEvent(event);
}

var fakeIndexedDB = {};

fakeIndexedDB.cmp = cmp;

// http://www.w3.org/TR/IndexedDB/#widl-IDBFactory-open-IDBOpenDBRequest-DOMString-name-unsigned-long-long-version
fakeIndexedDB.open = function (name, version) {
    if (version === 0) {
        throw new TypeError();
    }

    var request = new FDBOpenDBRequest();
    request.source = null;

    // http://www.w3.org/TR/IndexedDB/#dfn-steps-for-opening-a-database
    process.nextTick(function () {
        if (!databases.hasOwnProperty(name)) {
            databases[name] = new Database(name, version);
            var db = new FDBDatabase(databases[name]);

            request.result = db;
            request.transaction = db.transaction(db.objectStoreNames, 'versionchange');
            request.transaction.addEventListener('complete', function (e) {
                request.transaction = null;

                process.nextTick(fireOpenSuccessEvent.bind(null, request, db));
            });

            var event = new FDBVersionChangeEvent();
            event.target = request;
            event.type = 'upgradeneeded';
            request.dispatchEvent(event);
        } else {
            fireOpenSuccessEvent(request, new FDBDatabase(databases[name]));
        }
    });

    return request;
};

module.exports = fakeIndexedDB;