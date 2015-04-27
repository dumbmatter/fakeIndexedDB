'use strict';

var Event = require('./lib/Event');
var Database = require('./lib/Database');
var FDBOpenDBRequest = require('./lib/FDBOpenDBRequest');
var FDBDatabase = require('./lib/FDBDatabase');
var FDBVersionChangeEvent = require('./lib/FDBVersionChangeEvent');
var AbortError = require('./lib/errors/AbortError');
var VersionError = require('./lib/errors/VersionError');
var cmp = require('./lib/cmp');

var databases = {};

function fireOpenSuccessEvent(request, db) {
    request.result = db;
    var event = new Event();
    event.target = request;
    event.type = 'success';
    request.dispatchEvent(event);
}

function runVersionchangeTransaction(connection, version, request, cb) {
    var oldVersion = connection.version;

//  Set the version of database to version. This change is considered part of the transaction, and so if the transaction is aborted, this change is reverted. 
    connection._database.version = version;
    connection.version = version;

    setImmediate(function () {
        var transaction = connection.transaction(connection.objectStoreNames, 'versionchange');
        request.result = connection;
        request.transaction = transaction;

        var event = new FDBVersionChangeEvent();
        event.target = request;
        event.type = 'upgradeneeded';
        event.oldVersion = oldVersion;
        event.newVersion = version;
        request.dispatchEvent(event);

        request.readyState = 'done';

        transaction.addEventListener('error', function (e) {
console.log('error in versionchange transaction - not sure if anything needs to be done here', e.target.error)
// Ugly hack so it runs after all other tx stuff finishes. Need a real queue, or a more appropriate time to schedule
            /*setTimeout(function () {
                request.error = new Error();
                request.error.name = e.target.error.name;
                var event = new Event('error', {
                    bubbles: true,
                    cancelable: false
                });
                event._eventPath = [];
                request.dispatchEvent(event);
            }, 1);*/
        });
        transaction.addEventListener('abort', function () {
            request.transaction = null;
            setImmediate(function () {
                cb(new AbortError());
            });
        });
        transaction.addEventListener('complete', function () {
            request.transaction = null;
            // Let other complete event handlers run before continuing
            setImmediate(function () {
                cb(null);
            });
        });
    });
}

// http://www.w3.org/TR/IndexedDB/#dfn-steps-for-opening-a-database
function openDatabase(name, version, request, cb) {
    var db;
    if (databases.hasOwnProperty(name)) {
        db = databases[name];
    } else {
        db = new Database(name, 0);
        databases[name] = db;
    }

    if (version === undefined) {
        version = 1;
    }

    if (db.version > version) {
        throw new VersionError();
    }

    var connection = new FDBDatabase(databases[name]);

    if (db.version < version) {
        runVersionchangeTransaction(connection, version, request, function (err) {
            if (err) {
// If the previous step resulted in an error, then return that error and abort these steps. If the "versionchange" transaction in the previous step was aborted, or if connection is closed, return a DOMError of type AbortError and abort these steps. In either of these cases, ensure that connection is closed by running the steps for closing a database connection before these steps are aborted.
/*                if (request.transaction) {
                    request.transaction._abort('AbortError');
                }*/
                return cb(err);
            }

            cb(null, connection);
        });
    } else {
        cb(null, connection);
    }
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

    setImmediate(function () {
        openDatabase(name, version, request, function (err, connection) {
            if (err) {
                request.error = new Error();
                request.error.name = err.name;

                var event = new Event('error', {
                    bubbles: true,
                    cancelable: false
                });
                event._eventPath = [];
                request.dispatchEvent(event);

                return;
            }

            fireOpenSuccessEvent(request, connection);
        });
    });

    return request;
};

module.exports = fakeIndexedDB;