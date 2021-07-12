import "../wpt-env.js";

("use strict");

// Returns an IndexedDB database name that is unique to the test case.
function databaseName(testCase) {
    return "db" + self.location.pathname + "-" + testCase.name;
}

// EventWatcher covering all the events defined on IndexedDB requests.
//
// The events cover IDBRequest and IDBOpenDBRequest.
function requestWatcher(testCase, request) {
    return new EventWatcher(testCase, request, [
        "blocked",
        "error",
        "success",
        "upgradeneeded",
    ]);
}

// EventWatcher covering all the events defined on IndexedDB transactions.
//
// The events cover IDBTransaction.
function transactionWatcher(testCase, request) {
    return new EventWatcher(testCase, request, ["abort", "complete", "error"]);
}

// Promise that resolves with an IDBRequest's result.
//
// The promise only resolves if IDBRequest receives the "success" event. Any
// other event causes the promise to reject with an error. This is correct in
// most cases, but insufficient for indexedDB.open(), which issues
// "upgradeneded" events under normal operation.
function promiseForRequest(testCase, request) {
    const eventWatcher = requestWatcher(testCase, request);
    return eventWatcher
        .wait_for("success")
        .then((event) => event.target.result);
}

// Promise that resolves when an IDBTransaction completes.
//
// The promise resolves with undefined if IDBTransaction receives the "complete"
// event, and rejects with an error for any other event.
function promiseForTransaction(testCase, request) {
    const eventWatcher = transactionWatcher(testCase, request);
    return eventWatcher.wait_for("complete").then(() => {});
}

// Migrates an IndexedDB database whose name is unique for the test case.
//
// newVersion must be greater than the database's current version.
//
// migrationCallback will be called during a versionchange transaction and will
// given the created database, the versionchange transaction, and the database
// open request.
//
// Returns a promise. If the versionchange transaction goes through, the promise
// resolves to an IndexedDB database that should be closed by the caller. If the
// versionchange transaction is aborted, the promise resolves to an error.
function migrateDatabase(testCase, newVersion, migrationCallback) {
    return migrateNamedDatabase(
        testCase,
        databaseName(testCase),
        newVersion,
        migrationCallback,
    );
}

// Migrates an IndexedDB database.
//
// newVersion must be greater than the database's current version.
//
// migrationCallback will be called during a versionchange transaction and will
// given the created database, the versionchange transaction, and the database
// open request.
//
// Returns a promise. If the versionchange transaction goes through, the promise
// resolves to an IndexedDB database that should be closed by the caller. If the
// versionchange transaction is aborted, the promise resolves to an error.
function migrateNamedDatabase(
    testCase,
    databaseName,
    newVersion,
    migrationCallback,
) {
    // We cannot use eventWatcher.wait_for('upgradeneeded') here, because
    // the versionchange transaction auto-commits before the Promise's then
    // callback gets called.
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(databaseName, newVersion);
        request.onupgradeneeded = testCase.step_func((event) => {
            const database = event.target.result;
            const transaction = event.target.transaction;
            let shouldBeAborted = false;
            let requestEventPromise = null;

            // We wrap IDBTransaction.abort so we can set up the correct event
            // listeners and expectations if the test chooses to abort the
            // versionchange transaction.
            const transactionAbort = transaction.abort.bind(transaction);
            transaction.abort = () => {
                transaction._willBeAborted();
                transactionAbort();
            };
            transaction._willBeAborted = () => {
                requestEventPromise = new Promise((resolve, reject) => {
                    request.onerror = (event) => {
                        event.preventDefault();
                        resolve(event.target.error);
                    };
                    request.onsuccess = () =>
                        reject(
                            new Error(
                                "indexedDB.open should not succeed for an aborted " +
                                    "versionchange transaction",
                            ),
                        );
                });
                shouldBeAborted = true;
            };

            // If migration callback returns a promise, we'll wait for it to resolve.
            // This simplifies some tests.
            const callbackResult = migrationCallback(
                database,
                transaction,
                request,
            );
            if (!shouldBeAborted) {
                request.onerror = null;
                request.onsuccess = null;
                requestEventPromise = promiseForRequest(testCase, request);
            }

            // requestEventPromise needs to be the last promise in the chain, because
            // we want the event that it resolves to.
            resolve(
                Promise.resolve(callbackResult).then(() => requestEventPromise),
            );
        });
        request.onerror = (event) => reject(event.target.error);
        request.onsuccess = () => {
            const database = request.result;
            testCase.add_cleanup(() => {
                database.close();
            });
            reject(
                new Error(
                    "indexedDB.open should not succeed without creating a " +
                        "versionchange transaction",
                ),
            );
        };
    }).then((databaseOrError) => {
        if (databaseOrError instanceof IDBDatabase)
            testCase.add_cleanup(() => {
                databaseOrError.close();
            });
        return databaseOrError;
    });
}

