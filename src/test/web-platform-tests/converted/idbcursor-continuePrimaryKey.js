import "../wpt-env.js";

/* Delete created databases
 *
 * Go through each finished test, see if it has an associated database. Close
 * that and delete the database. */
add_completion_callback(function (tests) {
    for (var i in tests) {
        if (tests[i].db) {
            tests[i].db.close();
            self.indexedDB.deleteDatabase(tests[i].db.name);
        }
    }
});

function fail(test, desc) {
    return test.step_func(function (e) {
        if (e && e.message && e.target.error)
            assert_unreached(
                desc + " (" + e.target.error.name + ": " + e.message + ")",
            );
        else if (e && e.message)
            assert_unreached(desc + " (" + e.message + ")");
        else if (e && e.target.readyState === "done" && e.target.error)
            assert_unreached(desc + " (" + e.target.error.name + ")");
        else assert_unreached(desc);
    });
}

function createdb(test, dbname, version) {
    var rq_open = createdb_for_multiple_tests(dbname, version);
    return rq_open.setTest(test);
}

function createdb_for_multiple_tests(dbname, version) {
    var rq_open,
        fake_open = {},
        test = null,
        dbname = dbname
            ? dbname
            : "testdb-" + new Date().getTime() + Math.random();

    if (version) rq_open = self.indexedDB.open(dbname, version);
    else rq_open = self.indexedDB.open(dbname);

    function auto_fail(evt, current_test) {
        /* Fail handlers, if we haven't set on/whatever/, don't
         * expect to get event whatever. */
        rq_open.manually_handled = {};

        rq_open.addEventListener(evt, function (e) {
            if (current_test !== test) {
                return;
            }

            test.step(function () {
                if (!rq_open.manually_handled[evt]) {
                    assert_unreached("unexpected open." + evt + " event");
                }

                if (
                    e.target.result + "" == "[object IDBDatabase]" &&
                    !this.db
                ) {
                    this.db = e.target.result;

                    this.db.onerror = fail(test, "unexpected db.error");
                    this.db.onabort = fail(test, "unexpected db.abort");
                    this.db.onversionchange = fail(
                        test,
                        "unexpected db.versionchange",
                    );
                }
            });
        });
        rq_open.__defineSetter__("on" + evt, function (h) {
            rq_open.manually_handled[evt] = true;
            if (!h) rq_open.addEventListener(evt, function () {});
            else rq_open.addEventListener(evt, test.step_func(h));
        });
    }

    // add a .setTest method to the IDBOpenDBRequest object
    Object.defineProperty(rq_open, "setTest", {
        enumerable: false,
        value: function (t) {
            test = t;

            auto_fail("upgradeneeded", test);
            auto_fail("success", test);
            auto_fail("blocked", test);
            auto_fail("error", test);

            return this;
        },
    });

    return rq_open;
}

function assert_key_equals(actual, expected, description) {
    assert_equals(indexedDB.cmp(actual, expected), 0, description);
}

function indexeddb_test(upgrade_func, open_func, description, options) {
    async_test(function (t) {
        options = Object.assign({ upgrade_will_abort: false }, options);
        var dbname = location + "-" + t.name;
        var del = indexedDB.deleteDatabase(dbname);
        del.onerror = t.unreached_func("deleteDatabase should succeed");
        var open = indexedDB.open(dbname, 1);
        open.onupgradeneeded = t.step_func(function () {
            var db = open.result;
            t.add_cleanup(function () {
                // If open didn't succeed already, ignore the error.
                open.onerror = function (e) {
                    e.preventDefault();
                };
                db.close();
                indexedDB.deleteDatabase(db.name);
            });
            var tx = open.transaction;
            upgrade_func(t, db, tx, open);
        });
        if (options.upgrade_will_abort) {
            open.onsuccess = t.unreached_func("open should not succeed");
        } else {
            open.onerror = t.unreached_func("open should succeed");
            open.onsuccess = t.step_func(function () {
                var db = open.result;
                if (open_func) open_func(t, db, open);
            });
        }
    }, description);
}

// Call with a Test and an array of expected results in order. Returns
// a function; call the function when a result arrives and when the
// expected number appear the order will be asserted and test
// completed.
function expect(t, expected) {
    var results = [];
    return (result) => {
        results.push(result);
        if (results.length === expected.length) {
            assert_array_equals(results, expected);
            t.done();
        }
    };
}

// Checks to see if the passed transaction is active (by making
// requests against the named store).
function is_transaction_active(tx, store_name) {
    try {
        const request = tx.objectStore(store_name).get(0);
        request.onerror = (e) => {
            e.preventDefault();
            e.stopPropagation();
        };
        return true;
    } catch (ex) {
        assert_equals(
            ex.name,
            "TransactionInactiveError",
            "Active check should either not throw anything, or throw " +
                "TransactionInactiveError",
        );
        return false;
    }
}

// Keeps the passed transaction alive indefinitely (by making requests
// against the named store). Returns a function that asserts that the
// transaction has not already completed and then ends the request loop so that
// the transaction may autocommit and complete.
function keep_alive(tx, store_name) {
    let completed = false;
    tx.addEventListener("complete", () => {
        completed = true;
    });

    let keepSpinning = true;

    function spin() {
        if (!keepSpinning) return;
        tx.objectStore(store_name).get(0).onsuccess = spin;
    }
    spin();

    return () => {
        assert_false(completed, "Transaction completed while kept alive");
        keepSpinning = false;
    };
}

