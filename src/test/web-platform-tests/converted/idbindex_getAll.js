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

var alphabet = "abcdefghijklmnopqrstuvwxyz".split("");
var ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

function getall_test(func, name) {
    indexeddb_test(
        function (t, connection, tx) {
            var store = connection.createObjectStore("generated", {
                autoIncrement: true,
                keyPath: "id",
            });
            var index = store.createIndex("test_idx", "upper");
            alphabet.forEach(function (letter) {
                store.put({ ch: letter, upper: letter.toUpperCase() });
            });

            store = connection.createObjectStore("out-of-line", null);
            index = store.createIndex("test_idx", "upper");
            alphabet.forEach(function (letter) {
                store.put({ ch: letter, upper: letter.toUpperCase() }, letter);
            });

            store = connection.createObjectStore(
                "out-of-line-not-unique",
                null,
            );
            index = store.createIndex("test_idx", "half");
            alphabet.forEach(function (letter) {
                if (letter <= "m")
                    store.put({ ch: letter, half: "first" }, letter);
                else store.put({ ch: letter, half: "second" }, letter);
            });

            store = connection.createObjectStore("out-of-line-multi", null);
            index = store.createIndex("test_idx", "attribs", {
                multiEntry: true,
            });
            alphabet.forEach(function (letter) {
                var attrs = [];
                if (["a", "e", "i", "o", "u"].indexOf(letter) != -1)
                    attrs.push("vowel");
                else attrs.push("consonant");
                if (letter == "a") attrs.push("first");
                if (letter == "z") attrs.push("last");
                store.put({ ch: letter, attribs: attrs }, letter);
            });

            store = connection.createObjectStore("empty", null);
            index = store.createIndex("test_idx", "upper");
        },
        func,
        name,
    );
}

function createGetAllRequest(t, storeName, connection, range, maxCount) {
    var transaction = connection.transaction(storeName, "readonly");
    var store = transaction.objectStore(storeName);
    var index = store.index("test_idx");
    var req = index.getAll(range, maxCount);
    req.onerror = t.unreached_func("getAll request should succeed");
    return req;
}

getall_test(function (t, connection) {
    var req = createGetAllRequest(t, "out-of-line", connection, "C");
    req.onsuccess = t.step_func(function (evt) {
        var data = evt.target.result;
        assert_class_string(data, "Array", "result should be an array");
        assert_array_equals(
            data.map(function (e) {
                return e.ch;
            }),
            ["c"],
        );
        assert_array_equals(
            data.map(function (e) {
                return e.upper;
            }),
            ["C"],
        );
        t.done();
    });
}, "Single item get");

getall_test(function (t, connection) {
    var req = createGetAllRequest(t, "empty", connection);
    req.onsuccess = t.step_func(function (evt) {
        assert_array_equals(
            evt.target.result,
            [],
            "getAll() on empty object store should return an empty array",
        );
        t.done();
    });
}, "Empty object store");

getall_test(function (t, connection) {
    var req = createGetAllRequest(t, "out-of-line", connection);
    req.onsuccess = t.step_func(function (evt) {
        var data = evt.target.result;
        assert_class_string(data, "Array", "result should be an array");
        assert_array_equals(
            data.map(function (e) {
                return e.ch;
            }),
            alphabet,
        );
        assert_array_equals(
            data.map(function (e) {
                return e.upper;
            }),
            ALPHABET,
        );
        t.done();
    });
}, "Get all keys");

getall_test(function (t, connection) {
    var req = createGetAllRequest(t, "out-of-line", connection, undefined, 10);
    req.onsuccess = t.step_func(function (evt) {
        var data = evt.target.result;
        assert_class_string(data, "Array", "result should be an array");
        assert_array_equals(
            data.map(function (e) {
                return e.ch;
            }),
            "abcdefghij".split(""),
        );
        assert_array_equals(
            data.map(function (e) {
                return e.upper;
            }),
            "ABCDEFGHIJ".split(""),
        );
        t.done();
    });
}, "maxCount=10");

getall_test(function (t, connection) {
    var req = createGetAllRequest(
        t,
        "out-of-line",
        connection,
        IDBKeyRange.bound("G", "M"),
    );
    req.onsuccess = t.step_func(function (evt) {
        var data = evt.target.result;
        assert_array_equals(
            data.map(function (e) {
                return e.ch;
            }),
            "ghijklm".split(""),
        );
        assert_array_equals(
            data.map(function (e) {
                return e.upper;
            }),
            "GHIJKLM".split(""),
        );
        t.done();
    });
}, "Get bound range");

