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

// Infrastructure shared by interleaved-cursors-{small,large}.html

// Number of objects that each iterator goes over.
const itemCount = 10;

// Ratio of small objects to large objects.
const largeObjectRatio = 5;

// Size of large objects. This should exceed the size of a block in the storage
// method underlying the browser's IndexedDB implementation. For example, this
// needs to exceed the LevelDB block size on Chrome, and the SQLite block size
// on Firefox.
const largeObjectSize = 48 * 1024;

function objectKey(cursorIndex, itemIndex) {
    return `${cursorIndex}-key-${itemIndex}`;
}

function objectValue(cursorIndex, itemIndex) {
    if ((cursorIndex * itemCount + itemIndex) % largeObjectRatio === 0) {
        // We use a typed array (as opposed to a string) because IndexedDB
        // implementations may serialize strings using UTF-8 or UTF-16, yielding
        // larger IndexedDB entries than we'd expect. It's very unlikely that an
        // IndexedDB implementation would use anything other than the raw buffer to
        // serialize a typed array.
        const buffer = new Uint8Array(largeObjectSize);

        // Some IndexedDB implementations, like LevelDB, compress their data blocks
        // before storing them to disk. We use a simple 32-bit xorshift PRNG, which
        // should be sufficient to foil any fast generic-purpose compression scheme.

        // 32-bit xorshift - the seed can't be zero
        let state = 1000 + (cursorIndex * itemCount + itemIndex);

        for (let i = 0; i < largeObjectSize; ++i) {
            state ^= state << 13;
            state ^= state >> 17;
            state ^= state << 5;
            buffer[i] = state & 0xff;
        }

        return buffer;
    }
    return [cursorIndex, "small", itemIndex];
}

// Writes the objects to be read by one cursor. Returns a promise that resolves
// when the write completes.
//
// We want to avoid creating a large transaction, because that is outside the
// test's scope, and it's a bad practice. So we break up the writes across
// multiple transactions. For simplicity, each transaction writes all the
// objects that will be read by a cursor.
function writeCursorObjects(database, cursorIndex) {
    return new Promise((resolve, reject) => {
        const transaction = database.transaction("cache", "readwrite");
        transaction.onabort = () => {
            reject(transaction.error);
        };

        const store = transaction.objectStore("cache");
        for (let i = 0; i < itemCount; ++i) {
            store.put({
                key: objectKey(cursorIndex, i),
                value: objectValue(cursorIndex, i),
            });
        }
        transaction.oncomplete = resolve;
    });
}

// Returns a promise that resolves when the store has been populated.
function populateTestStore(testCase, database, cursorCount) {
    let promiseChain = Promise.resolve();

    for (let i = 0; i < cursorCount; ++i)
        promiseChain = promiseChain.then(() => writeCursorObjects(database, i));

    return promiseChain;
}

// Reads cursors in an interleaved fashion, as shown below.
//
// Given N cursors, each of which points to the beginning of a K-item sequence,
// the following accesses will be made.
//
// OC(i)    = open cursor i
// RD(i, j) = read result of cursor i, which should be at item j
// CC(i)    = continue cursor i
// |        = wait for onsuccess on the previous OC or CC
//
// OC(1)            | RD(1, 1) OC(2) | RD(2, 1) OC(3) | ... | RD(n-1, 1) CC(n) |
// RD(n, 1)   CC(1) | RD(1, 2) CC(2) | RD(2, 2) CC(3) | ... | RD(n-1, 2) CC(n) |
// RD(n, 2)   CC(1) | RD(1, 3) CC(2) | RD(2, 3) CC(3) | ... | RD(n-1, 3) CC(n) |
// ...
// RD(n, k-1) CC(1) | RD(1, k) CC(2) | RD(2, k) CC(3) | ... | RD(n-1, k) CC(n) |
// RD(n, k)           done
function interleaveCursors(testCase, store, cursorCount) {
    return new Promise((resolve, reject) => {
        // The cursors used for iteration are stored here so each cursor's onsuccess
        // handler can call continue() on the next cursor.
        const cursors = [];

        // The results of IDBObjectStore.openCursor() calls are stored here so we
        // we can change the requests' onsuccess handler after every
        // IDBCursor.continue() call.
        const requests = [];

        const checkCursorState = (cursorIndex, itemIndex) => {
            const cursor = cursors[cursorIndex];
            assert_equals(cursor.key, objectKey(cursorIndex, itemIndex));
            assert_equals(cursor.value.key, objectKey(cursorIndex, itemIndex));
            assert_equals(
                cursor.value.value.join("-"),
                objectValue(cursorIndex, itemIndex).join("-"),
            );
        };

        const openCursor = (cursorIndex, callback) => {
            const request = store.openCursor(
                IDBKeyRange.lowerBound(objectKey(cursorIndex, 0)),
            );
            requests[cursorIndex] = request;

            request.onsuccess = testCase.step_func(() => {
                const cursor = request.result;
                cursors[cursorIndex] = cursor;
                checkCursorState(cursorIndex, 0);
                callback();
            });
            request.onerror = (event) => reject(request.error);
        };

        const readItemFromCursor = (cursorIndex, itemIndex, callback) => {
            const request = requests[cursorIndex];
            request.onsuccess = testCase.step_func(() => {
                const cursor = request.result;
                cursors[cursorIndex] = cursor;
                checkCursorState(cursorIndex, itemIndex);
                callback();
            });

            const cursor = cursors[cursorIndex];
            cursor.continue();
        };

        // We open all the cursors one at a time, then cycle through the cursors and
        // call continue() on each of them. This access pattern causes maximal
        // trashing to an LRU cursor cache. Eviction scheme aside, any cache will
        // have to evict some cursors, and this access pattern verifies that the
        // cache correctly restores the state of evicted cursors.
        const steps = [];
        for (let cursorIndex = 0; cursorIndex < cursorCount; ++cursorIndex)
            steps.push(openCursor.bind(null, cursorIndex));
        for (let itemIndex = 1; itemIndex < itemCount; ++itemIndex) {
            for (let cursorIndex = 0; cursorIndex < cursorCount; ++cursorIndex)
                steps.push(
                    readItemFromCursor.bind(null, cursorIndex, itemIndex),
                );
        }

        const runStep = (stepIndex) => {
            if (stepIndex === steps.length) {
                resolve();
                return;
            }
            steps[stepIndex](() => {
                runStep(stepIndex + 1);
            });
        };
        runStep(0);
    });
}

function cursorTest(cursorCount) {
    promise_test((testCase) => {
        return createDatabase(testCase, (database, transaction) => {
            const store = database.createObjectStore("cache", {
                keyPath: "key",
                autoIncrement: true,
            });
        })
            .then((database) => {
                return populateTestStore(testCase, database, cursorCount).then(
                    () => database,
                );
            })
            .then((database) => {
                database.close();
            })
            .then(() => {
                return openDatabase(testCase);
            })
            .then((database) => {
                const transaction = database.transaction("cache", "readonly");
                transaction.onabort = () => {
                    reject(transaction.error);
                };

                const store = transaction.objectStore("cache");
                return interleaveCursors(testCase, store, cursorCount).then(
                    () => database,
                );
            })
            .then((database) => {
                database.close();
            });
    }, `${cursorCount} cursors`);
}

cursorTest(1);
cursorTest(10);
cursorTest(100);
