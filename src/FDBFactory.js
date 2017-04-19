const FDBDatabase = require("./FDBDatabase");
const FDBOpenDBRequest = require("./FDBOpenDBRequest").default;
const FDBVersionChangeEvent = require("./FDBVersionChangeEvent").default;
const cmp = require("./lib/cmp").default;
const Database = require("./lib/Database").default;
const {AbortError, VersionError} = require("./lib/errors");
const Event = require("./lib/Event").default;

const waitForOthersClosedDelete = (databases, name, openDatabases, cb) => {
    const anyOpen = openDatabases.some((openDatabase) => {
        return !openDatabase._closed;
    });

    if (anyOpen) {
        setImmediate(() => waitForOthersClosedDelete(databases, name, openDatabases, cb));
        return;
    }

    delete databases[name];

    cb();
};

// http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#dfn-steps-for-deleting-a-database
const deleteDatabase = (databases, name, request, cb) => {
    try {
        if (!databases.hasOwnProperty(name)) {
            cb();
            return;
        }

        const db = databases[name];
        db.deletePending = true;

        const openDatabases = db.connections.filter((connection) => {
            return !connection._closed;
        });

        for (const openDatabase of openDatabases) {
            if (!openDatabase._closePending) {
                const event = new FDBVersionChangeEvent("versionchange", {
                    oldVersion: db.version,
                    newVersion: null
                });
                openDatabase.dispatchEvent(event);
            }
        }

        const anyOpen = openDatabases.some((openDatabase) => {
            return !openDatabase._closed;
        });

        if (request && anyOpen) {
            const event = new FDBVersionChangeEvent("blocked", {
                oldVersion: db.version,
                newVersion: null
            });
            request.dispatchEvent(event);
        }

        waitForOthersClosedDelete(databases, name, openDatabases, cb);
    } catch (err) {
        cb(err);
    }
}

// http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#dfn-steps-for-running-a-versionchange-transaction
const runVersionchangeTransaction = (connection, version, request, cb) => {
    connection._runningVersionchangeTransaction = true;

    const oldVersion = connection.version;

    const openDatabases = connection._rawDatabase.connections.filter((otherDatabase) => {
        return connection !== otherDatabase;
    });

    for (const openDatabase of openDatabases) {
        if (!openDatabase._closed) {
            const event = new FDBVersionChangeEvent("versionchange", {
                oldVersion: oldVersion,
                newVersion: version
            });
            openDatabase.dispatchEvent(event);
        }
    }

    const anyOpen = openDatabases.some((openDatabase) => {
        return !openDatabase._closed;
    });

    if (anyOpen) {
        const event = new FDBVersionChangeEvent("blocked", {
            oldVersion: oldVersion,
            newVersion: version
        });
        request.dispatchEvent(event);
    }

    const waitForOthersClosed = () => {
        const anyOpen = openDatabases.some((openDatabase) => {
            return !openDatabase._closed;
        });

        if (anyOpen) {
            setImmediate(waitForOthersClosed);
            return;
        }

        // Set the version of database to version. This change is considered part of the transaction, and so if the
        // transaction is aborted, this change is reverted.
        connection._rawDatabase.version = version;
        connection.version = version;

// Get rid of this setImmediate?
        const transaction = connection.transaction(connection.objectStoreNames, "versionchange");
        request.result = connection;
        request.transaction = transaction;

        transaction._rollbackLog.push(() => {
            connection._rawDatabase.version = oldVersion;
            connection.version = oldVersion;
        });

        const event = new FDBVersionChangeEvent("upgradeneeded", {
            oldVersion: oldVersion,
            newVersion: version
        });
        request.dispatchEvent(event);

        request.readyState = "done";

        transaction.addEventListener("error", () => {
            connection._runningVersionchangeTransaction = false;
//throw arguments[0].target.error;
//console.log("error in versionchange transaction - not sure if anything needs to be done here", e.target.error.name);
        });
        transaction.addEventListener("abort", () => {
            connection._runningVersionchangeTransaction = false;
            request.transaction = null;
            setImmediate(() => {
                cb(new AbortError());
            });
        });
        transaction.addEventListener("complete", () => {
            connection._runningVersionchangeTransaction = false;
            request.transaction = null;
            // Let other complete event handlers run before continuing
            setImmediate(() => {
                if (connection._closePending) {
                    cb(new AbortError());
                } else {
                    cb(null);
                }
            });
        });
    };

    waitForOthersClosed();
}

// http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#dfn-steps-for-opening-a-database
const openDatabase = (databases, name, version, request, cb) => {
    let db;
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

    const connection = new FDBDatabase(databases[name]);

    if (db.version < version) {
        runVersionchangeTransaction(connection, version, request, (err) => {
            if (err) {
// DO THIS HERE: ensure that connection is closed by running the steps for closing a database connection before these steps are aborted.
                return cb(err);
            }

            cb(null, connection);
        });
    } else {
        cb(null, connection);
    }
}

class FDBFactory {
    constructor() {
        this._databases = {};
        this.cmp = cmp;
    }

    // http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#widl-IDBFactory-deleteDatabase-IDBOpenDBRequest-DOMString-name
    deleteDatabase(name) {
        const request = new FDBOpenDBRequest();
        request.source = null;

        setImmediate(() => {
            const version = this._databases.hasOwnProperty(name) ? this._databases[name].version : null;
            deleteDatabase(this._databases, name, request, (err) => {
                if (err) {
                    request.error = new Error();
                    request.error.name = err.name;

                    const event = new Event("error", {
                        bubbles: true,
                        cancelable: false
                    });
                    event.eventPath = [];
                    request.dispatchEvent(event);

                    return;
                }

                request.result = undefined;

                const event = new FDBVersionChangeEvent("success", {
                    oldVersion: version,
                    newVersion: null
                });
                request.dispatchEvent(event);
            });
        });

        return request;
    }

    // tslint:disable-next-line max-line-length
    // http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#widl-IDBFactory-open-IDBOpenDBRequest-DOMString-name-unsigned-long-long-version
    open(name, version) {
        if (arguments.length > 1 && (isNaN(version) || version < 1 || version >= 9007199254740992)) {
            throw new TypeError();
        }

        const request = new FDBOpenDBRequest();
        request.source = null;

        setImmediate(() => {
            openDatabase(this._databases, name, version, request, (err, connection) => {
                if (err) {
                    request.result = undefined;

                    request.error = new Error();
                    request.error.name = err.name;

                    const event = new Event("error", {
                        bubbles: true,
                        cancelable: false
                    });
                    event.eventPath = [];
                    request.dispatchEvent(event);

                    return;
                }

                request.result = connection;

                const event = new Event("success");
                event.eventPath = [];
                request.dispatchEvent(event);
            });
        });

        return request;
    }

    toString() {
        return "[object IDBFactory]";
    }
}

module.exports = FDBFactory;