// Creates an IndexedDB database whose name is unique for the test case.
//
// setupCallback will be called during a versionchange transaction, and will be
// given the created database, the versionchange transaction, and the database
// open request.
//
// Returns a promise that resolves to an IndexedDB database. The caller should
// close the database.
function createDatabase(testCase, setupCallback) {
    return createNamedDatabase(testCase, databaseName(testCase), setupCallback);
}

// Creates an IndexedDB database.
//
// setupCallback will be called during a versionchange transaction, and will be
// given the created database, the versionchange transaction, and the database
// open request.
//
// Returns a promise that resolves to an IndexedDB database. The caller should
// close the database.
function createNamedDatabase(testCase, databaseName, setupCallback) {
    const request = indexedDB.deleteDatabase(databaseName);
    return promiseForRequest(testCase, request).then(() => {
        testCase.add_cleanup(() => {
            indexedDB.deleteDatabase(databaseName);
        });
        return migrateNamedDatabase(testCase, databaseName, 1, setupCallback);
    });
}

// Opens an IndexedDB database without performing schema changes.
//
// The given version number must match the database's current version.
//
// Returns a promise that resolves to an IndexedDB database. The caller should
// close the database.
function openDatabase(testCase, version) {
    return openNamedDatabase(testCase, databaseName(testCase), version);
}

// Opens an IndexedDB database without performing schema changes.
//
// The given version number must match the database's current version.
//
// Returns a promise that resolves to an IndexedDB database. The caller should
// close the database.
function openNamedDatabase(testCase, databaseName, version) {
    const request = indexedDB.open(databaseName, version);
    return promiseForRequest(testCase, request).then((database) => {
        testCase.add_cleanup(() => {
            database.close();
        });
        return database;
    });
}

// The data in the 'books' object store records in the first example of the
// IndexedDB specification.
const BOOKS_RECORD_DATA = [
    { title: "Quarry Memories", author: "Fred", isbn: 123456 },
    { title: "Water Buffaloes", author: "Fred", isbn: 234567 },
    { title: "Bedrock Nights", author: "Barney", isbn: 345678 },
];

// Creates a 'books' object store whose contents closely resembles the first
// example in the IndexedDB specification.
const createBooksStore = (testCase, database) => {
    const store = database.createObjectStore("books", {
        keyPath: "isbn",
        autoIncrement: true,
    });
    store.createIndex("by_author", "author");
    store.createIndex("by_title", "title", { unique: true });
    for (let record of BOOKS_RECORD_DATA) store.put(record);
    return store;
};

// Creates a 'not_books' object store used to test renaming into existing or
// deleted store names.
function createNotBooksStore(testCase, database) {
    const store = database.createObjectStore("not_books");
    store.createIndex("not_by_author", "author");
    store.createIndex("not_by_title", "title", { unique: true });
    return store;
}

