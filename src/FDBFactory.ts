import "setimmediate";
import FDBDatabase from "./FDBDatabase";
import FDBOpenDBRequest from "./FDBOpenDBRequest";
import FDBVersionChangeEvent from "./FDBVersionChangeEvent";
import cmp from "./lib/cmp";
import Database from "./lib/Database";
import enforceRange from "./lib/enforceRange";
import { AbortError, VersionError } from "./lib/errors";
import FakeEvent from "./lib/FakeEvent";

const waitForOthersClosedDelete = (
    databases: Map<string, Database>,
    name: string,
    openDatabases: FDBDatabase[],
    cb: (err: Error | null) => void,
) => {
    const anyOpen = openDatabases.some(openDatabase2 => {
        return !openDatabase2._closed && !openDatabase2._closePending;
    });

    if (anyOpen) {
        setImmediate(() =>
            waitForOthersClosedDelete(databases, name, openDatabases, cb),
        );
        return;
    }

    databases.delete(name);

    cb(null);
};

// http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#dfn-steps-for-deleting-a-database
const deleteDatabase = (
    databases: Map<string, Database>,
    name: string,
    request: FDBOpenDBRequest,
    cb: (err: Error | null) => void,
) => {
    try {
        const db = databases.get(name);
        if (db === undefined) {
            cb(null);
            return;
        }

        db.deletePending = true;

        const openDatabases = db.connections.filter(connection => {
            return !connection._closed && !connection._closePending;
        });

        for (const openDatabase2 of openDatabases) {
            if (!openDatabase2._closePending) {
                const event = new FDBVersionChangeEvent("versionchange", {
                    newVersion: null,
                    oldVersion: db.version,
                });
                openDatabase2.dispatchEvent(event);
            }
        }

        const anyOpen = openDatabases.some(openDatabase3 => {
            return !openDatabase3._closed && !openDatabase3._closePending;
        });

        if (request && anyOpen) {
            const event = new FDBVersionChangeEvent("blocked", {
                newVersion: null,
                oldVersion: db.version,
            });
            request.dispatchEvent(event);
        }

        waitForOthersClosedDelete(databases, name, openDatabases, cb);
    } catch (err) {
        cb(err);
    }
};

