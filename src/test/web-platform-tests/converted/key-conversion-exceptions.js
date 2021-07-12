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

// Convenience function for tests that only need to run code in onupgradeneeded.
function indexeddb_upgrade_only_test(upgrade_callback, description) {
    indexeddb_test(
        upgrade_callback,
        (t) => {
            t.done();
        },
        description,
    );
}

// Key that throws during conversion.
function throwing_key(name) {
    var throws = [];
    throws.length = 1;
    Object.defineProperty(throws, "0", {
        get: function () {
            var err = new Error("throwing from getter");
            err.name = name;
            throw err;
        },
        enumerable: true,
    });
    return throws;
}

var valid_key = [];
var invalid_key = {};

// Calls method on receiver with the specified number of args (default 1)
// and asserts that the method fails appropriately (rethrowing if
// conversion throws, or DataError if not a valid key), and that
// the first argument is fully processed before the second argument
// (if appropriate).
function check_method(receiver, method, args) {
    args = args || 1;
    if (args < 2) {
        assert_throws(
            { name: "getter" },
            () => {
                receiver[method](throwing_key("getter"));
            },
            "key conversion with throwing getter should rethrow",
        );

        assert_throws(
            "DataError",
            () => {
                receiver[method](invalid_key);
            },
            "key conversion with invalid key should throw DataError",
        );
    } else {
        assert_throws(
            { name: "getter 1" },
            () => {
                receiver[method](
                    throwing_key("getter 1"),
                    throwing_key("getter 2"),
                );
            },
            "first key conversion with throwing getter should rethrow",
        );

        assert_throws(
            "DataError",
            () => {
                receiver[method](invalid_key, throwing_key("getter 2"));
            },
            "first key conversion with invalid key should throw DataError",
        );

        assert_throws(
            { name: "getter 2" },
            () => {
                receiver[method](valid_key, throwing_key("getter 2"));
            },
            "second key conversion with throwing getter should rethrow",
        );

        assert_throws(
            "DataError",
            () => {
                receiver[method](valid_key, invalid_key);
            },
            "second key conversion with invalid key should throw DataError",
        );
    }
}

// Static key comparison utility on IDBFactory.
test((t) => {
    check_method(indexedDB, "cmp", 2);
}, "IDBFactory cmp() static with throwing/invalid keys");

// Continue methods on IDBCursor.
indexeddb_upgrade_only_test((t, db) => {
    var store = db.createObjectStore("store");
    store.put("a", 1).onerror = t.unreached_func("put should succeed");

    var request = store.openCursor();
    request.onerror = t.unreached_func("openCursor should succeed");
    request.onsuccess = t.step_func(() => {
        var cursor = request.result;
        assert_not_equals(cursor, null, "cursor should find a value");
        check_method(cursor, "continue");
    });
}, "IDBCursor continue() method with throwing/invalid keys");

indexeddb_upgrade_only_test(
    (t, db) => {
        var store = db.createObjectStore("store");
        var index = store.createIndex("index", "prop");
        store.put({ prop: "a" }, 1).onerror =
            t.unreached_func("put should succeed");

        var request = index.openCursor();
        request.onerror = t.unreached_func("openCursor should succeed");
        request.onsuccess = t.step_func(() => {
            var cursor = request.result;
            assert_not_equals(cursor, null, "cursor should find a value");

            check_method(cursor, "continuePrimaryKey", 2);
        });
    },
    null,
    "IDBCursor continuePrimaryKey() method with throwing/invalid keys",
);

// Mutation methods on IDBCursor.
indexeddb_upgrade_only_test((t, db) => {
    var store = db.createObjectStore("store", { keyPath: "prop" });
    store.put({ prop: 1 }).onerror = t.unreached_func("put should succeed");

    var request = store.openCursor();
    request.onerror = t.unreached_func("openCursor should succeed");
    request.onsuccess = t.step_func(() => {
        var cursor = request.result;
        assert_not_equals(cursor, null, "cursor should find a value");

        var value = {};
        value.prop = throwing_key("getter");
        assert_throws(
            { name: "getter" },
            () => {
                cursor.update(value);
            },
            "throwing getter should rethrow during clone",
        );

        // Throwing from the getter during key conversion is
        // not possible since (1) a clone is used, (2) only own
        // properties are cloned, and (3) only own properties
        // are used for key path evaluation.

        value.prop = invalid_key;
        assert_throws(
            "DataError",
            () => {
                cursor.update(value);
            },
            "key conversion with invalid key should throw DataError",
        );
    });
}, "IDBCursor update() method with throwing/invalid keys");

// Static constructors on IDBKeyRange
["only", "lowerBound", "upperBound"].forEach((method) => {
    test((t) => {
        check_method(IDBKeyRange, method);
    }, "IDBKeyRange " + method + "() static with throwing/invalid keys");
});

test((t) => {
    check_method(IDBKeyRange, "bound", 2);
}, "IDBKeyRange bound() static with throwing/invalid keys");

// Insertion methods on IDBObjectStore.
["add", "put"].forEach((method) => {
    indexeddb_upgrade_only_test((t, db) => {
        var out_of_line = db.createObjectStore("out-of-line keys");
        var in_line = db.createObjectStore("in-line keys", { keyPath: "prop" });

        assert_throws(
            { name: "getter" },
            () => {
                out_of_line[method]("value", throwing_key("getter"));
            },
            "key conversion with throwing getter should rethrow",
        );

        assert_throws(
            "DataError",
            () => {
                out_of_line[method]("value", invalid_key);
            },
            "key conversion with invalid key should throw DataError",
        );

        var value = {};
        value.prop = throwing_key("getter");
        assert_throws(
            { name: "getter" },
            () => {
                in_line[method](value);
            },
            "throwing getter should rethrow during clone",
        );

        // Throwing from the getter during key conversion is
        // not possible since (1) a clone is used, (2) only own
        // properties are cloned, and (3) only own properties
        // are used for key path evaluation.

        value.prop = invalid_key;
        assert_throws(
            "DataError",
            () => {
                in_line[method](value);
            },
            "key conversion with invalid key should throw DataError",
        );
    }, `IDBObjectStore ${method}() method with throwing/invalid keys`);
});

// Generic (key-or-key-path) methods on IDBObjectStore.
[
    "delete",
    "get",
    "getKey",
    "getAll",
    "getAllKeys",
    "count",
    "openCursor",
    "openKeyCursor",
].forEach((method) => {
    indexeddb_upgrade_only_test((t, db) => {
        var store = db.createObjectStore("store");

        check_method(store, method);
    }, `IDBObjectStore ${method}() method with throwing/invalid keys`);
});

// Generic (key-or-key-path) methods on IDBIndex.
[
    "get",
    "getKey",
    "getAll",
    "getAllKeys",
    "count",
    "openCursor",
    "openKeyCursor",
].forEach((method) => {
    indexeddb_upgrade_only_test((t, db) => {
        var store = db.createObjectStore("store");
        var index = store.createIndex("index", "keyPath");

        check_method(index, method);
    }, `IDBIndex ${method}() method with throwing/invalid keys`);
});
