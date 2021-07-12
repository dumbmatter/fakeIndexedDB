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

function big_key_test(key, description) {
    indexeddb_test(
        (t, db) => {
            assert_equals(indexedDB.cmp(key, key), 0, "Key is valid");

            db.createObjectStore("store", { autoIncrement: true });
        },
        (t, db) => {
            const tx = db.transaction("store", "readwrite");
            const store = tx.objectStore("store");
            const value = 0;
            let request;

            request = store.put(value);
            request.onerror = t.unreached_func("put should succeed");
            request.onsuccess = t.step_func((e) => {
                assert_equals(
                    e.target.result,
                    1,
                    "Key generator should initially be 1",
                );
            });

            request = store.put(value);
            request.onerror = t.unreached_func("put should succeed");
            request.onsuccess = t.step_func((e) => {
                assert_equals(
                    e.target.result,
                    2,
                    "Key generator should increment",
                );
            });

            request = store.put(value, 1000);
            request.onerror = t.unreached_func("put should succeed");
            request.onsuccess = t.step_func((e) => {
                assert_equals(
                    e.target.result,
                    1000,
                    "Explicit key should be used",
                );
            });

            request = store.put(value);
            request.onerror = t.unreached_func("put should succeed");
            request.onsuccess = t.step_func((e) => {
                assert_equals(
                    e.target.result,
                    1001,
                    "Key generator should have updated",
                );
            });

            request = store.put(value, key);
            request.onerror = t.unreached_func("put should succeed");
            request.onsuccess = t.step_func((e) => {
                assert_equals(
                    e.target.result,
                    key,
                    "Explicit key should be used",
                );
            });

            if (key >= 0) {
                // Large positive values will max out the key generator, so it
                // can no longer produce keys.
                request = store.put(value);
                request.onsuccess = t.unreached_func("put should fail");
                request.onerror = t.step_func((e) => {
                    e.preventDefault();
                    assert_equals(
                        e.target.error.name,
                        "ConstraintError",
                        "Key generator should have returned failure",
                    );
                });
            } else {
                // Large negative values are always lower than the key generator's
                // current number, so have no effect on the generator.
                request = store.put(value);
                request.onerror = t.unreached_func("put should succeed");
                request.onsuccess = t.step_func((e) => {
                    assert_equals(
                        e.target.result,
                        1002,
                        "Key generator should have updated",
                    );
                });
            }

            request = store.put(value, 2000);
            request.onerror = t.unreached_func("put should succeed");
            request.onsuccess = t.step_func((e) => {
                assert_equals(
                    e.target.result,
                    2000,
                    "Explicit key should be used",
                );
            });

            tx.onabort = t.step_func(() => {
                assert_unreached(`Transaction aborted: ${tx.error.message}`);
            });
            tx.oncomplete = t.step_func(() => {
                t.done();
            });
        },
        description,
    );
}

[
    {
        key: Number.MAX_SAFE_INTEGER + 1,
        description: "53 bits",
    },
    {
        key: Math.pow(2, 60),
        description: "greater than 53 bits, less than 64 bits",
    },
    {
        key: -Math.pow(2, 60),
        description: "greater than 53 bits, less than 64 bits (negative)",
    },
    {
        key: Math.pow(2, 63),
        description: "63 bits",
    },
    {
        key: -Math.pow(2, 63),
        description: "63 bits (negative)",
    },
    {
        key: Math.pow(2, 64),
        description: "64 bits",
    },
    {
        key: -Math.pow(2, 64),
        description: "64 bits (negative)",
    },
    {
        key: Math.pow(2, 70),
        description: "greater than 64 bits, but still finite",
    },
    {
        key: -Math.pow(2, 70),
        description: "greater than 64 bits, but still finite (negative)",
    },
    {
        key: Infinity,
        description: "equal to Infinity",
    },
    {
        key: -Infinity,
        description: "equal to -Infinity",
    },
].forEach(function (testCase) {
    big_key_test(
        testCase.key,
        `Key generator vs. explicit key ${testCase.description}`,
    );
});
