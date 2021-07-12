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

var global_db = createdb_for_multiple_tests();

function keysort(desc, unsorted, expected) {
    var db,
        t = async_test("Database readback sort - " + desc),
        store_name = "store-" + Date.now() + Math.random();

    // The database test
    var open_rq = global_db.setTest(t);
    open_rq.onupgradeneeded = function (e) {
        db = e.target.result;
        var objStore = db.createObjectStore(store_name);

        for (var i = 0; i < unsorted.length; i++)
            objStore.add("value", unsorted[i]);
    };

    open_rq.onsuccess = function (e) {
        var actual_keys = [],
            rq = db
                .transaction(store_name)
                .objectStore(store_name)
                .openCursor();

        rq.onsuccess = t.step_func(function (e) {
            var cursor = e.target.result;

            if (cursor) {
                actual_keys.push(cursor.key);
                cursor.continue();
            } else {
                assert_key_equals(actual_keys, expected, "keyorder array");
                assert_equals(
                    actual_keys.length,
                    expected.length,
                    "array length",
                );

                t.done();
            }
        });
    };

    // The IDBKey.cmp test
    test(function () {
        var sorted = unsorted.slice(0).sort(function (a, b) {
            return indexedDB.cmp(a, b);
        });
        assert_key_equals(sorted, expected, "sorted array");
    }, "IDBKey.cmp sorted - " + desc);
}

var now = new Date(),
    one_sec_ago = new Date(now - 1000),
    one_min_future = new Date(now.getTime() + 1000 * 60);

keysort("String < Array", [[0], "yo", "", []], ["", "yo", [], [0]]);

keysort(
    "float < String",
    [Infinity, "yo", 0, "", 100],
    [0, 100, Infinity, "", "yo"],
);

keysort(
    "float < Date",
    [now, 0, 9999999999999, -0.22],
    [-0.22, 0, 9999999999999, now],
);

keysort(
    "float < Date < String < Array",
    [[], "", now, [0], "-1", 0, 9999999999999],
    [0, 9999999999999, now, "", "-1", [], [0]],
);

keysort(
    "Date(1 sec ago) < Date(now) < Date(1 minute in future)",
    [now, one_sec_ago, one_min_future],
    [one_sec_ago, now, one_min_future],
);

keysort(
    "-1.1 < 1 < 1.01337 < 1.013373 < 2",
    [1.013373, 2, 1.01337, -1.1, 1],
    [-1.1, 1, 1.01337, 1.013373, 2],
);

keysort(
    "-Infinity < -0.01 < 0 < Infinity",
    [0, -0.01, -Infinity, Infinity],
    [-Infinity, -0.01, 0, Infinity],
);

keysort(
    '"" < "a" < "ab" < "b" < "ba"',
    ["a", "ba", "", "b", "ab"],
    ["", "a", "ab", "b", "ba"],
);

keysort(
    "Arrays",
    [[[0]], [0], [], [0, 0], [0, [0]]],
    [[], [0], [0, 0], [0, [0]], [[0]]],
);

var big_array = [],
    bigger_array = [];
for (var i = 0; i < 10000; i++) {
    big_array.push(i);
    bigger_array.push(i);
}
bigger_array.push(0);

keysort(
    "Array.length: 10,000 < Array.length: 10,001",
    [bigger_array, [0, 2, 3], [0], [9], big_array],
    [[0], big_array, bigger_array, [0, 2, 3], [9]],
);

keysort(
    "Infinity inside arrays",
    [
        [Infinity, 1],
        [Infinity, Infinity],
        [1, 1],
        [1, Infinity],
        [1, -Infinity],
        [-Infinity, Infinity],
    ],
    [
        [-Infinity, Infinity],
        [1, -Infinity],
        [1, 1],
        [1, Infinity],
        [Infinity, 1],
        [Infinity, Infinity],
    ],
);

keysort(
    "Test different stuff at once",
    [
        now,
        [0, []],
        "test",
        1,
        ["a", [1, [-1]]],
        ["b", "a"],
        [0, 2, "c"],
        ["a", [1, 2]],
        [],
        [0, [], 3],
        ["a", "b"],
        [1, 2],
        ["a", "b", "c"],
        one_sec_ago,
        [0, "b", "c"],
        Infinity,
        -Infinity,
        2.55,
        [0, now],
        [1],
    ],
    [
        -Infinity,
        1,
        2.55,
        Infinity,
        one_sec_ago,
        now,
        "test",
        [],
        [0, 2, "c"],
        [0, now],
        [0, "b", "c"],
        [0, []],
        [0, [], 3],
        [1],
        [1, 2],
        ["a", "b"],
        ["a", "b", "c"],
        ["a", [1, 2]],
        ["a", [1, [-1]]],
        ["b", "a"],
    ],
);
