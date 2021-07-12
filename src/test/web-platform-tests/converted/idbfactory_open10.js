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

var db, db2;
var open_rq = createdb(async_test(), undefined, 9);

open_rq.onupgradeneeded = function (e) {
    db = e.target.result;

    var st = db.createObjectStore("store");
    st.createIndex("index", "i");

    assert_equals(db.version, 9, "first db.version");
    assert_true(
        db.objectStoreNames.contains("store"),
        "objectStoreNames contains store",
    );
    assert_true(st.indexNames.contains("index"), "indexNames contains index");

    st.add({ i: "Joshua" }, 1);
    st.add({ i: "Jonas" }, 2);
};
open_rq.onsuccess = function (e) {
    db.close();
    var open_rq2 = window.indexedDB.open(db.name, 10);
    open_rq2.onupgradeneeded = this.step_func(function (e) {
        db2 = e.target.result;

        db2.createObjectStore("store2");

        var store = open_rq2.transaction.objectStore("store");
        store.createIndex("index2", "i");

        assert_equals(db2.version, 10, "db2.version");

        assert_true(
            db2.objectStoreNames.contains("store"),
            "second objectStoreNames contains store",
        );
        assert_true(
            db2.objectStoreNames.contains("store2"),
            "second objectStoreNames contains store2",
        );
        assert_true(
            store.indexNames.contains("index"),
            "second indexNames contains index",
        );
        assert_true(
            store.indexNames.contains("index2"),
            "second indexNames contains index2",
        );

        store.add({ i: "Odin" }, 3);
        store.put({ i: "Sicking" }, 2);

        open_rq2.transaction.abort();
    });
    open_rq2.onerror = this.step_func(function (e) {
        assert_equals(db2.version, 9, "db2.version after error");
        assert_true(
            db2.objectStoreNames.contains("store"),
            "objectStoreNames contains store after error",
        );
        assert_false(
            db2.objectStoreNames.contains("store2"),
            "objectStoreNames not contains store2 after error",
        );

        var open_rq3 = window.indexedDB.open(db.name);
        open_rq3.onsuccess = this.step_func(function (e) {
            var db3 = e.target.result;

            assert_true(
                db3.objectStoreNames.contains("store"),
                "third objectStoreNames contains store",
            );
            assert_false(
                db3.objectStoreNames.contains("store2"),
                "third objectStoreNames contains store2",
            );

            var st = db3.transaction("store").objectStore("store");

            assert_equals(db3.version, 9, "db3.version");

            assert_true(
                st.indexNames.contains("index"),
                "third indexNames contains index",
            );
            assert_false(
                st.indexNames.contains("index2"),
                "third indexNames contains index2",
            );

            st.openCursor(null, "prev").onsuccess = this.step_func(function (
                e,
            ) {
                assert_equals(e.target.result.key, 2, "opencursor(prev) key");
                assert_equals(
                    e.target.result.value.i,
                    "Jonas",
                    "opencursor(prev) value",
                );
            });
            st.get(3).onsuccess = this.step_func(function (e) {
                assert_equals(e.target.result, undefined, "get(3)");
            });

            var idx = st.index("index");
            idx.getKey("Jonas").onsuccess = this.step_func(function (e) {
                assert_equals(e.target.result, 2, "getKey(Jonas)");
            });
            idx.getKey("Odin").onsuccess = this.step_func(function (e) {
                assert_equals(e.target.result, undefined, "getKey(Odin)");
            });
            idx.getKey("Sicking").onsuccess = this.step_func(function (e) {
                assert_equals(e.target.result, undefined, "getKey(Sicking)");

                db3.close();
                this.done();
            });
        });
    });
};
