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

const sample = [0x44, 0x33, 0x22, 0x11, 0xff, 0xee, 0xdd, 0xcc];
const buffer = new Uint8Array(sample).buffer;

function assert_key_valid(a, message) {
    assert_equals(indexedDB.cmp(a, a), 0, message);
}

function assert_buffer_equals(a, b, message) {
    assert_array_equals(
        Array.from(new Uint8Array(a)),
        Array.from(new Uint8Array(b)),
        message,
    );
}

// Verifies that a JavaScript value round-trips through IndexedDB as a key.
function check_key_roundtrip_and_done(t, db, key, key_buffer) {
    const tx = db.transaction("store", "readwrite");
    const store = tx.objectStore("store");

    // Verify put with key
    const put_request = store.put("value", key);
    put_request.onerror = t.unreached_func("put should succeed");

    // Verify get with key
    const get_request = store.get(key);
    get_request.onerror = t.unreached_func("get should succeed");
    get_request.onsuccess = t.step_func(() => {
        assert_equals(
            get_request.result,
            "value",
            "get should retrieve the value given to put",
        );

        // Verify iteration returning key
        const cursor_request = store.openCursor();
        cursor_request.onerror = t.unreached_func("openCursor should succeed");
        cursor_request.onsuccess = t.step_func(() => {
            assert_not_equals(
                cursor_request.result,
                null,
                "cursor should be present",
            );
            const retrieved_key = cursor_request.result.key;
            assert_true(
                retrieved_key instanceof ArrayBuffer,
                "IndexedDB binary keys should be returned in ArrayBuffer instances",
            );
            assert_key_equals(
                retrieved_key,
                key,
                "The key returned by IndexedDB should equal the key given to put()",
            );
            assert_buffer_equals(
                retrieved_key,
                key_buffer,
                "The ArrayBuffer returned by IndexedDB should equal the buffer " +
                    "backing the key given to put()",
            );

            t.done();
        });
    });
}

// Checks that IndexedDB handles the given view type for binary keys correctly.
function view_type_test(type) {
    indexeddb_test(
        (t, db) => {
            db.createObjectStore("store");
        },
        (t, db) => {
            const key = new self[type](buffer);
            assert_key_valid(
                key,
                `${type} should be usable as an IndexedDB key`,
            );
            assert_key_equals(
                key,
                buffer,
                "Binary keys with the same data but different view types should be " +
                    " equal",
            );
            check_key_roundtrip_and_done(t, db, key, buffer);
        },
        `Binary keys can be supplied using the view type ${type}`,
    );
}

[
    "Uint8Array",
    "Uint8ClampedArray",
    "Int8Array",
    "Uint16Array",
    "Int16Array",
    "Uint32Array",
    "Int32Array",
    "Float32Array",
    "Float64Array",
].forEach((type) => {
    view_type_test(type);
});

// Checks that IndexedDB
function value_test(value_description, value, value_buffer) {
    indexeddb_test(
        (t, db) => {
            db.createObjectStore("store");
        },
        (t, db) => {
            assert_key_valid(
                value,
                value_description + " should be usable as an valid key",
            );
            check_key_roundtrip_and_done(t, db, value, value_buffer);
        },
        `${value_description} can be used to supply a binary key`,
    );
}

value_test("ArrayBuffer", buffer, buffer);
value_test("DataView", new DataView(buffer), buffer);
value_test(
    "DataView with explicit offset",
    new DataView(buffer, 3),
    new Uint8Array([0x11, 0xff, 0xee, 0xdd, 0xcc]).buffer,
);
value_test(
    "DataView with explicit offset and length",
    new DataView(buffer, 3, 4),
    new Uint8Array([0x11, 0xff, 0xee, 0xdd]).buffer,
);
value_test(
    "Uint8Array with explicit offset",
    new Uint8Array(buffer, 3),
    new Uint8Array([0x11, 0xff, 0xee, 0xdd, 0xcc]).buffer,
);
value_test(
    "Uint8Array with explicit offset and length",
    new Uint8Array(buffer, 3, 4),
    new Uint8Array([0x11, 0xff, 0xee, 0xdd]).buffer,
);
