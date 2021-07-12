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

// Returns an IndexedDB value created from a descriptor.
//
// See the bottom of the file for descriptor samples.
function createValue(descriptor) {
    if (typeof descriptor != "object") return descriptor;

    if (Array.isArray(descriptor))
        return descriptor.map((element) => createValue(element));

    if (!descriptor.hasOwnProperty("type")) {
        const value = {};
        for (let property of Object.getOwnPropertyNames(descriptor))
            value[property] = createValue(descriptor[property]);
        return value;
    }

    switch (descriptor.type) {
        case "blob":
            return new Blob([largeValue(descriptor.size, descriptor.seed)], {
                type: descriptor.mimeType,
            });
        case "buffer":
            return largeValue(descriptor.size, descriptor.seed);
    }
}

// Checks an IndexedDB value against a descriptor.
//
// Returns a Promise that resolves if the value passes the check.
//
// See the bottom of the file for descriptor samples.
function checkValue(testCase, value, descriptor) {
    if (typeof descriptor != "object") {
        assert_equals(
            descriptor,
            value,
            "IndexedDB result should match put() argument",
        );
        return Promise.resolve();
    }

    if (Array.isArray(descriptor)) {
        assert_true(
            Array.isArray(value),
            "IndexedDB result type should match put() argument",
        );
        assert_equals(
            descriptor.length,
            value.length,
            "IndexedDB result array size should match put() argument",
        );

        const subChecks = [];
        for (let i = 0; i < descriptor.length; ++i)
            subChecks.push(checkValue(testCase, value[i], descriptor[i]));
        return Promise.all(subChecks);
    }

    if (!descriptor.hasOwnProperty("type")) {
        assert_array_equals(
            Object.getOwnPropertyNames(value).sort(),
            Object.getOwnPropertyNames(descriptor).sort(),
            "IndexedDB result object properties should match put() argument",
        );
        const subChecks = [];
        return Promise.all(
            Object.getOwnPropertyNames(descriptor).map((property) =>
                checkValue(testCase, value[property], descriptor[property]),
            ),
        );
    }

    switch (descriptor.type) {
        case "blob":
            assert_class_string(
                value,
                "Blob",
                "IndexedDB result class should match put() argument",
            );
            assert_equals(
                descriptor.mimeType,
                value.type,
                "IndexedDB result Blob MIME type should match put() argument",
            );
            assert_equals(descriptor.size, value.size, "incorrect Blob size");
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = testCase.step_func(() => {
                    if (reader.error) {
                        reject(reader.error);
                        return;
                    }
                    const view = new Uint8Array(reader.result);
                    assert_equals(
                        view.join(","),
                        largeValue(descriptor.size, descriptor.seed).join(","),
                        "IndexedDB result Blob content should match put() argument",
                    );
                    resolve();
                });
                reader.readAsArrayBuffer(value);
            });

        case "buffer":
            assert_class_string(
                value,
                "Uint8Array",
                "IndexedDB result type should match put() argument",
            );
            assert_equals(
                value.join(","),
                largeValue(descriptor.size, descriptor.seed).join(","),
                "IndexedDB result typed array content should match put() argument",
            );
            return Promise.resolve();
    }
}

