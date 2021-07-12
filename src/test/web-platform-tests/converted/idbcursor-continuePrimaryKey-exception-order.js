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

function setup_test_store(db) {
    var records = [
        { iKey: "A", pKey: 1 },
        { iKey: "A", pKey: 2 },
        { iKey: "A", pKey: 3 },
        { iKey: "A", pKey: 4 },
        { iKey: "B", pKey: 5 },
        { iKey: "B", pKey: 6 },
        { iKey: "B", pKey: 7 },
        { iKey: "C", pKey: 8 },
        { iKey: "C", pKey: 9 },
        { iKey: "D", pKey: 10 },
    ];

    var store = db.createObjectStore("test", { keyPath: "pKey" });
    var index = store.createIndex("idx", "iKey");

    for (var i = 0; i < records.length; i++) {
        store.add(records[i]);
    }

    return store;
}

indexeddb_test(
    function (t, db, txn) {
        var store = setup_test_store(db);
        var index = store.index("idx");
        var cursor_rq = index.openCursor();
        var cursor;

        cursor_rq.onerror = t.unreached_func("openCursor should succeed");
        cursor_rq.onsuccess = t.step_func(function (e) {
            cursor = e.target.result;
            assert_true(!!cursor, "acquire cursor");

            store.deleteIndex("idx");
        });
        txn.oncomplete = t.step_func(function () {
            assert_throws(
                "TransactionInactiveError",
                function () {
                    cursor.continuePrimaryKey("A", 4);
                },
                "transaction-state check should precede deletion check",
            );
            t.done();
        });
    },
    null,
    "TransactionInactiveError v.s. InvalidStateError(deleted index)",
);

indexeddb_test(
    function (t, db, txn) {
        var store = setup_test_store(db);
        var cursor_rq = store.openCursor();
        var cursor;

        cursor_rq.onerror = t.unreached_func("openCursor should succeed");
        cursor_rq.onsuccess = t.step_func(function (e) {
            cursor = e.target.result;
            assert_true(!!cursor, "acquire cursor");

            db.deleteObjectStore("test");

            assert_throws(
                "InvalidStateError",
                function () {
                    cursor.continuePrimaryKey("A", 4);
                },
                "deletion check should precede index source check",
            );
            t.done();
        });
    },
    null,
    "InvalidStateError(deleted source) v.s. InvalidAccessError(incorrect source)",
);

indexeddb_test(
    function (t, db, txn) {
        var store = setup_test_store(db);
        var index = store.index("idx");
        var cursor_rq = index.openCursor(null, "nextunique");
        var cursor;

        cursor_rq.onerror = t.unreached_func("openCursor should succeed");
        cursor_rq.onsuccess = t.step_func(function (e) {
            cursor = e.target.result;
            assert_true(!!cursor, "acquire cursor");

            store.deleteIndex("idx");

            assert_throws(
                "InvalidStateError",
                function () {
                    cursor.continuePrimaryKey("A", 4);
                },
                "deletion check should precede cursor direction check",
            );
            t.done();
        });
    },
    null,
    "InvalidStateError(deleted source) v.s. InvalidAccessError(incorrect direction)",
);

indexeddb_test(
    function (t, db, txn) {
        var store = db.createObjectStore("test", { keyPath: "pKey" });
        var index = store.createIndex("idx", "iKey");

        store.add({ iKey: "A", pKey: 1 });

        var cursor_rq = index.openCursor(null, "nextunique");
        var cursor;

        cursor_rq.onerror = t.unreached_func("openCursor should succeed");
        cursor_rq.onsuccess = t.step_func(function (e) {
            if (e.target.result) {
                cursor = e.target.result;
                cursor.continue();
                return;
            }

            assert_throws(
                "InvalidAccessError",
                function () {
                    cursor.continuePrimaryKey("A", 4);
                },
                "direction check should precede got_value_flag check",
            );
            t.done();
        });
    },
    null,
    "InvalidAccessError(incorrect direction) v.s. InvalidStateError(iteration complete)",
);

