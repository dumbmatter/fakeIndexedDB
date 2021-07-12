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

// Renames the 'books' store to 'renamed_books'.
//
// Returns a promise that resolves to an IndexedDB database. The caller must
// close the database.
const renameBooksStore = (testCase) => {
    return migrateDatabase(testCase, 2, (database, transaction) => {
        const store = transaction.objectStore("books");
        store.name = "renamed_books";
    });
};

promise_test((testCase) => {
    let bookStore = null,
        bookStore2 = null;
    let renamedBookStore = null,
        renamedBookStore2 = null;
    return createDatabase(testCase, (database, transaction) => {
        bookStore = createBooksStore(testCase, database);
    })
        .then((database) => {
            assert_array_equals(
                database.objectStoreNames,
                ["books"],
                'Test setup should have created a "books" object store',
            );
            const transaction = database.transaction("books", "readonly");
            bookStore2 = transaction.objectStore("books");
            return checkStoreContents(
                testCase,
                bookStore2,
                "The store should have the expected contents before any renaming",
            ).then(() => database.close());
        })
        .then(() =>
            migrateDatabase(testCase, 2, (database, transaction) => {
                renamedBookStore = transaction.objectStore("books");
                renamedBookStore.name = "renamed_books";

                assert_equals(
                    renamedBookStore.name,
                    "renamed_books",
                    "IDBObjectStore name should change immediately after a rename",
                );
                assert_array_equals(
                    database.objectStoreNames,
                    ["renamed_books"],
                    "IDBDatabase.objectStoreNames should immediately reflect the " +
                        "rename",
                );
                assert_array_equals(
                    transaction.objectStoreNames,
                    ["renamed_books"],
                    "IDBTransaction.objectStoreNames should immediately reflect the " +
                        "rename",
                );
                assert_equals(
                    transaction.objectStore("renamed_books"),
                    renamedBookStore,
                    "IDBTransaction.objectStore should return the renamed object " +
                        "store when queried using the new name immediately after the " +
                        "rename",
                );
                assert_throws(
                    "NotFoundError",
                    () => transaction.objectStore("books"),
                    "IDBTransaction.objectStore should throw when queried using the " +
                        "renamed object store's old name immediately after the rename",
                );
            }),
        )
        .then((database) => {
            assert_array_equals(
                database.objectStoreNames,
                ["renamed_books"],
                "IDBDatabase.objectStoreNames should still reflect the rename " +
                    "after the versionchange transaction commits",
            );
            const transaction = database.transaction(
                "renamed_books",
                "readonly",
            );
            renamedBookStore2 = transaction.objectStore("renamed_books");
            return checkStoreContents(
                testCase,
                renamedBookStore2,
                "Renaming an object store should not change its records",
            ).then(() => database.close());
        })
        .then(() => {
            assert_equals(
                bookStore.name,
                "books",
                "IDBObjectStore obtained before the rename transaction should " +
                    "not reflect the rename",
            );
            assert_equals(
                bookStore2.name,
                "books",
                "IDBObjectStore obtained before the rename transaction should " +
                    "not reflect the rename",
            );
            assert_equals(
                renamedBookStore.name,
                "renamed_books",
                "IDBObjectStore used in the rename transaction should keep " +
                    "reflecting the new name after the transaction is committed",
            );
            assert_equals(
                renamedBookStore2.name,
                "renamed_books",
                "IDBObjectStore obtained after the rename transaction should " +
                    "reflect the new name",
            );
        });
}, "IndexedDB object store rename in new transaction");

promise_test((testCase) => {
    let renamedBookStore = null,
        renamedBookStore2 = null;
    return createDatabase(testCase, (database, transaction) => {
        renamedBookStore = createBooksStore(testCase, database);
        renamedBookStore.name = "renamed_books";

        assert_equals(
            renamedBookStore.name,
            "renamed_books",
            "IDBObjectStore name should change immediately after a rename",
        );
        assert_array_equals(
            database.objectStoreNames,
            ["renamed_books"],
            "IDBDatabase.objectStoreNames should immediately reflect the " +
                "rename",
        );
        assert_array_equals(
            transaction.objectStoreNames,
            ["renamed_books"],
            "IDBTransaction.objectStoreNames should immediately reflect the " +
                "rename",
        );
        assert_equals(
            transaction.objectStore("renamed_books"),
            renamedBookStore,
            "IDBTransaction.objectStore should return the renamed object " +
                "store when queried using the new name immediately after the " +
                "rename",
        );
        assert_throws(
            "NotFoundError",
            () => transaction.objectStore("books"),
            "IDBTransaction.objectStore should throw when queried using the " +
                "renamed object store's old name immediately after the rename",
        );
    })
        .then((database) => {
            assert_array_equals(
                database.objectStoreNames,
                ["renamed_books"],
                "IDBDatabase.objectStoreNames should still reflect the rename " +
                    "after the versionchange transaction commits",
            );
            const transaction = database.transaction(
                "renamed_books",
                "readonly",
            );
            renamedBookStore2 = transaction.objectStore("renamed_books");
            return checkStoreContents(
                testCase,
                renamedBookStore2,
                "Renaming an object store should not change its records",
            ).then(() => database.close());
        })
        .then(() => {
            assert_equals(
                renamedBookStore.name,
                "renamed_books",
                "IDBObjectStore used in the rename transaction should keep " +
                    "reflecting the new name after the transaction is committed",
            );
            assert_equals(
                renamedBookStore2.name,
                "renamed_books",
                "IDBObjectStore obtained after the rename transaction should " +
                    "reflect the new name",
            );
        });
}, "IndexedDB object store rename in the transaction where it is created");