function cloningTestInternal(label, valueDescriptors, options) {
    promise_test((testCase) => {
        return createDatabase(testCase, (database, transaction) => {
            let store;
            if (options.useKeyGenerator) {
                store = database.createObjectStore("test-store", {
                    keyPath: "primaryKey",
                    autoIncrement: true,
                });
            } else {
                store = database.createObjectStore("test-store");
            }
            for (let i = 0; i < valueDescriptors.length; ++i) {
                if (options.useKeyGenerator) {
                    store.put(createValue(valueDescriptors[i]));
                } else {
                    store.put(createValue(valueDescriptors[i]), i + 1);
                }
            }
        }).then((database) => {
            const transaction = database.transaction(
                ["test-store"],
                "readonly",
            );
            const store = transaction.objectStore("test-store");
            const subChecks = [];
            let resultIndex = 0;
            for (let i = 0; i < valueDescriptors.length; ++i) {
                subChecks.push(
                    new Promise((resolve, reject) => {
                        const requestIndex = i;
                        const primaryKey = requestIndex + 1;
                        const request = store.get(primaryKey);
                        request.onerror = testCase.step_func(() => {
                            reject(request.error);
                        });
                        request.onsuccess = testCase.step_func(() => {
                            assert_equals(
                                resultIndex,
                                requestIndex,
                                "IDBRequest success events should be fired in request order",
                            );
                            ++resultIndex;

                            const result = request.result;
                            if (options.useKeyGenerator) {
                                assert_equals(
                                    result.primaryKey,
                                    primaryKey,
                                    "IndexedDB result should have auto-incremented primary key",
                                );
                                delete result.primaryKey;
                            }
                            resolve(
                                checkValue(
                                    testCase,
                                    result,
                                    valueDescriptors[requestIndex],
                                ),
                            );
                        });
                    }),
                );
            }

            subChecks.push(
                new Promise((resolve, reject) => {
                    const requestIndex = valueDescriptors.length;
                    const request = store.getAll();
                    request.onerror = testCase.step_func(() => {
                        reject(request.error);
                    });
                    request.onsuccess = testCase.step_func(() => {
                        assert_equals(
                            resultIndex,
                            requestIndex,
                            "IDBRequest success events should be fired in request order",
                        );
                        ++resultIndex;
                        const result = request.result;
                        if (options.useKeyGenerator) {
                            for (let i = 0; i < valueDescriptors.length; ++i) {
                                const primaryKey = i + 1;
                                assert_equals(
                                    result[i].primaryKey,
                                    primaryKey,
                                    "IndexedDB result should have auto-incremented primary key",
                                );
                                delete result[i].primaryKey;
                            }
                        }
                        resolve(checkValue(testCase, result, valueDescriptors));
                    });
                }),
            );

            return Promise.all(subChecks);
        });
    }, label);
}

// Performs a series of put()s and verifies that get()s and getAll() match.
//
// Each element of the valueDescriptors array is fed into createValue(), and the
// resulting value is written to IndexedDB via a put() request. After the writes
// complete, the values are read in the same order in which they were written.
// Last, all the results are read one more time via a getAll().
//
// The test verifies that the get() / getAll() results match the arguments to
// put() and that the order in which the get() result events are fired matches
// the order of the get() requests.
function cloningTest(label, valueDescriptors) {
    cloningTestInternal(label, valueDescriptors, { useKeyGenerator: false });
}

// cloningTest, with coverage for key generators.
//
// This creates two tests. One test performs a series of put()s and verifies
// that get()s and getAll() match, exactly like cloningTestWithoutKeyGenerator.
// The other test performs the same put()s in an object store with a key
// generator, and checks that the key generator works properly.
function cloningTestWithKeyGenerator(label, valueDescriptors) {
    cloningTestInternal(label, valueDescriptors, { useKeyGenerator: false });
    cloningTestInternal(label + " with key generator", valueDescriptors, {
        useKeyGenerator: true,
    });
}

cloningTest("small typed array", [{ type: "buffer", size: 64, seed: 1 }]);

cloningTest("blob", [
    { type: "blob", size: wrapThreshold, mimeType: "text/x-blink-1", seed: 1 },
]);

cloningTestWithKeyGenerator("blob with small typed array", [
    {
        blob: {
            type: "blob",
            size: wrapThreshold,
            mimeType: "text/x-blink-01",
            seed: 1,
        },
        buffer: { type: "buffer", size: 64, seed: 2 },
    },
]);

cloningTestWithKeyGenerator("blob array", [
    [
        {
            type: "blob",
            size: wrapThreshold,
            mimeType: "text/x-blink-1",
            seed: 1,
        },
        {
            type: "blob",
            size: wrapThreshold,
            mimeType: "text/x-blink-2",
            seed: 2,
        },
        {
            type: "blob",
            size: wrapThreshold,
            mimeType: "text/x-blink-3",
            seed: 3,
        },
    ],
]);

cloningTestWithKeyGenerator("array of blobs and small typed arrays", [
    [
        {
            type: "blob",
            size: wrapThreshold,
            mimeType: "text/x-blink-01",
            seed: 1,
        },
        { type: "buffer", size: 64, seed: 2 },
        {
            type: "blob",
            size: wrapThreshold,
            mimeType: "text/x-blink-03",
            seed: 3,
        },
        { type: "buffer", size: 64, seed: 4 },
        {
            type: "blob",
            size: wrapThreshold,
            mimeType: "text/x-blink-05",
            seed: 5,
        },
    ],
]);