indexeddb_test(
    function (t, db, txn) {
        var store = db.createObjectStore("test", { keyPath: "pKey" });
        var index = store.createIndex("idx", "iKey");

        store.add({ iKey: "A", pKey: 1 });

        var cursor_rq = index.openCursor(null, "nextunique");
        var cursor;

        cursor_rq.onerror = t.unreached_func("openCursor should succeed");
        cursor_rq.onsuccess = t.step_func(function (e) {
            if (!cursor) {
                cursor = e.target.result;
                assert_true(!!cursor, "acquire cursor");

                cursor.continue();

                assert_throws(
                    "InvalidAccessError",
                    function () {
                        cursor.continuePrimaryKey("A", 4);
                    },
                    "direction check should precede iteration ongoing check",
                );
                t.done();
            }
        });
    },
    null,
    "InvalidAccessError(incorrect direction) v.s. InvalidStateError(iteration ongoing)",
);

indexeddb_test(
    function (t, db, txn) {
        var store = setup_test_store(db);
        var cursor_rq = store.openCursor();
        var cursor;

        cursor_rq.onerror = t.unreached_func("openCursor should succeed");
        cursor_rq.onsuccess = t.step_func(function (e) {
            if (!cursor) {
                cursor = e.target.result;
                assert_true(!!cursor, "acquire cursor");

                cursor.continue();

                assert_throws(
                    "InvalidAccessError",
                    function () {
                        cursor.continuePrimaryKey("A", 4);
                    },
                    "index source check should precede iteration ongoing check",
                );
                t.done();
            }
        });
    },
    null,
    "InvalidAccessError(incorrect source) v.s. InvalidStateError(iteration ongoing)",
);

indexeddb_test(
    function (t, db, txn) {
        var store = db.createObjectStore("test", { keyPath: "pKey" });

        store.add({ iKey: "A", pKey: 1 });

        var cursor_rq = store.openCursor();
        var cursor;

        cursor_rq.onerror = t.unreached_func("openCursor should succeed");
        cursor_rq.onsuccess = t.step_func(function (e) {
            if (e.target.result) {
                cursor = e.target.result;
                cursor.continue();
                return;
            }

            assert_throws(
                "InvalidAccessError",
                function () {
                    cursor.continuePrimaryKey("A", 4);
                },
                "index source check should precede got_value_flag check",
            );
            t.done();
        });
    },
    null,
    "InvalidAccessError(incorrect source) v.s. InvalidStateError(iteration complete)",
);

indexeddb_test(
    function (t, db, txn) {
        var store = setup_test_store(db);
        var index = store.index("idx");
        var cursor_rq = index.openCursor();
        var cursor;

        cursor_rq.onerror = t.unreached_func("openCursor should succeed");
        cursor_rq.onsuccess = t.step_func(function (e) {
            if (!cursor) {
                cursor = e.target.result;
                assert_true(!!cursor, "acquire cursor");

                cursor.continue();

                assert_throws(
                    "InvalidStateError",
                    function () {
                        cursor.continuePrimaryKey(null, 4);
                    },
                    "iteration ongoing check should precede unset key check",
                );
                t.done();
            }
        });
    },
    null,
    "InvalidStateError(iteration ongoing) v.s. DataError(unset key)",
);

indexeddb_test(
    function (t, db, txn) {
        var store = db.createObjectStore("test", { keyPath: "pKey" });
        var index = store.createIndex("idx", "iKey");

        store.add({ iKey: "A", pKey: 1 });

        var cursor_rq = index.openCursor();
        var cursor;

        cursor_rq.onerror = t.unreached_func("openCursor should succeed");
        cursor_rq.onsuccess = t.step_func(function (e) {
            if (e.target.result) {
                cursor = e.target.result;
                cursor.continue();
                return;
            }

            assert_throws(
                "InvalidStateError",
                function () {
                    cursor.continuePrimaryKey(null, 4);
                },
                "got_value_flag check should precede unset key check",
            );
            t.done();
        });
    },
    null,
    "InvalidStateError(iteration complete) v.s. DataError(unset key)",
);

