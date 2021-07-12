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

indexeddb_test(
    (t, db) => {
        db.createObjectStore("store", {
            autoIncrement: true,
            keyPath: "a.b.c",
        });
    },
    (t, db) => {
        const tx = db.transaction("store", "readwrite");
        assert_throws(
            { name: "DataError" },
            () => {
                tx.objectStore("store").put({ a: { b: "foo" } });
            },
            "Put should throw if key can not be inserted at key path location.",
        );
        t.done();
    },
    "The last element of keypath is validated",
);

function throws(name) {
    return () => {
        const err = Error();
        err.name = name;
        throw err;
    };
}

indexeddb_test(
    function (t, db) {
        const o = {};
        Object.defineProperty(o, "throws", {
            get: throws("getter"),
            enumerable: false,
            configurable: true,
        });

        // Value should be cloned before key path is evaluated,
        // and non-enumerable getter will be ignored. The clone
        // will have no such property, so key path evaluation
        // will fail.
        const s1 = db.createObjectStore("s1", { keyPath: "throws" });
        assert_throws(
            "DataError",
            () => {
                s1.put(o);
            },
            "Key path failing to resolve should throw",
        );

        // Value should be cloned before key path is evaluated,
        // and non-enumerable getter will be ignored. The clone
        // will have no such property, so key path evaluation
        // will fail.
        const s2 = db.createObjectStore("s2", { keyPath: "throws.x" });
        assert_throws(
            "DataError",
            () => {
                s2.put(o);
            },
            "Key path failing to resolve should throw",
        );

        // Value should be cloned before key path is evaluated,
        // and non-enumerable getter will be ignored. The clone
        // will have no such property, so generated key can be
        // inserted.
        const s3 = db.createObjectStore("s3", {
            keyPath: "throws",
            autoIncrement: true,
        });
        assert_class_string(
            s3.put(o),
            "IDBRequest",
            "Key injectability test at throwing getter should succeed",
        );

        // Value should be cloned before key path is evaluated,
        // and non-enumerable getter will be ignored. The clone
        // will have no such property, so intermediate object
        // and generated key can be inserted.
        const s4 = db.createObjectStore("s4", {
            keyPath: "throws.x",
            autoIncrement: true,
        });
        assert_class_string(
            s4.put(o),
            "IDBRequest",
            "Key injectability test past throwing getter should succeed",
        );
    },
    (t, db) => {
        t.done();
    },
    "Key path evaluation: Exceptions from non-enumerable getters",
);

indexeddb_test(
    function (t, db) {
        const o = {};
        Object.defineProperty(o, "throws", {
            get: throws("getter"),
            enumerable: true,
            configurable: true,
        });

        // Value should be cloned before key path is evaluated,
        // and enumerable getter will rethrow.
        const s1 = db.createObjectStore("s1", { keyPath: "throws" });
        assert_throws(
            { name: "getter" },
            () => {
                s1.put(o);
            },
            "Key path resolving to throwing getter rethrows",
        );

        // Value should be cloned before key path is evaluated,
        // and enumerable getter will rethrow.
        const s2 = db.createObjectStore("s2", { keyPath: "throws.x" });
        assert_throws(
            { name: "getter" },
            () => {
                s2.put(o);
            },
            "Key path resolving past throwing getter rethrows",
        );

        // Value should be cloned before key path is evaluated,
        // and enumerable getter will rethrow.
        const s3 = db.createObjectStore("s3", {
            keyPath: "throws",
            autoIncrement: true,
        });
        assert_throws(
            { name: "getter" },
            () => {
                s3.put(o);
            },
            "Key injectability test at throwing getter should rethrow",
        );

        // Value should be cloned before key path is evaluated,
        // and enumerable getter will rethrow.
        const s4 = db.createObjectStore("s4", {
            keyPath: "throws.x",
            autoIncrement: true,
        });
        assert_throws(
            { name: "getter" },
            () => {
                s4.put(o);
            },
            "Key injectability test past throwing getter should rethrow",
        );
    },
    (t, db) => {
        t.done();
    },
    "Key path evaluation: Exceptions from enumerable getters",
);