getall_test(function (t, connection) {
    var req = createGetAllRequest(
        t,
        "out-of-line",
        connection,
        IDBKeyRange.bound("G", "M"),
        3,
    );
    req.onsuccess = t.step_func(function (evt) {
        var data = evt.target.result;
        assert_class_string(data, "Array", "result should be an array");
        assert_array_equals(
            data.map(function (e) {
                return e.ch;
            }),
            "ghi".split(""),
        );
        assert_array_equals(
            data.map(function (e) {
                return e.upper;
            }),
            "GHI".split(""),
        );
        t.done();
    });
}, "Get bound range with maxCount");

getall_test(function (t, connection) {
    var req = createGetAllRequest(
        t,
        "out-of-line",
        connection,
        IDBKeyRange.bound("G", "K", false, true),
    );
    req.onsuccess = t.step_func(function (evt) {
        var data = evt.target.result;
        assert_class_string(data, "Array", "result should be an array");
        assert_array_equals(
            data.map(function (e) {
                return e.ch;
            }),
            "ghij".split(""),
        );
        assert_array_equals(
            data.map(function (e) {
                return e.upper;
            }),
            "GHIJ".split(""),
        );
        t.done();
    });
}, "Get upper excluded");

getall_test(function (t, connection) {
    var req = createGetAllRequest(
        t,
        "out-of-line",
        connection,
        IDBKeyRange.bound("G", "K", true, false),
    );
    req.onsuccess = t.step_func(function (evt) {
        var data = evt.target.result;
        assert_class_string(data, "Array", "result should be an array");
        assert_array_equals(
            data.map(function (e) {
                return e.ch;
            }),
            "hijk".split(""),
        );
        assert_array_equals(
            data.map(function (e) {
                return e.upper;
            }),
            "HIJK".split(""),
        );
        t.done();
    });
}, "Get lower excluded");

getall_test(function (t, connection) {
    var req = createGetAllRequest(
        t,
        "generated",
        connection,
        IDBKeyRange.bound(4, 15),
        3,
    );
    req.onsuccess = t.step_func(function (evt) {
        var data = evt.target.result;
        assert_true(Array.isArray(data));
        assert_equals(data.length, 0);
        t.done();
    });
}, "Get bound range (generated) with maxCount");

getall_test(function (t, connection) {
    var req = createGetAllRequest(
        t,
        "out-of-line",
        connection,
        "Doesn't exist",
    );
    req.onsuccess = t.step_func(function (evt) {
        assert_array_equals(
            evt.target.result,
            [],
            "getAll() using a nonexistent key should return an empty array",
        );
        t.done();
        req.onerror = t.unreached_func("getAll request should succeed");
    });
}, "Non existent key");

getall_test(function (t, connection) {
    var req = createGetAllRequest(t, "out-of-line", connection, undefined, 0);
    req.onsuccess = t.step_func(function (evt) {
        var data = evt.target.result;
        assert_class_string(data, "Array", "result should be an array");
        assert_array_equals(
            data.map(function (e) {
                return e.ch;
            }),
            alphabet,
        );
        assert_array_equals(
            data.map(function (e) {
                return e.upper;
            }),
            ALPHABET,
        );
        t.done();
    });
}, "maxCount=0");

getall_test(function (t, connection) {
    var req = createGetAllRequest(
        t,
        "out-of-line-not-unique",
        connection,
        "first",
    );
    req.onsuccess = t.step_func(function (evt) {
        var data = evt.target.result;
        assert_class_string(data, "Array", "result should be an array");
        assert_array_equals(
            data.map(function (e) {
                return e.ch;
            }),
            "abcdefghijklm".split(""),
        );
        assert_true(
            data.every(function (e) {
                return e.half === "first";
            }),
        );
        t.done();
    });
}, "Retrieve multiEntry key");

getall_test(function (t, connection) {
    var req = createGetAllRequest(t, "out-of-line-multi", connection, "vowel");
    req.onsuccess = t.step_func(function (evt) {
        var data = evt.target.result;
        assert_class_string(data, "Array", "result should be an array");
        assert_array_equals(
            data.map(function (e) {
                return e.ch;
            }),
            ["a", "e", "i", "o", "u"],
        );
        assert_array_equals(data[0].attribs, ["vowel", "first"]);
        assert_true(
            data.every(function (e) {
                return e.attribs[0] === "vowel";
            }),
        );
        t.done();
    });
}, "Retrieve one key multiple values");