indexeddb_test(
    function (t, db, txn) {
        var store = setup_test_store(db);
        var index = store.index("idx");
        var cursor_rq = index.openCursor();
        var cursor;

        cursor_rq.onerror = t.unreached_func("openCursor should succeed");
        cursor_rq.onsuccess = t.step_func(function (e) {
            cursor = e.target.result;
            assert_true(!!cursor, "acquire cursor");

            assert_throws(
                "DataError",
                function () {
                    cursor.continuePrimaryKey(null, 4);
                },
                "DataError is expected if key is unset.",
            );
            t.done();
        });
    },
    null,
    "DataError(unset key)",
);

indexeddb_test(
    function (t, db, txn) {
        var store = setup_test_store(db);
        var index = store.index("idx");
        var cursor_rq = index.openCursor();
        var cursor;

        cursor_rq.onerror = t.unreached_func("openCursor should succeed");
        cursor_rq.onsuccess = t.step_func(function (e) {
            cursor = e.target.result;
            assert_true(!!cursor, "acquire cursor");

            assert_throws(
                "DataError",
                function () {
                    cursor.continuePrimaryKey("A", null);
                },
                "DataError is expected if primary key is unset.",
            );
            t.done();
        });
    },
    null,
    "DataError(unset primary key)",
);

indexeddb_test(
    function (t, db, txn) {
        var store = setup_test_store(db);
        var index = store.index("idx");
        var cursor_rq = index.openCursor(IDBKeyRange.lowerBound("B"));
        var cursor;

        cursor_rq.onerror = t.unreached_func("openCursor should succeed");
        cursor_rq.onsuccess = t.step_func(function (e) {
            cursor = e.target.result;
            assert_true(!!cursor, "acquire cursor");

            assert_equals(cursor.key, "B", "expected key");
            assert_equals(cursor.primaryKey, 5, "expected primary key");

            assert_throws(
                "DataError",
                function () {
                    cursor.continuePrimaryKey("A", 6);
                },
                "DataError is expected if key is lower then current one.",
            );

            assert_throws(
                "DataError",
                function () {
                    cursor.continuePrimaryKey("B", 5);
                },
                "DataError is expected if primary key is equal to current one.",
            );

            assert_throws(
                "DataError",
                function () {
                    cursor.continuePrimaryKey("B", 4);
                },
                "DataError is expected if primary key is lower than current one.",
            );

            t.done();
        });
    },
    null,
    "DataError(keys are lower then current one) in 'next' direction",
);

indexeddb_test(
    function (t, db, txn) {
        var store = setup_test_store(db);
        var index = store.index("idx");
        var cursor_rq = index.openCursor(IDBKeyRange.upperBound("B"), "prev");
        var cursor;

        cursor_rq.onerror = t.unreached_func("openCursor should succeed");
        cursor_rq.onsuccess = t.step_func(function (e) {
            cursor = e.target.result;
            assert_true(!!cursor, "acquire cursor");

            assert_equals(cursor.key, "B", "expected key");
            assert_equals(cursor.primaryKey, 7, "expected primary key");

            assert_throws(
                "DataError",
                function () {
                    cursor.continuePrimaryKey("C", 6);
                },
                "DataError is expected if key is larger then current one.",
            );

            assert_throws(
                "DataError",
                function () {
                    cursor.continuePrimaryKey("B", 7);
                },
                "DataError is expected if primary key is equal to current one.",
            );

            assert_throws(
                "DataError",
                function () {
                    cursor.continuePrimaryKey("B", 8);
                },
                "DataError is expected if primary key is larger than current one.",
            );

            t.done();
        });
    },
    null,
    "DataError(keys are larger then current one) in 'prev' direction",
);
