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

// http://www.w3.org/TR/IndexedDB/#dfn-steps-for-deleting-a-database
function deleteDatabase(name, request, cb) {
    try {
        var db;
        if (databases.hasOwnProperty(name)) {
            db = databases[name];
        } else {
            cb();
            return;
        }

        db.deletePending = true;

        var openDatabases = db.connections.filter(function (connection) {
            return !connection._closed;
        });

        openDatabases.forEach(function (openDatabase) {
            if (!openDatabase._closePending) {
                var event = new FDBVersionChangeEvent();
                event.target = openDatabase;
                event.type = 'versionchange';
                event.oldVersion = db.version;
                event.newVersion = null;
                openDatabase.dispatchEvent(event);
            }
        });

        var anyOpen = openDatabases.some(function (openDatabase) {
            return !openDatabase._closed;
        });

        if (request && anyOpen) {
            var event = new FDBVersionChangeEvent();
            event.target = request;
            event.type = 'blocked';
            event.oldVersion = db.version;
            event.newVersion = null;
            request.dispatchEvent(event);
        }
    } catch (err) {
        cb(err);
    }

    var waitForOthersClosed = function () {
        var anyOpen = openDatabases.some(function (openDatabase) {
            return !openDatabase._closed;
        });

        if (anyOpen) {
            setImmediate(waitForOthersClosed);
            return;
        }

        delete databases[name];

        cb();
    };

    waitForOthersClosed();
}

// http://www.w3.org/TR/IndexedDB/#dfn-steps-for-running-a-versionchange-transaction
function runVersionchangeTransaction(connection, version, request, cb) {
    connection._runningVersionchangeTransaction = true;

    var oldVersion = connection.version;

    var openDatabases = connection._rawDatabase.connections.filter(function (otherDatabase) {
        return connection !== otherDatabase;
    });

    openDatabases.forEach(function (openDatabase) {
        if (!openDatabase._closed) {
            var event = new FDBVersionChangeEvent();
            event.target = openDatabase;
            event.type = 'versionchange';
            event.oldVersion = oldVersion;
            event.newVersion = version;
            openDatabase.dispatchEvent(event);
        }
    });

    var anyOpen = openDatabases.some(function (openDatabase) {
        return !openDatabase._closed;
    });

    if (anyOpen) {
        var event = new FDBVersionChangeEvent();
        event.target = request;
        event.type = 'blocked';
        event.oldVersion = oldVersion;
        event.newVersion = version;
        request.dispatchEvent(event);
    }

    var waitForOthersClosed = function () {
        var anyOpen = openDatabases.some(function (openDatabase) {
            return !openDatabase._closed;
        });

        if (anyOpen) {
            setImmediate(waitForOthersClosed);
            return;
        }

//  Set the version of database to version. This change is considered part of the transaction, and so if the transaction is aborted, this change is reverted.
        connection._rawDatabase.version = version;
        connection.version = version;

// Get rid of this setImmediate?
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

        transaction.addEventListener('error', function () {
            connection._runningVersionchangeTransaction = false;
//throw e.target.error
//console.log('error in versionchange transaction - not sure if anything needs to be done here', e.target.error.name);
        });
        transaction.addEventListener('abort', function () {
            connection._runningVersionchangeTransaction = false;
            request.transaction = null;
            setImmediate(function () {
                cb(new AbortError());
            });
        });
        transaction.addEventListener('complete', function () {
            connection._runningVersionchangeTransaction = false;
            request.transaction = null;
            // Let other complete event handlers run before continuing
            setImmediate(function () {
                cb(null);
            });
        });
    };

    waitForOthersClosed();
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
        version = db.version !== 0 ? db.version : 1;
    }

    if (db.version > version) {
        return cb(new VersionError());
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

// http://www.w3.org/TR/IndexedDB/#widl-IDBFactory-deleteDatabase-IDBOpenDBRequest-DOMString-name
fakeIndexedDB.deleteDatabase = function (name) {
    var request = new FDBOpenDBRequest();
    request.source = null;

    setImmediate(function () {
        var version = databases.hasOwnProperty(name) ? databases[name].version : null;
        deleteDatabase(name, request, function (err) {
            var event;

            if (err) {
                request.error = new Error();
                request.error.name = err.name;

                event = new Event('error', {
                    bubbles: true,
                    cancelable: false
                });
                event._eventPath = [];
                request.dispatchEvent(event);

                return;
            }

            request.result = undefined;

            event = new FDBVersionChangeEvent();
            event.target = request;
            event.type = 'success';
            event.oldVersion = version;
            event.newVersion = null;
            request.dispatchEvent(event);
        });
    });

    return request;
};

// http://www.w3.org/TR/IndexedDB/#widl-IDBFactory-open-IDBOpenDBRequest-DOMString-name-unsigned-long-long-version
fakeIndexedDB.open = function (name, version) {
    if (arguments.length > 1 && (isNaN(version) || version <= 1 || version >= 9007199254740992)) {
        throw new TypeError();
    }

    var request = new FDBOpenDBRequest();
    request.source = null;

    setImmediate(function () {
        openDatabase(name, version, request, function (err, connection) {
            var event;

            if (err) {
                request.error = new Error();
                request.error.name = err.name;

                event = new Event('error', {
                    bubbles: true,
                    cancelable: false
                });
                event.target = request;
                event._eventPath = [];
                request.dispatchEvent(event);

                return;
            }

            request.result = connection;

            event = new Event('success');
            event.target = request;
            event._eventPath = [];
            request.dispatchEvent(event);
        });
    });

    return request;
};

module.exports = fakeIndexedDB;