promise_test((testCase) => {
    return createDatabase(testCase, (database, transaction) => {
        createBooksStore(testCase, database);
    })
        .then((database) => {
            const transaction = database.transaction("books", "readonly");
            const store = transaction.objectStore("books");
            return checkStoreIndexes(
                testCase,
                store,
                "The object store index should have the expected contens before " +
                    "any renaming",
            ).then(() => database.close());
        })
        .then(() => renameBooksStore(testCase))
        .then((database) => {
            const transaction = database.transaction(
                "renamed_books",
                "readonly",
            );
            const store = transaction.objectStore("renamed_books");
            return checkStoreIndexes(
                testCase,
                store,
                "Renaming an object store should not change its indexes",
            ).then(() => database.close());
        });
}, "IndexedDB object store rename covers index");

promise_test((testCase) => {
    return createDatabase(testCase, (database, transaction) => {
        createBooksStore(testCase, database);
    })
        .then((database) => {
            const transaction = database.transaction("books", "readwrite");
            const store = transaction.objectStore("books");
            return checkStoreGenerator(
                testCase,
                store,
                345679,
                "The object store key generator should have the expected state " +
                    "before any renaming",
            ).then(() => database.close());
        })
        .then(() => renameBooksStore(testCase))
        .then((database) => {
            const transaction = database.transaction(
                "renamed_books",
                "readwrite",
            );
            const store = transaction.objectStore("renamed_books");
            return checkStoreGenerator(
                testCase,
                store,
                345680,
                "Renaming an object store should not change the state of its key " +
                    "generator",
            ).then(() => database.close());
        });
}, "IndexedDB object store rename covers key generator");

promise_test((testCase) => {
    return createDatabase(testCase, (database, transaction) => {
        createBooksStore(testCase, database);
    })
        .then((database) => {
            database.close();
        })
        .then(() =>
            migrateDatabase(testCase, 2, (database, transaction) => {
                const store = transaction.objectStore("books");
                store.name = "books";
                assert_array_equals(
                    database.objectStoreNames,
                    ["books"],
                    "Renaming a store to the same name should not change " +
                        "the store's IDBDatabase.objectStoreNames",
                );
            }),
        )
        .then((database) => {
            assert_array_equals(
                database.objectStoreNames,
                ["books"],
                "Committing a transaction that renames a store to the same name " +
                    "should not change the store's IDBDatabase.objectStoreNames",
            );
            const transaction = database.transaction("books", "readonly");
            const store = transaction.objectStore("books");
            return checkStoreContents(
                testCase,
                store,
                "Committing a transaction that renames a store to the same name " +
                    "should not change the store's contents",
            ).then(() => database.close());
        });
}, "IndexedDB object store rename to the same name succeeds");

promise_test((testCase) => {
    return createDatabase(testCase, (database, transaction) => {
        createBooksStore(testCase, database);
        createNotBooksStore(testCase, database);
    })
        .then((database) => {
            database.close();
        })
        .then(() =>
            migrateDatabase(testCase, 2, (database, transaction) => {
                const store = transaction.objectStore("books");
                database.deleteObjectStore("not_books");
                store.name = "not_books";
                assert_array_equals(
                    database.objectStoreNames,
                    ["not_books"],
                    "IDBDatabase.objectStoreNames should immediately reflect the " +
                        "rename",
                );
            }),
        )
        .then((database) => {
            assert_array_equals(
                database.objectStoreNames,
                ["not_books"],
                "IDBDatabase.objectStoreNames should still reflect the rename " +
                    "after the versionchange transaction commits",
            );
            const transaction = database.transaction("not_books", "readonly");
            const store = transaction.objectStore("not_books");
            return checkStoreContents(
                testCase,
                store,
                "Renaming an object store should not change its records",
            ).then(() => database.close());
        });
}, "IndexedDB object store rename to the name of a deleted store succeeds");