indexeddb_test(
    (t, db) => {
        // Implemented as function wrapper to clean up
        // immediately after use, otherwise it may
        // interfere with the test harness.
        function with_proto_getter(f) {
            return function () {
                Object.defineProperty(Object.prototype, "throws", {
                    get: throws("getter"),
                    enumerable: false,
                    configurable: true,
                });
                try {
                    f();
                } finally {
                    delete Object.prototype["throws"];
                }
            };
        }

        // Value should be cloned before key path is evaluated,
        // and non-enumerable getter will be ignored. The clone
        // will have no own property, so key path evaluation will
        // fail and DataError should be thrown.
        const s1 = db.createObjectStore("s1", { keyPath: "throws" });
        assert_throws(
            "DataError",
            with_proto_getter(function () {
                s1.put({});
            }),
            "Key path resolving to no own property throws DataError",
        );

        // Value should be cloned before key path is evaluated,
        // and non-enumerable getter will be ignored. The clone
        // will have no own property, so key path evaluation will
        // fail and DataError should be thrown.
        const s2 = db.createObjectStore("s2", { keyPath: "throws.x" });
        assert_throws(
            "DataError",
            with_proto_getter(function () {
                s2.put({});
            }),
            "Key path resolving past no own property throws DataError",
        );

        // Value should be cloned before key path is evaluated,
        // and non-enumerable getter will be ignored. The clone
        // will have no own property, so key path evaluation will
        // fail and injection can succeed.
        const s3 = db.createObjectStore("s3", {
            keyPath: "throws",
            autoIncrement: true,
        });
        assert_equals(
            s3.put({}).readyState,
            "pending",
            "put should not throw due to inherited property",
        );

        // Value should be cloned before key path is evaluated,
        // and non-enumerable getter will be ignored. The clone
        // will have no own property, so key path evaluation will
        // fail and injection can succeed.
        const s4 = db.createObjectStore("s4", {
            keyPath: "throws.x",
            autoIncrement: true,
        });
        assert_equals(
            s4.put({}).readyState,
            "pending",
            "put should not throw due to inherited property",
        );
    },
    (t, db) => {
        t.done();
    },
    "Key path evaluation: Exceptions from non-enumerable getters on prototype",
);

indexeddb_test(
    (t, db) => {
        // Implemented as function wrapper to clean up
        // immediately after use, otherwise it may
        // interfere with the test harness.
        function with_proto_getter(f) {
            return () => {
                Object.defineProperty(Object.prototype, "throws", {
                    get: throws("getter"),
                    enumerable: true,
                    configurable: true,
                });
                try {
                    f();
                } finally {
                    delete Object.prototype["throws"];
                }
            };
        }

        // Value should be cloned before key path is evaluated.
        // The clone will have no own property, so key path
        // evaluation will fail and DataError should be thrown.
        const s1 = db.createObjectStore("s1", { keyPath: "throws" });
        assert_throws(
            "DataError",
            with_proto_getter(function () {
                s1.put({});
            }),
            "Key path resolving to no own property throws DataError",
        );

        // Value should be cloned before key path is evaluated.
        // The clone will have no own property, so key path
        // evaluation will fail and DataError should be thrown.
        const s2 = db.createObjectStore("s2", { keyPath: "throws.x" });
        assert_throws(
            "DataError",
            with_proto_getter(function () {
                s2.put({});
            }),
            "Key path resolving past throwing getter rethrows",
        );

        // Value should be cloned before key path is evaluated.
        // The clone will have no own property, so key path
        // evaluation will fail and injection can succeed.
        var s3 = db.createObjectStore("s3", {
            keyPath: "throws",
            autoIncrement: true,
        });
        assert_equals(
            s3.put({}).readyState,
            "pending",
            "put should not throw due to inherited property",
        );

        // Value should be cloned before key path is evaluated.
        // The clone will have no own property, so key path
        // evaluation will fail and injection can succeed.
        var s4 = db.createObjectStore("s4", {
            keyPath: "throws.x",
            autoIncrement: true,
        });
        assert_equals(
            s4.put({}).readyState,
            "pending",
            "put should not throw due to inherited property",
        );
    },
    (t, db) => {
        t.done();
    },
    "Key path evaluation: Exceptions from enumerable getters on prototype",
);

indexeddb_test(
    (t, db) => {
        const store = db.createObjectStore("store");
        store.createIndex("index", "index0");
    },
    (t, db) => {
        const tx = db.transaction("store", "readwrite");

        const array = [];
        array[99] = 1;

        let getter_called = 0;
        const prop = "50";
        Object.defineProperty(Object.prototype, prop, {
            enumerable: true,
            configurable: true,
            get: () => {
                ++getter_called;
                return "foo";
            },
        });

        const request = tx.objectStore("store").put({ index0: array }, "key");
        request.onerror = t.unreached_func("put should not fail");
        request.onsuccess = t.step_func(function () {
            assert_equals(
                getter_called,
                0,
                "Prototype getter should not be called",
            );
            delete Object.prototype[prop];
            t.done();
        });
    },
    "Array key conversion should not invoke prototype getters",
);
