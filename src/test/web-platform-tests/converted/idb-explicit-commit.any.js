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

// META: script=support-promises.js

/**
 * This file contains the webplatform tests for the explicit commit() method
 * of the IndexedDB transaction API.
 *
 * @author andreasbutler@google.com
 */

promise_test(async (testCase) => {
    const db = await createDatabase(testCase, (db) => {
        createBooksStore(testCase, db);
    });
    const txn = db.transaction(["books"], "readwrite");
    const objectStore = txn.objectStore("books");
    objectStore.put({ isbn: "one", title: "title1" });
    objectStore.put({ isbn: "two", title: "title2" });
    objectStore.put({ isbn: "three", title: "title3" });
    txn.commit();
    await promiseForTransaction(testCase, txn);

    const txn2 = db.transaction(["books"], "readonly");
    const objectStore2 = txn2.objectStore("books");
    const getRequestitle1 = objectStore2.get("one");
    const getRequestitle2 = objectStore2.get("two");
    const getRequestitle3 = objectStore2.get("three");
    txn2.commit();
    await promiseForTransaction(testCase, txn2);
    assert_array_equals(
        [
            getRequestitle1.result.title,
            getRequestitle2.result.title,
            getRequestitle3.result.title,
        ],
        ["title1", "title2", "title3"],
        "All three retrieved titles should match those that were put.",
    );
    db.close();
}, "Explicitly committed data can be read back out.");

promise_test(async (testCase) => {
    let db = await createDatabase(testCase, () => {});
    assert_equals(1, db.version, "A database should be created as version 1");
    db.close();

    // Upgrade the versionDB database and explicitly commit its versionchange
    // transaction.
    db = await migrateDatabase(testCase, 2, (db, txn) => {
        txn.commit();
    });
    assert_equals(
        2,
        db.version,
        "The database version should have been incremented regardless of " +
            "whether the versionchange transaction was explicitly or implicitly " +
            "committed.",
    );
    db.close();
}, "commit() on a version change transaction does not cause errors.");

promise_test(async (testCase) => {
    const db = await createDatabase(testCase, (db) => {
        createBooksStore(testCase, db);
    });
    const txn = db.transaction(["books"], "readwrite");
    const objectStore = txn.objectStore("books");
    txn.commit();
    assert_throws(
        "TransactionInactiveError",
        () => {
            objectStore.put({ isbn: "one", title: "title1" });
        },
        "After commit is called, the transaction should be inactive.",
    );
    db.close();
}, "A committed transaction becomes inactive immediately.");

promise_test(async (testCase) => {
    const db = await createDatabase(testCase, (db) => {
        createBooksStore(testCase, db);
    });
    const txn = db.transaction(["books"], "readwrite");
    const objectStore = txn.objectStore("books");
    const putRequest = objectStore.put({ isbn: "one", title: "title1" });
    putRequest.onsuccess = testCase.step_func(() => {
        assert_throws(
            "TransactionInactiveError",
            () => {
                objectStore.put({ isbn: "two", title: "title2" });
            },
            "The transaction should not be active in the callback of a request after " +
                "commit() is called.",
        );
    });
    txn.commit();
    await promiseForTransaction(testCase, txn);
    db.close();
}, "A committed transaction is inactive in future request callbacks.");

promise_test(async (testCase) => {
    const db = await createDatabase(testCase, (db) => {
        createBooksStore(testCase, db);
    });
    const txn = db.transaction(["books"], "readwrite");
    const objectStore = txn.objectStore("books");
    txn.commit();

    assert_throws(
        "TransactionInactiveError",
        () => {
            objectStore.put({ isbn: "one", title: "title1" });
        },
        "After commit is called, the transaction should be inactive.",
    );

    const txn2 = db.transaction(["books"], "readonly");
    const objectStore2 = txn2.objectStore("books");
    const getRequest = objectStore2.get("one");
    await promiseForTransaction(testCase, txn2);
    assert_equals(getRequest.result, undefined);

    db.close();
}, "Puts issued after commit are not fulfilled.");

promise_test(async (testCase) => {
    const db = await createDatabase(testCase, (db) => {
        createBooksStore(testCase, db);
    });
    const txn = db.transaction(["books"], "readwrite");
    const objectStore = txn.objectStore("books");
    txn.abort();
    assert_throws(
        "InvalidStateError",
        () => {
            txn.commit();
        },
        "The transaction should have been aborted.",
    );
    db.close();
}, "Calling commit on an aborted transaction throws.");

promise_test(async (testCase) => {
    const db = await createDatabase(testCase, (db) => {
        createBooksStore(testCase, db);
    });
    const txn = db.transaction(["books"], "readwrite");
    const objectStore = txn.objectStore("books");
    txn.commit();
    assert_throws(
        "InvalidStateError",
        () => {
            txn.commit();
        },
        "The transaction should have already committed.",
    );
    db.close();
}, "Calling commit on a committed transaction throws.");

promise_test(async (testCase) => {
    const db = await createDatabase(testCase, (db) => {
        createBooksStore(testCase, db);
    });
    const txn = db.transaction(["books"], "readwrite");
    const objectStore = txn.objectStore("books");
    const putRequest = objectStore.put({ isbn: "one", title: "title1" });
    txn.commit();
    assert_throws(
        "InvalidStateError",
        () => {
            txn.abort();
        },
        "The transaction should already have committed.",
    );
    const txn2 = db.transaction(["books"], "readwrite");
    const objectStore2 = txn2.objectStore("books");
    const getRequest = objectStore2.get("one");
    await promiseForTransaction(testCase, txn2);
    assert_equals(
        getRequest.result.title,
        "title1",
        "Explicitly committed data should be gettable.",
    );
    db.close();
}, "Calling abort on a committed transaction throws and does not prevent " + "persisting the data.");