promise_test((testCase) => {
    return createDatabase(testCase, (database, transaction) => {
        createBooksStore(testCase, database);
        createNotBooksStore(testCase, database);
    })
        .then((database) => {
            database.close();
        })
        .then(() =>
            migrateDatabase(testCase, 2, (database, transaction) => {
                const bookStore = transaction.objectStore("books");
                const notBookStore = transaction.objectStore("not_books");

                transaction.objectStore("books").name = "tmp";
                transaction.objectStore("not_books").name = "books";
                transaction.objectStore("tmp").name = "not_books";

                assert_array_equals(
                    database.objectStoreNames,
                    ["books", "not_books"],
                    "IDBDatabase.objectStoreNames should immediately reflect the swap",
                );

                assert_equals(
                    transaction.objectStore("books"),
                    notBookStore,
                    'IDBTransaction.objectStore should return the original "books" ' +
                        'store when queried with "not_books" after the swap',
                );
                assert_equals(
                    transaction.objectStore("not_books"),
                    bookStore,
                    "IDBTransaction.objectStore should return the original " +
                        '"not_books" store when queried with "books" after the swap',
                );
            }),
        )
        .then((database) => {
            assert_array_equals(
                database.objectStoreNames,
                ["books", "not_books"],
                "IDBDatabase.objectStoreNames should still reflect the swap " +
                    "after the versionchange transaction commits",
            );
            const transaction = database.transaction("not_books", "readonly");
            const store = transaction.objectStore("not_books");
            assert_array_equals(
                store.indexNames,
                ["by_author", "by_title"],
                '"not_books" index names should still reflect the swap after the ' +
                    "versionchange transaction commits",
            );
            return checkStoreContents(
                testCase,
                store,
                "Swapping two object stores should not change their records",
            ).then(() => database.close());
        });
}, "IndexedDB object store swapping via renames succeeds");

promise_test((testCase) => {
    return createDatabase(testCase, (database, transaction) => {
        createBooksStore(testCase, database);
    })
        .then((database) => {
            database.close();
        })
        .then(() =>
            migrateDatabase(testCase, 2, (database, transaction) => {
                const store = transaction.objectStore("books");

                store.name = 42;
                assert_equals(
                    store.name,
                    "42",
                    "IDBObjectStore name should change immediately after a " +
                        "rename to a number",
                );
                assert_array_equals(
                    database.objectStoreNames,
                    ["42"],
                    "IDBDatabase.objectStoreNames should immediately reflect the " +
                        "stringifying rename",
                );

                store.name = true;
                assert_equals(
                    store.name,
                    "true",
                    "IDBObjectStore name should change immediately after a " +
                        "rename to a boolean",
                );

                store.name = {};
                assert_equals(
                    store.name,
                    "[object Object]",
                    "IDBObjectStore name should change immediately after a " +
                        "rename to an object",
                );

                store.name = () => null;
                assert_equals(
                    store.name,
                    "() => null",
                    "IDBObjectStore name should change immediately after a " +
                        "rename to a function",
                );

                store.name = undefined;
                assert_equals(
                    store.name,
                    "undefined",
                    "IDBObjectStore name should change immediately after a " +
                        "rename to undefined",
                );
            }),
        )
        .then((database) => {
            assert_array_equals(
                database.objectStoreNames,
                ["undefined"],
                "IDBDatabase.objectStoreNames should reflect the last rename " +
                    "after the versionchange transaction commits",
            );
            const transaction = database.transaction("undefined", "readonly");
            const store = transaction.objectStore("undefined");
            return checkStoreContents(
                testCase,
                store,
                "Renaming an object store should not change its records",
            ).then(() => database.close());
        });
}, "IndexedDB object store rename stringifies non-string names");

for (let escapedName of ["", "\\u0000", "\\uDC00\\uD800"])
    ((escapedName) => {
        const name = JSON.parse('"' + escapedName + '"');
        promise_test((testCase) => {
            return createDatabase(testCase, (database, transaction) => {
                createBooksStore(testCase, database);
            })
                .then((database) => {
                    database.close();
                })
                .then(() =>
                    migrateDatabase(testCase, 2, (database, transaction) => {
                        const store = transaction.objectStore("books");

                        store.name = name;
                        assert_equals(
                            store.name,
                            name,
                            "IDBObjectStore name should change immediately after the " +
                                "rename",
                        );
                        assert_array_equals(
                            database.objectStoreNames,
                            [name],
                            "IDBDatabase.objectStoreNames should immediately reflect the " +
                                "rename",
                        );
                    }),
                )
                .then((database) => {
                    assert_array_equals(
                        database.objectStoreNames,
                        [name],
                        "IDBDatabase.objectStoreNames should reflect the rename " +
                            "after the versionchange transaction commits",
                    );
                    const transaction = database.transaction(name, "readonly");
                    const store = transaction.objectStore(name);
                    return checkStoreContents(
                        testCase,
                        store,
                        "Renaming an object store should not change its records",
                    ).then(() => database.close());
                });
        }, 'IndexedDB object store can be renamed to "' + escapedName + '"');
    })(escapedName);