// Verifies that an object store's indexes match the indexes used to create the
// books store in the test database's version 1.
//
// The errorMessage is used if the assertions fail. It can state that the
// IndexedDB implementation being tested is incorrect, or that the testing code
// is using it incorrectly.
function checkStoreIndexes(testCase, store, errorMessage) {
    assert_array_equals(
        store.indexNames,
        ["by_author", "by_title"],
        errorMessage,
    );
    const authorIndex = store.index("by_author");
    const titleIndex = store.index("by_title");
    return Promise.all([
        checkAuthorIndexContents(testCase, authorIndex, errorMessage),
        checkTitleIndexContents(testCase, titleIndex, errorMessage),
    ]);
}

// Verifies that an object store's key generator is in the same state as the
// key generator created for the books store in the test database's version 1.
//
// The errorMessage is used if the assertions fail. It can state that the
// IndexedDB implementation being tested is incorrect, or that the testing code
// is using it incorrectly.
function checkStoreGenerator(testCase, store, expectedKey, errorMessage) {
    const request = store.put({
        title: "Bedrock Nights " + expectedKey,
        author: "Barney",
    });
    return promiseForRequest(testCase, request).then((result) => {
        assert_equals(result, expectedKey, errorMessage);
    });
}

// Verifies that an object store's contents matches the contents used to create
// the books store in the test database's version 1.
//
// The errorMessage is used if the assertions fail. It can state that the
// IndexedDB implementation being tested is incorrect, or that the testing code
// is using it incorrectly.
function checkStoreContents(testCase, store, errorMessage) {
    const request = store.get(123456);
    return promiseForRequest(testCase, request).then((result) => {
        assert_equals(result.isbn, BOOKS_RECORD_DATA[0].isbn, errorMessage);
        assert_equals(result.author, BOOKS_RECORD_DATA[0].author, errorMessage);
        assert_equals(result.title, BOOKS_RECORD_DATA[0].title, errorMessage);
    });
}

// Verifies that index matches the 'by_author' index used to create the
// by_author books store in the test database's version 1.
//
// The errorMessage is used if the assertions fail. It can state that the
// IndexedDB implementation being tested is incorrect, or that the testing code
// is using it incorrectly.
function checkAuthorIndexContents(testCase, index, errorMessage) {
    const request = index.get(BOOKS_RECORD_DATA[2].author);
    return promiseForRequest(testCase, request).then((result) => {
        assert_equals(result.isbn, BOOKS_RECORD_DATA[2].isbn, errorMessage);
        assert_equals(result.title, BOOKS_RECORD_DATA[2].title, errorMessage);
    });
}

// Verifies that an index matches the 'by_title' index used to create the books
// store in the test database's version 1.
//
// The errorMessage is used if the assertions fail. It can state that the
// IndexedDB implementation being tested is incorrect, or that the testing code
// is using it incorrectly.
function checkTitleIndexContents(testCase, index, errorMessage) {
    const request = index.get(BOOKS_RECORD_DATA[2].title);
    return promiseForRequest(testCase, request).then((result) => {
        assert_equals(result.isbn, BOOKS_RECORD_DATA[2].isbn, errorMessage);
        assert_equals(result.author, BOOKS_RECORD_DATA[2].author, errorMessage);
    });
}

// Returns an Uint8Array with pseudorandom data.
//
// The PRNG should be sufficient to defeat compression schemes, but it is not
// cryptographically strong.
function largeValue(size, seed) {
    const buffer = new Uint8Array(size);

    // 32-bit xorshift - the seed can't be zero
    let state = 1000 + seed;

    for (let i = 0; i < size; ++i) {
        state ^= state << 13;
        state ^= state >> 17;
        state ^= state << 5;
        buffer[i] = state & 0xff;
    }

    return buffer;
}

async function deleteAllDatabases(testCase) {
    const dbs_to_delete = await indexedDB.databases();
    for (const db_info of dbs_to_delete) {
        let request = indexedDB.deleteDatabase(db_info.name);
        let eventWatcher = requestWatcher(testCase, request);
        await eventWatcher.wait_for("success");
    }
}