promise_test(async (testCase) => {
    const db = await createDatabase(testCase, (db) => {
        createBooksStore(testCase, db);
    });
    const txn = db.transaction(["books"], "readwrite");
    const objectStore = txn.objectStore("books");
    const releaseTxnFunction = keepAlive(testCase, txn, "books");

    // Break up the scope of execution to force the transaction into an inactive
    // state.
    await timeoutPromise(0);

    assert_throws(
        "InvalidStateError",
        () => {
            txn.commit();
        },
        "The transaction should be inactive so calling commit should throw.",
    );
    releaseTxnFunction();
    db.close();
}, "Calling txn.commit() when txn is inactive should throw.");

promise_test(async (testCase) => {
    const db = await createDatabase(testCase, (db) => {
        createBooksStore(testCase, db);
        createNotBooksStore(testCase, db);
    });
    // Txn1 should commit before txn2, even though txn2 uses commit().
    const txn1 = db.transaction(["books"], "readwrite");
    txn1.objectStore("books").put({ isbn: "one", title: "title1" });
    const releaseTxnFunction = keepAlive(testCase, txn1, "books");

    const txn2 = db.transaction(["books"], "readwrite");
    txn2.objectStore("books").put({ isbn: "one", title: "title2" });
    txn2.commit();

    // Exercise the IndexedDB transaction ordering by executing one with a
    // different scope.
    const txn3 = db.transaction(["not_books"], "readwrite");
    txn3.objectStore("not_books").put({ title: "not_title" }, "key");
    txn3.oncomplete = function () {
        releaseTxnFunction();
    };
    await Promise.all([
        promiseForTransaction(testCase, txn1),
        promiseForTransaction(testCase, txn2),
    ]);

    // Read the data back to verify that txn2 executed last.
    const txn4 = db.transaction(["books"], "readonly");
    const getRequest4 = txn4.objectStore("books").get("one");
    await promiseForTransaction(testCase, txn4);
    assert_equals(getRequest4.result.title, "title2");
    db.close();
}, "Transactions with same scope should stay in program order, even if one " + "calls commit.");

promise_test(async (testCase) => {
    const db = await createDatabase(testCase, (db) => {
        createBooksStore(testCase, db);
    });
    // Txn1 creates the book 'one' so the 'add()' below fails.
    const txn1 = db.transaction(["books"], "readwrite");
    txn1.objectStore("books").add({ isbn: "one", title: "title1" });
    txn1.commit();
    await promiseForTransaction(testCase, txn1);

    // Txn2 should abort, because the 'add' call is invalid, and commit() was
    // called.
    const txn2 = db.transaction(["books"], "readwrite");
    const objectStore2 = txn2.objectStore("books");
    objectStore2.put({ isbn: "two", title: "title2" });
    const addRequest = objectStore2.add({ isbn: "one", title: "title2" });
    txn2.commit();
    txn2.oncomplete = () => {
        assert_unreached(
            'Transaction with invalid "add" call should not be completed.',
        );
    };

    // Wait for the transaction to complete. We have to explicitly wait for the
    // error signal on the transaction because of the nature of the test tooling.
    await Promise.all([
        requestWatcher(testCase, addRequest).wait_for("error"),
        transactionWatcher(testCase, txn2).wait_for(["error", "abort"]),
    ]);

    // Read the data back to verify that txn2 was aborted.
    const txn3 = db.transaction(["books"], "readonly");
    const objectStore3 = txn3.objectStore("books");
    const getRequest1 = objectStore3.get("one");
    const getRequest2 = objectStore3.count("two");
    await promiseForTransaction(testCase, txn3);
    assert_equals(getRequest1.result.title, "title1");
    assert_equals(getRequest2.result, 0);
    db.close();
}, "Transactions that explicitly commit and have errors should abort.");

promise_test(async (testCase) => {
    const db = await createDatabase(testCase, (db) => {
        createBooksStore(testCase, db);
    });
    const txn1 = db.transaction(["books"], "readwrite");
    txn1.objectStore("books").add({ isbn: "one", title: "title1" });
    txn1.commit();
    await promiseForTransaction(testCase, txn1);

    // The second add request will throw an error, but the onerror handler will
    // appropriately catch the error allowing the valid put request on the
    // transaction to commit.
    const txn2 = db.transaction(["books"], "readwrite");
    const objectStore2 = txn2.objectStore("books");
    objectStore2.put({ isbn: "two", title: "title2" });
    const addRequest = objectStore2.add({
        isbn: "one",
        title: "unreached_title",
    });
    addRequest.onerror = (event) => {
        event.preventDefault();
        addRequest.transaction.commit();
    };

    // Wait for the transaction to complete. We have to explicitly wait for the
    // error signal on the transaction because of the nature of the test tooling.
    await transactionWatcher(testCase, txn2).wait_for(["error", "complete"]);

    // Read the data back to verify that txn2 was committed.
    const txn3 = db.transaction(["books"], "readonly");
    const objectStore3 = txn3.objectStore("books");
    const getRequest1 = objectStore3.get("one");
    const getRequest2 = objectStore3.get("two");
    await promiseForTransaction(testCase, txn3);
    assert_equals(getRequest1.result.title, "title1");
    assert_equals(getRequest2.result.title, "title2");
    db.close();
}, "Transactions that handle all errors properly should be behave as " + "expected when an explicit commit is called in an onerror handler.");