// http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#dfn-steps-for-running-a-versionchange-transaction
const runVersionchangeTransaction = (
    connection: FDBDatabase,
    version: number,
    request: FDBOpenDBRequest,
    cb: (err: Error | null) => void,
) => {
    connection._runningVersionchangeTransaction = true;

    const oldVersion = connection.version;

    const openDatabases = connection._rawDatabase.connections.filter(
        otherDatabase => {
            return connection !== otherDatabase;
        },
    );

    for (const openDatabase2 of openDatabases) {
        if (!openDatabase2._closed && !openDatabase2._closePending) {
            const event = new FDBVersionChangeEvent("versionchange", {
                newVersion: version,
                oldVersion,
            });
            openDatabase2.dispatchEvent(event);
        }
    }

    const anyOpen = openDatabases.some(openDatabase3 => {
        return !openDatabase3._closed && !openDatabase3._closePending;
    });

    if (anyOpen) {
        const event = new FDBVersionChangeEvent("blocked", {
            newVersion: version,
            oldVersion,
        });
        request.dispatchEvent(event);
    }

    const waitForOthersClosed = () => {
        const anyOpen2 = openDatabases.some(openDatabase2 => {
            return !openDatabase2._closed && !openDatabase2._closePending;
        });

        if (anyOpen2) {
            setImmediate(waitForOthersClosed);
            return;
        }

        // Set the version of database to version. This change is considered part of the transaction, and so if the
        // transaction is aborted, this change is reverted.
        connection._rawDatabase.version = version;
        connection.version = version;

        // Get rid of this setImmediate?
        const transaction = connection.transaction(
            connection.objectStoreNames,
            "versionchange",
        );
        request.result = connection;
        request.readyState = "done";
        request.transaction = transaction;

        transaction._rollbackLog.push(() => {
            connection._rawDatabase.version = oldVersion;
            connection.version = oldVersion;
        });

        const event = new FDBVersionChangeEvent("upgradeneeded", {
            newVersion: version,
            oldVersion,
        });
        request.dispatchEvent(event);

        transaction.addEventListener("error", () => {
            connection._runningVersionchangeTransaction = false;
            // throw arguments[0].target.error;
            // console.log("error in versionchange transaction - not sure if anything needs to be done here", e.target.error.name);
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
};

// http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#dfn-steps-for-opening-a-database
const openDatabase = (
    databases: Map<string, Database>,
    name: string,
    version: number | undefined,
    request: FDBOpenDBRequest,
    cb: (err: Error | null, connection?: FDBDatabase) => void,
) => {
    let db = databases.get(name);
    if (db === undefined) {
        db = new Database(name, 0);
        databases.set(name, db);
    }

    if (version === undefined) {
        version = db.version !== 0 ? db.version : 1;
    }

    if (db.version > version) {
        return cb(new VersionError());
    }

    const connection = new FDBDatabase(db);

    if (db.version < version) {
        runVersionchangeTransaction(connection, version, request, err => {
            if (err) {
                // DO THIS HERE: ensure that connection is closed by running the steps for closing a database connection before these
                // steps are aborted.
                return cb(err);
            }

            cb(null, connection);
        });
    } else {
        cb(null, connection);
    }
};

class FDBFactory {
    public cmp = cmp;
    private _databases: Map<string, Database> = new Map();

    // http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#widl-IDBFactory-deleteDatabase-IDBOpenDBRequest-DOMString-name
    public deleteDatabase(name: string) {
        const request = new FDBOpenDBRequest();
        request.source = null;

        setImmediate(() => {
            const db = this._databases.get(name);
            const oldVersion = db !== undefined ? db.version : 0;

            deleteDatabase(this._databases, name, request, err => {
                if (err) {
                    request.error = new Error();
                    request.error.name = err.name;
                    request.readyState = "done";

                    const event = new FakeEvent("error", {
                        bubbles: true,
                        cancelable: true,
                    });
                    event.eventPath = [];
                    request.dispatchEvent(event);

                    return;
                }

                request.result = undefined;
                request.readyState = "done";

                const event2 = new FDBVersionChangeEvent("success", {
                    newVersion: null,
                    oldVersion,
                });
                request.dispatchEvent(event2);
            });
        });

        return request;
    }

    // tslint:disable-next-line max-line-length
    // http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#widl-IDBFactory-open-IDBOpenDBRequest-DOMString-name-unsigned-long-long-version
    public open(name: string, version?: number) {
        if (arguments.length > 1 && version !== undefined) {
            // Based on spec, not sure why "MAX_SAFE_INTEGER" instead of "unsigned long long", but it's needed to pass
            // tests
            version = enforceRange(version, "MAX_SAFE_INTEGER");
        }
        if (version === 0) {
            throw new TypeError();
        }

        const request = new FDBOpenDBRequest();
        request.source = null;

        setImmediate(() => {
            openDatabase(
                this._databases,
                name,
                version,
                request,
                (err, connection) => {
                    if (err) {
                        request.result = undefined;
                        request.readyState = "done";

                        request.error = new Error();
                        request.error.name = err.name;

                        const event = new FakeEvent("error", {
                            bubbles: true,
                            cancelable: true,
                        });
                        event.eventPath = [];
                        request.dispatchEvent(event);

                        return;
                    }

                    request.result = connection;
                    request.readyState = "done";

                    const event2 = new FakeEvent("success");
                    event2.eventPath = [];
                    request.dispatchEvent(event2);
                },
            );
        });

        return request;
    }

    // https://w3c.github.io/IndexedDB/#dom-idbfactory-databases
    public databases() {
        return new Promise(resolve => {
            const result = [];
            for (const [name, database] of this._databases) {
                result.push({
                    name,
                    version: database.version,
                });
            }
            resolve(result);
        });
    }

    public toString() {
        return "[object IDBFactory]";
    }
}

export default FDBFactory;
