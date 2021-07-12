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

function keypath(keypath, objects, expected_keys, desc) {
    var db,
        t = async_test(document.title + " - " + (desc ? desc : keypath)),
        store_name = "store-" + Date.now() + Math.random();

    var open_rq = global_db.setTest(t);
    open_rq.onupgradeneeded = function (e) {
        db = e.target.result;
        var objStore = db.createObjectStore(store_name, { keyPath: keypath });

        for (var i = 0; i < objects.length; i++) objStore.add(objects[i]);
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
                actual_keys.push(cursor.key.valueOf());
                cursor.continue();
            } else {
                assert_key_equals(actual_keys, expected_keys, "keyorder array");
                t.done();
            }
        });
    };
}

keypath("my.key", [{ my: { key: 10 } }], [10]);

keypath("my.køi", [{ my: { køi: 5 } }], [5]);

keypath("my.key_ya", [{ my: { key_ya: 10 } }], [10]);

keypath("public.key$ya", [{ public: { key$ya: 10 } }], [10]);

keypath("true.$", [{ true: { $: 10 } }], [10]);

keypath("my._", [{ my: { _: 10 } }], [10]);

keypath("delete.a7", [{ delete: { a7: 10 } }], [10]);

keypath(
    "p.p.p.p.p.p.p.p.p.p.p.p.p.p",
    [
        {
            p: {
                p: {
                    p: {
                        p: {
                            p: {
                                p: {
                                    p: {
                                        p: {
                                            p: {
                                                p: {
                                                    p: { p: { p: { p: 10 } } },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
    ],
    [10],
);

keypath(
    "str.length",
    [{ str: "pony" }, { str: "my" }, { str: "little" }, { str: "" }],
    [0, 2, 4, 6],
);

keypath(
    "arr.length",
    [
        { arr: [0, 0, 0, 0] },
        { arr: [{}, 0, "hei", "length", Infinity, []] },
        { arr: [10, 10] },
        { arr: [] },
    ],
    [0, 2, 4, 6],
);

keypath("length", [[10, 10], "123", { length: 20 }], [2, 3, 20]);

keypath(
    "",
    [["bags"], "bean", 10],
    [10, "bean", ["bags"]],
    "'' uses value as key",
);

keypath(
    [""],
    [["bags"], "bean", 10],
    [[10], ["bean"], [["bags"]]],
    "[''] uses value as [key]",
);

keypath(
    ["x", "y"],
    [
        { x: 10, y: 20 },
        { y: 1.337, x: 100 },
    ],
    [
        [10, 20],
        [100, 1.337],
    ],
    "['x', 'y']",
);

keypath(
    [["x"], ["y"]],
    [
        { x: 10, y: 20 },
        { y: 1.337, x: 100 },
    ],
    [
        [10, 20],
        [100, 1.337],
    ],
    "[['x'], 'y'] (stringifies)",
);

keypath(
    [
        "x",
        {
            toString: function () {
                return "y";
            },
        },
    ],
    [
        { x: 10, y: 20 },
        { y: 1.337, x: 100 },
    ],
    [
        [10, 20],
        [100, 1.337],
    ],
    "['x', {toString->'y'}] (stringifies)",
);

if (false) {
    var myblob = Blob(["Yoda"], { type: "suprawsum" });
    keypath(
        ["length", "type"],
        [myblob],
        [4, "suprawsum"],
        "[Blob.length, Blob.type]",
    );
}

// File.name and File.lastModified is not testable automatically

keypath(
    ["name", "type"],
    [
        { name: "orange", type: "fruit" },
        { name: "orange", type: ["telecom", "french"] },
    ],
    [
        ["orange", "fruit"],
        ["orange", ["telecom", "french"]],
    ],
);

keypath(
    ["name", "type.name"],
    [
        { name: "orange", type: { name: "fruit" } },
        { name: "orange", type: { name: "telecom" } },
    ],
    [
        ["orange", "fruit"],
        ["orange", "telecom"],
    ],
);

var loop_array = [];
loop_array.push(loop_array);
keypath(
    loop_array,
    ["a", 1, ["k"]],
    [[1], ["a"], [["k"]]],
    "array loop -> stringify becomes ['']",
);