// Keeps the passed transaction alive indefinitely (by making requests
// against the named store). Returns a function that asserts that the
// transaction has not already completed and then ends the request loop so that
// the transaction may autocommit and complete.
function keepAlive(testCase, transaction, storeName) {
    let completed = false;
    transaction.addEventListener("complete", () => {
        completed = true;
    });

    let keepSpinning = true;

    function spin() {
        if (!keepSpinning) return;
        transaction.objectStore(storeName).get(0).onsuccess = spin;
    }
    spin();

    return testCase.step_func(() => {
        assert_false(completed, "Transaction completed while kept alive");
        keepSpinning = false;
    });
}

// Return a promise that resolves after a setTimeout finishes to break up the
// scope of a function's execution.
function timeoutPromise(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

("use strict");

// Should be large enough to trigger large value handling in the IndexedDB
// engines that have special code paths for large values.
const wrapThreshold = 128 * 1024;

function populateStore(store) {
    store.put({ id: 1, key: "k1", value: largeValue(wrapThreshold, 1) });
    store.put({ id: 2, key: "k2", value: ["small-2"] });
    store.put({ id: 3, key: "k3", value: largeValue(wrapThreshold, 3) });
    store.put({ id: 4, key: "k4", value: ["small-4"] });
}

// Assigns cursor indexes for operations that require open cursors.
//
// Returns the number of open cursors required to perform all operations.
function assignCursors(operations) {
    return cursorCount;
}

// Opens index cursors for operations that require open cursors.
//
// onsuccess is called if all cursors are opened successfully. Otherwise,
// onerror will be called at least once.
function openCursors(testCase, index, operations, onerror, onsuccess) {
    let pendingCursors = 0;

    for (let operation of operations) {
        const opcode = operation[0];
        const primaryKey = operation[1];
        let request;
        switch (opcode) {
            case "continue":
                request = index.openCursor(
                    IDBKeyRange.lowerBound(`k${primaryKey - 1}`),
                );
                break;
            case "continue-empty":
                // k4 is the last key in the data set, so calling continue() will get
                // the cursor past the end of the store.
                request = index.openCursor(IDBKeyRange.lowerBound("k4"));
                break;
            default:
                continue;
        }

        operation[2] = request;
        ++pendingCursors;

        request.onsuccess = testCase.step_func(() => {
            --pendingCursors;
            if (!pendingCursors) onsuccess();
        });
        request.onerror = testCase.step_func(onerror);
    }

    if (!pendingCursors) onsuccess();
}

function doOperation(testCase, store, index, operation, requestId, results) {
    const opcode = operation[0];
    const primaryKey = operation[1];
    const cursor = operation[2];

    return new Promise((resolve, reject) => {
        let request;
        switch (opcode) {
            case "add": // Tests returning a primary key.
                request = store.add({
                    key: `k${primaryKey}`,
                    value: [`small-${primaryKey}`],
                });
                break;
            case "put": // Tests returning a primary key.
                request = store.put({
                    key: `k${primaryKey}`,
                    value: [`small-${primaryKey}`],
                });
                break;
            case "put-with-id": // Tests returning success or a primary key.
                request = store.put({
                    key: `k${primaryKey}`,
                    value: [`small-${primaryKey}`],
                    id: primaryKey,
                });
                break;
            case "get": // Tests returning a value.
            case "get-empty": // Tests returning undefined.
                request = store.get(primaryKey);
                break;
            case "getall": // Tests returning an array of values.
                request = store.getAll();
                break;
            case "error": // Tests returning an error.
                request = store.put({
                    key: `k${primaryKey}`,
                    value: [`small-${primaryKey}`],
                });
                request.onerror = testCase.step_func((event) => {
                    event.preventDefault();
                    results.push([requestId, request.error]);
                    resolve();
                });
                request.onsuccess = testCase.step_func(() => {
                    reject(
                        new Error("put with duplicate primary key succeded"),
                    );
                });
                break;
            case "continue": // Tests returning a key, primary key, and value.
                request = cursor;
                cursor.result.continue();
                request.onsuccess = testCase.step_func(() => {
                    const result = request.result;
                    results.push([
                        requestId,
                        result.key,
                        result.primaryKey,
                        result.value,
                    ]);
                    resolve();
                });
                request.onerror = null;
                break;
            case "open": // Tests returning a cursor, key, primary key, and value.
                request = index.openCursor(
                    IDBKeyRange.lowerBound(`k${primaryKey}`),
                );
                request.onsuccess = testCase.step_func(() => {
                    const result = request.result;
                    results.push([
                        requestId,
                        result.key,
                        result.primaryKey,
                        result.value,
                    ]);
                    resolve();
                });
                break;
            case "continue-empty": // Tests returning a null result.
                request = cursor;
                cursor.result.continue();
                request.onsuccess = testCase.step_func(() => {
                    results.push([requestId, request.result]);
                    resolve();
                });
                request.onerror = null;
                break;
            case "open-empty": // Tests returning a null cursor.
                request = index.openCursor(
                    IDBKeyRange.lowerBound(`k${primaryKey}`),
                );
                request.onsuccess = testCase.step_func(() => {
                    const result = request.result;
                    results.push([requestId, request.result]);
                    resolve();
                });
                break;
            case "count": // Tests returning a numeric result.
                request = index.count();
                request.onsuccess = testCase.step_func(() => {
                    results.push([requestId, request.result]);
                    resolve();
                });
                break;
        }

        if (!request.onsuccess) {
            request.onsuccess = testCase.step_func(() => {
                results.push([requestId, request.result]);
                resolve();
            });
        }
        if (!request.onerror)
            request.onerror = testCase.step_func((event) => {
                event.preventDefault();
                reject(request.error);
            });
    });
}

function checkOperationResult(operation, result, requestId) {
    const opcode = operation[0];
    const primaryKey = operation[1];

    const expectedValue =
        primaryKey == 1 || primaryKey == 3
            ? largeValue(wrapThreshold, primaryKey)
            : [`small-${primaryKey}`];

    const requestIndex = result[0];
    assert_equals(
        requestIndex,
        requestId,
        "result event order should match request order",
    );
    switch (opcode) {
        case "put":
        case "put-with-id":
        case "add":
            assert_equals(
                result[1],
                primaryKey,
                `${opcode} result should be the new object's primary key`,
            );
            break;
        case "get":
            assert_equals(
                result[1].id,
                primaryKey,
                "get result should match put value (primary key)",
            );
            assert_equals(
                result[1].key,
                `k${primaryKey}`,
                "get result should match put value (key)",
            );
            assert_equals(
                result[1].value.join(","),
                expectedValue.join(","),
                "get result should match put value (nested value)",
            );
            break;
        case "getall":
            assert_equals(
                result[1].length,
                primaryKey,
                "getAll should return all the objects in the store",
            );
            for (let i = 0; i < primaryKey; ++i) {
                const object = result[1][i];
                assert_equals(
                    object.id,
                    i + 1,
                    `getAll result ${
                        i + 1
                    } should match put value (primary key)`,
                );
                assert_equals(
                    object.key,
                    `k${i + 1}`,
                    `get result ${i + 1} should match put value (key)`,
                );

                const expectedValue =
                    i == 0 || i == 2
                        ? largeValue(wrapThreshold, i + 1)
                        : [`small-${i + 1}`];
                assert_equals(
                    object.value.join(","),
                    object.value.join(","),
                    `get result ${i + 1} should match put value (nested value)`,
                );
            }
            break;
        case "get-empty":
            assert_equals(
                result[1],
                undefined,
                "get-empty result should be undefined",
            );
            break;
        case "error":
            assert_equals(
                result[1].name,
                "ConstraintError",
                "incorrect error from put with duplicate primary key",
            );
            break;
        case "continue":
        case "open":
            assert_equals(
                result[1],
                `k${primaryKey}`,
                `${opcode} key should match the key in the put value`,
            );
            assert_equals(
                result[2],
                primaryKey,
                `${opcode} primary key should match the put value's primary key`,
            );
            assert_equals(
                result[3].id,
                primaryKey,
                `${opcode} value should match put value (primary key)`,
            );
            assert_equals(
                result[3].key,
                `k${primaryKey}`,
                `${opcode} value should match put value (key)`,
            );
            assert_equals(
                result[3].value.join(","),
                expectedValue.join(","),
                `${opcode} value should match put value (nested value)`,
            );
            break;
        case "continue-empty":
        case "open-empty":
            assert_equals(result[1], null, `${opcode} result should be null`);
            break;
    }
}

function eventsTest(label, operations) {
    promise_test((testCase) => {
        return createDatabase(testCase, (database, transaction) => {
            const store = database.createObjectStore("test-store", {
                autoIncrement: true,
                keyPath: "id",
            });
            store.createIndex("test-index", "key", { unique: true });
            populateStore(store);
        })
            .then((database) => {
                const transaction = database.transaction(
                    ["test-store"],
                    "readwrite",
                );
                const store = transaction.objectStore("test-store");
                const index = store.index("test-index");
                return new Promise((resolve, reject) => {
                    openCursors(testCase, index, operations, reject, () => {
                        const results = [];
                        const promises = [];
                        for (let i = 0; i < operations.length; ++i) {
                            const promise = doOperation(
                                testCase,
                                store,
                                index,
                                operations[i],
                                i,
                                results,
                            );
                            promises.push(promise);
                        }
                        resolve(Promise.all(promises).then(() => results));
                    });
                });
            })
            .then((results) => {
                assert_equals(
                    results.length,
                    operations.length,
                    "Promise.all should resolve after all sub-promises resolve",
                );
                for (let i = 0; i < operations.length; ++i)
                    checkOperationResult(operations[i], results[i], i);
            });
    }, label);
}

eventsTest("small values", [
    ["get", 2],
    ["count", 4],
    ["continue-empty", null],
    ["get-empty", 5],
    ["add", 5],
    ["open", 2],
    ["continue", 2],
    ["get", 4],
    ["get-empty", 6],
    ["count", 5],
    ["put-with-id", 5],
    ["put", 6],
    ["error", 3],
    ["continue", 4],
    ["count", 6],
    ["get-empty", 7],
    ["open", 4],
    ["open-empty", 7],
    ["add", 7],
]);

eventsTest("large values", [
    ["open", 1],
    ["get", 1],
    ["getall", 4],
    ["get", 3],
    ["continue", 3],
    ["open", 3],
]);

eventsTest("large value followed by small values", [
    ["get", 1],
    ["getall", 4],
    ["open", 2],
    ["continue-empty", null],
    ["get", 2],
    ["get-empty", 5],
    ["count", 4],
    ["continue-empty", null],
    ["open-empty", 5],
    ["add", 5],
    ["error", 1],
    ["continue", 2],
    ["get-empty", 6],
    ["put-with-id", 5],
    ["put", 6],
]);

eventsTest("large values mixed with small values", [
    ["get", 1],
    ["get", 2],
    ["get-empty", 5],
    ["count", 4],
    ["continue-empty", null],
    ["open", 1],
    ["continue", 2],
    ["open-empty", 5],
    ["getall", 4],
    ["open", 2],
    ["continue-empty", null],
    ["add", 5],
    ["get", 3],
    ["count", 5],
    ["get-empty", 6],
    ["put-with-id", 5],
    ["getall", 5],
    ["continue", 3],
    ["open-empty", 6],
    ["put", 6],
    ["error", 1],
    ["continue", 2],
    ["open", 4],
    ["get-empty", 7],
    ["count", 6],
    ["continue", 3],
    ["add", 7],
    ["getall", 7],
    ["error", 3],
    ["count", 7],
]);
