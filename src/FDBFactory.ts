import dbManager from "./lib/LevelDBManager.js";
import FDBDatabase from "./FDBDatabase.js";
import FDBOpenDBRequest from "./FDBOpenDBRequest.js";
import FDBVersionChangeEvent from "./FDBVersionChangeEvent.js";
import cmp from "./lib/cmp.js";
import Database from "./lib/Database.js";
import enforceRange from "./lib/enforceRange.js";
import { AbortError, VersionError } from "./lib/errors.js";
import FakeEvent from "./lib/FakeEvent.js";
import { queueTask } from "./lib/scheduling.js";

const waitForOthersClosedDelete = (
    databases: Map<string, Database>,
    name: string,
    openDatabases: FDBDatabase[],
    cb: (err: Error | null) => void,
) => {
    const anyOpen = openDatabases.some((openDatabase2) => {
        return !openDatabase2._closed && !openDatabase2._closePending;
    });

    if (anyOpen) {
        queueTask(() =>
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

        const openDatabases = db.connections.filter((connection) => {
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

        const anyOpen = openDatabases.some((openDatabase3) => {
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
    const isNewDatabase = oldVersion === 0;
    console.log(
        "oldVersion",
        oldVersion,
        "newVersion",
        version,
        "isNewDatabase",
        isNewDatabase,
    );
    const openDatabases = connection._rawDatabase.connections.filter(
        (otherDatabase) => {
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

    const anyOpen = openDatabases.some((openDatabase3) => {
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
        const anyOpen2 = openDatabases.some((openDatabase2) => {
            return !openDatabase2._closed && !openDatabase2._closePending;
        });

        if (anyOpen2) {
            queueTask(waitForOthersClosed);
            return;
        }

        // Set the version of database to version. This change is considered part of the transaction, and so if the
        // transaction is aborted, this change is reverted.
        connection._rawDatabase.version = version;
        connection.version = version;

        // Get rid of this setImmediate?

        // Only create a versionchange transaction if it's a new database or the version has changed
        if (isNewDatabase || oldVersion < version) {
            console.log("FDBFactory creating a brand new one");
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
                queueTask(() => {
                    cb(new AbortError());
                });
            });
            transaction.addEventListener("complete", () => {
                connection._runningVersionchangeTransaction = false;
                request.transaction = null;
                // Let other complete event handlers run before continuing
                queueTask(() => {
                    if (connection._closePending) {
                        cb(new AbortError());
                    } else {
                        cb(null);
                    }
                });
            });
        } else {
            // If it's not a new database and the version hasn't changed, just call the callback
            connection._runningVersionchangeTransaction = false;
            cb(null);
        }
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
    const isNewDatabase = db === undefined;
    if (isNewDatabase) {
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

    if (isNewDatabase || db.version < version) {
        runVersionchangeTransaction(connection, version, request, (err) => {
            if (err) {
                // Ensure that connection is closed before aborting
                connection.close();
                return cb(err);
            }

            dbManager.saveDatabaseStructure(db);

            cb(null, connection);
        });
    } else {
        // Database exists and version is the same, don't trigger upgrade
        cb(null, connection);
    }
};

class FDBFactory {
    public cmp = cmp;
    private _databases: Map<string, Database> = new Map();

    constructor() {
        this.initializeDatabases();
    }

    private initializeDatabases() {
        // check if the cache was already loaded otherwise throw an error
        try {
            const dbStructures = dbManager.getAllDatabaseStructures();
            // console.log("Factory dbStructures", dbStructures);
            for (const [dbName, dbStructure] of Object.entries(dbStructures)) {
                const db = new Database(dbName, dbStructure.version);
                this._databases.set(dbName, db);
                console.log("Set    ", dbName, db);
            }
        } catch (error) {
            console.error("Error initializing databases:", error);
        }
    }
    // http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#widl-IDBFactory-deleteDatabase-IDBOpenDBRequest-DOMString-name
    public deleteDatabase(name: string) {
        const request = new FDBOpenDBRequest();
        request.source = null;

        queueTask(() => {
            const db = this._databases.get(name);
            const oldVersion = db !== undefined ? db.version : 0;

            deleteDatabase(this._databases, name, request, (err) => {
                if (err) {
                    request.error = new DOMException(err.message, err.name);
                    request.readyState = "done";

                    const event = new FakeEvent("error", {
                        bubbles: true,
                        cancelable: true,
                    });
                    event.eventPath = [];
                    request.dispatchEvent(event);

                    return;
                }
                dbManager.deleteDatabaseStructure(name);

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

        queueTask(() => {
            openDatabase(
                this._databases,
                name,
                version,
                request,
                (err, connection) => {
                    if (err) {
                        request.result = undefined;
                        request.readyState = "done";

                        request.error = new DOMException(err.message, err.name);

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
        return new Promise((resolve) => {
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