("use strict");

indexeddb_test(
    (t, db, txn) => {
        const store = db.createObjectStore("store");
        const index = store.createIndex("index", "indexKey", {
            multiEntry: true,
        });

        store.put({ indexKey: ["a", "b"] }, 1);
        store.put({ indexKey: ["a", "b"] }, 2);
        store.put({ indexKey: ["a", "b"] }, 3);
        store.put({ indexKey: ["b"] }, 4);

        const expectedIndexEntries = [
            { key: "a", primaryKey: 1 },
            { key: "a", primaryKey: 2 },
            { key: "a", primaryKey: 3 },
            { key: "b", primaryKey: 1 },
            { key: "b", primaryKey: 2 },
            { key: "b", primaryKey: 3 },
            { key: "b", primaryKey: 4 },
        ];

        const request = index.openCursor();
        request.onerror = t.unreached_func(
            "IDBIndex.openCursor should not fail",
        );
        request.onsuccess = t.step_func(() => {
            const cursor = request.result;
            const expectedEntry = expectedIndexEntries.shift();
            if (expectedEntry) {
                assert_equals(
                    cursor.key,
                    expectedEntry.key,
                    "The index entry keys should reflect the object store contents",
                );
                assert_equals(
                    cursor.primaryKey,
                    expectedEntry.primaryKey,
                    "The index entry primary keys should reflect the object store " +
                        "contents",
                );
                cursor.continue();
            } else {
                assert_equals(
                    cursor,
                    null,
                    "The index should not have entries that do not reflect the " +
                        "object store contents",
                );
            }
        });
    },
    (t, db) => {
        const testCases = [
            // Continuing index key
            {
                call: (cursor) => {
                    cursor.continue();
                },
                result: { key: "a", primaryKey: 2 },
            },
            {
                call: (cursor) => {
                    cursor.continue("a");
                },
                exception: "DataError",
            },
            {
                call: (cursor) => {
                    cursor.continue("b");
                },
                result: { key: "b", primaryKey: 1 },
            },
            {
                call: (cursor) => {
                    cursor.continue("c");
                },
                result: null,
            },

            // Called w/ index key and primary key:
            {
                call: (cursor) => {
                    cursor.continuePrimaryKey("a", 3);
                },
                result: { key: "a", primaryKey: 3 },
            },
            {
                call: (cursor) => {
                    cursor.continuePrimaryKey("a", 4);
                },
                result: { key: "b", primaryKey: 1 },
            },
            {
                call: (cursor) => {
                    cursor.continuePrimaryKey("b", 1);
                },
                result: { key: "b", primaryKey: 1 },
            },
            {
                call: (cursor) => {
                    cursor.continuePrimaryKey("b", 4);
                },
                result: { key: "b", primaryKey: 4 },
            },
            {
                call: (cursor) => {
                    cursor.continuePrimaryKey("b", 5);
                },
                result: null,
            },
            {
                call: (cursor) => {
                    cursor.continuePrimaryKey("c", 1);
                },
                result: null,
            },

            // Called w/ primary key but w/o index key
            {
                call: (cursor) => {
                    cursor.continuePrimaryKey(null, 1);
                },
                exception: "DataError",
            },
            {
                call: (cursor) => {
                    cursor.continuePrimaryKey(null, 2);
                },
                exception: "DataError",
            },
            {
                call: (cursor) => {
                    cursor.continuePrimaryKey(null, 3);
                },
                exception: "DataError",
            },
            {
                call: (cursor) => {
                    cursor.continuePrimaryKey(null, 4);
                },
                exception: "DataError",
            },
            {
                call: (cursor) => {
                    cursor.continuePrimaryKey(null, 5);
                },
                exception: "DataError",
            },

            // Called w/ index key but w/o primary key
            {
                call: (cursor) => {
                    cursor.continuePrimaryKey("a", null);
                },
                exception: "DataError",
            },
        ];

        const verifyContinueCalls = () => {
            if (!testCases.length) {
                t.done();
                return;
            }

            const testCase = testCases.shift();

            const txn = db.transaction("store");
            txn.oncomplete = t.step_func(verifyContinueCalls);

            const request = txn
                .objectStore("store")
                .index("index")
                .openCursor();
            let calledContinue = false;
            request.onerror = t.unreached_func(
                "IDBIndex.openCursor should not fail",
            );
            request.onsuccess = t.step_func(() => {
                const cursor = request.result;
                if (calledContinue) {
                    if (testCase.result) {
                        assert_equals(
                            cursor.key,
                            testCase.result.key,
                            `${testCase.call.toString()} - result key`,
                        );
                        assert_equals(
                            cursor.primaryKey,
                            testCase.result.primaryKey,
                            `${testCase.call.toString()} - result primary key`,
                        );
                    } else {
                        assert_equals(cursor, null);
                    }
                } else {
                    calledContinue = true;
                    if ("exception" in testCase) {
                        assert_throws(
                            testCase.exception,
                            () => {
                                testCase.call(cursor);
                            },
                            testCase.call.toString(),
                        );
                    } else {
                        testCase.call(cursor);
                    }
                }
            });
        };
        verifyContinueCalls();
    },
);
