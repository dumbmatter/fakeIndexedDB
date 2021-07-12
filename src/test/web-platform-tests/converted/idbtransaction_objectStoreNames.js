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

function with_stores_test(store_names, open_func, description) {
    indexeddb_test(
        function (t, db, tx) {
            store_names.forEach(function (name) {
                db.createObjectStore(name);
            });
        },
        open_func,
        description,
    );
}

indexeddb_test(
    function (t, db, tx) {
        assert_array_equals(
            tx.objectStoreNames,
            [],
            "transaction objectStoreNames should be empty",
        );
        assert_array_equals(
            db.objectStoreNames,
            tx.objectStoreNames,
            "connection and transacton objectStoreNames should match",
        );

        db.createObjectStore("s1");
        assert_array_equals(
            tx.objectStoreNames,
            ["s1"],
            "transaction objectStoreNames should have new store",
        );
        assert_array_equals(
            db.objectStoreNames,
            tx.objectStoreNames,
            "connection and transacton objectStoreNames should match",
        );

        db.createObjectStore("s3");
        assert_array_equals(
            tx.objectStoreNames,
            ["s1", "s3"],
            "transaction objectStoreNames should have new store",
        );
        assert_array_equals(
            db.objectStoreNames,
            tx.objectStoreNames,
            "connection and transacton objectStoreNames should match",
        );

        db.createObjectStore("s2");
        assert_array_equals(
            tx.objectStoreNames,
            ["s1", "s2", "s3"],
            "transaction objectStoreNames should be sorted",
        );
        assert_array_equals(
            db.objectStoreNames,
            tx.objectStoreNames,
            "connection and transacton objectStoreNames should match",
        );

        db.deleteObjectStore("s1");
        assert_array_equals(
            tx.objectStoreNames,
            ["s2", "s3"],
            "transaction objectStoreNames should be updated after delete",
        );
        assert_array_equals(
            db.objectStoreNames,
            tx.objectStoreNames,
            "connection and transacton objectStoreNames should match",
        );
    },
    function (t, db) {
        t.done();
    },
    "IDBTransaction.objectStoreNames - during upgrade transaction",
);

(function () {
    var saved_tx;
    indexeddb_test(
        function (t, db, tx) {
            saved_tx = tx;
            db.createObjectStore("s2");
            db.createObjectStore("s3");
        },
        function (t, db) {
            db.close();
            var open2 = indexedDB.open(db.name, db.version + 1);
            open2.onerror = t.unreached_func("open should succeed");
            open2.onupgradeneeded = t.step_func(function () {
                var db2 = open2.result;
                var tx2 = open2.transaction;
                assert_array_equals(
                    tx2.objectStoreNames,
                    ["s2", "s3"],
                    "transaction should have previous stores in scope",
                );
                assert_array_equals(
                    db2.objectStoreNames,
                    tx2.objectStoreNames,
                    "connection and transacton objectStoreNames should match",
                );

                db2.createObjectStore("s4");
                assert_array_equals(
                    tx2.objectStoreNames,
                    ["s2", "s3", "s4"],
                    "transaction should have new store in scope",
                );
                assert_array_equals(
                    db2.objectStoreNames,
                    tx2.objectStoreNames,
                    "connection and transacton objectStoreNames should match",
                );

                assert_array_equals(
                    saved_tx.objectStoreNames,
                    ["s2", "s3"],
                    "previous transaction objectStoreNames should be unchanged",
                );
                assert_array_equals(
                    db.objectStoreNames,
                    saved_tx.objectStoreNames,
                    "connection and transaction objectStoreNames should match",
                );
                db2.close();
                t.done();
            });
        },
        "IDBTransaction.objectStoreNames - value after close",
    );
})();

with_stores_test(
    ["s1", "s2"],
    function (t, db) {
        assert_array_equals(
            db.transaction("s1").objectStoreNames,
            ["s1"],
            "transaction should have one store in scope",
        );
        assert_array_equals(
            db.transaction(["s1", "s2"]).objectStoreNames,
            ["s1", "s2"],
            "transaction should have two stores in scope",
        );
        t.done();
    },
    "IDBTransaction.objectStoreNames - transaction scope",
);

with_stores_test(
    ["s1", "s2"],
    function (t, db) {
        var tx = db.transaction(["s1", "s2"], "readwrite");
        tx.objectStore("s1").put(0, 0);
        tx.onabort = t.unreached_func("transaction should complete");
        tx.oncomplete = t.step_func(function () {
            assert_array_equals(
                tx.objectStoreNames,
                ["s1", "s2"],
                "objectStoreNames should return scope after transaction commits",
            );
            t.done();
        });
    },
    "IDBTransaction.objectStoreNames - value after commit",
);

with_stores_test(
    ["s1", "s2"],
    function (t, db) {
        var tx = db.transaction(["s1", "s2"], "readwrite");
        tx.objectStore("s1").put(0, 0);
        tx.objectStore("s1").add(0, 0);
        tx.oncomplete = t.unreached_func("transaction should abort");
        tx.onabort = t.step_func(function () {
            assert_array_equals(
                tx.objectStoreNames,
                ["s1", "s2"],
                "objectStoreNames should return scope after transaction aborts",
            );
            t.done();
        });
    },
    "IDBTransaction.objectStoreNames - value after abort",
);

with_stores_test(
    ["s1", "s2", "s3"],
    function (t, db) {
        assert_array_equals(
            db.transaction(["s3", "s2", "s1"]).objectStoreNames,
            ["s1", "s2", "s3"],
            "transaction objectStoreNames should be sorted",
        );
        t.done();
    },
    "IDBTransaction.objectStoreNames - sorting",
);

with_stores_test(
    ["s1", "s2"],
    function (t, db) {
        assert_array_equals(
            db.transaction(["s2", "s1", "s2"]).objectStoreNames,
            ["s1", "s2"],
            "transaction objectStoreNames should not have duplicates",
        );
        t.done();
    },
    "IDBTransaction.objectStoreNames - no duplicates",
);

var unusual_names = [
    "", // empty string

    "\x00", // U+0000 NULL
    "\xFF", // U+00FF LATIN SMALL LETTER Y WITH DIAERESIS

    "1", // basic ASCII
    "12", // basic ASCII
    "123", // basic ASCII
    "abc", // basic ASCII
    "ABC", // basic ASCII

    "\xA2", // U+00A2 CENT SIGN
    "\u6C34", // U+6C34 CJK UNIFIED IDEOGRAPH (water)
    "\uD834\uDD1E", // U+1D11E MUSICAL SYMBOL G-CLEF (UTF-16 surrogate pair)
    "\uFFFD", // U+FFFD REPLACEMENT CHARACTER

    "\uD800", // UTF-16 surrogate lead
    "\uDC00", // UTF-16 surrogate trail
];
unusual_names.sort();

indexeddb_test(
    function (t, db, tx) {
        unusual_names
            .slice()
            .reverse()
            .forEach(function (name) {
                db.createObjectStore(name);
            });
        assert_array_equals(
            tx.objectStoreNames,
            unusual_names,
            "transaction should have names sorted",
        );
    },
    function (t, db) {
        var tx = db.transaction(
            unusual_names.slice().reverse().concat(unusual_names),
        );
        assert_array_equals(
            tx.objectStoreNames,
            unusual_names,
            "transaction should have names sorted with no duplicates",
        );
        t.done();
    },
    "IDBTransaction.objectStoreNames - unusual names",
);
