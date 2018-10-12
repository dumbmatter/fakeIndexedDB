const assert = require("assert");
require("../../../build/global");
global.Event = require("../../../build/lib/FakeEvent").default;

global.document = {
    // Kind of cheating for key_invalid.js: It wants to test using a DOM node as a key, but that can't work in Node, so
    // this will instead use another object that also can't be used as a key.
    getElementsByTagName: () => Math,
};
global.DOMException = Error; // Kind of cheating for error-attributes.js
global.location = {
    location: {},
};
global.self = global;
global.window = global;

const add_completion_callback = (...args) => {
    console.log("add_completion_callback", ...args);
};

const assert_array_equals = (...args) => assert.deepEqual(...args);

const assert_equals = (...args) => assert.equal(...args);

const assert_class_string = (object, class_string, description) => {
    // Would be better to to use `{}.toString.call(object)` instead of `object.toString()`, but I can't make that work
    // with my custom Objects except in some very modern environments http://stackoverflow.com/a/34098492/786644 so fuck
    // it, probably nobody will notice.
    if (class_string === "Array") {
        return Array.isArray(object);
    }
    assert_equals(
        object.toString(),
        "[object " + class_string + "]",
        description,
    );
};

const assert_false = (val, message) => assert.ok(!val, message);

const assert_key_equals = (actual, expected, description) => {
    assert_equals(indexedDB.cmp(actual, expected), 0, description);
};

const assert_not_equals = (...args) => assert.notEqual(...args);

const assert_readonly = (object, property_name, description) => {
    var initial_value = object[property_name];
    try {
        //Note that this can have side effects in the case where
        //the property has PutForwards
        object[property_name] = initial_value + "a"; //XXX use some other value here?
        assert.equal(object[property_name], initial_value, description);
    } finally {
        object[property_name] = initial_value;
    }
};

const assert_throws = (errName, block, message) =>
    assert.throws(block, new RegExp(errName), message);

const assert_true = (...args) => assert.ok(...args);

class AsyncTest {
    constructor(name) {
        this.completed = false;
        this.cleanupCallbacks = [];
        this.name = name;

        this.timeoutID = setTimeout(() => {
            if (!this.completed) {
                this.completed = true;
                throw new Error("Timed out!");
            }
        }, 60 * 1000);
    }

    complete() {
        for (const cb of this.cleanupCallbacks) {
            cb();
        }
        clearTimeout(this.timeoutID);
        this.completed = true;
    }

    done() {
        if (!this.completed) {
            this.complete();
        } else {
            throw new Error("AsyncTest.done() called multiple times");
        }
    }

    step(fn, this_obj, ...args) {
        try {
            return fn.apply(this, args);
        } catch (err) {
            if (!this.completed) {
                throw err;
            }
        }
    }

    step_func(fn) {
        return (...args) => {
            try {
                fn.apply(this, args);
            } catch (err) {
                if (!this.completed) {
                    throw err;
                }
            }
        };
    }

    step_func_done(fn) {
        return (...args) => {
            fn.apply(this, args);
            this.done();
        };
    }

    step_timeout(fn, timeout, ...args) {
        return setTimeout(
            this.step_func(() => {
                return fn.apply(this, args);
            }),
            timeout,
        );
    }

    unreached_func(message) {
        return () => this.fail(new Error(message));
    }

    fail(err) {
        console.log("Failed!");
        this.complete();

        // `throw err` was silent
        console.error(err);
        process.exit(1);
    }

    add_cleanup(cb) {
        this.cleanupCallbacks.push(cb);
    }
}

const async_test = (func, name, properties) => {
    if (typeof func !== "function") {
        properties = name;
        name = func;
        func = null;
    }
    var test_name = name ? name : Math.random().toString();
    properties = properties ? properties : {};
    var test_obj = new AsyncTest(test_name, properties);
    if (func) {
        test_obj.step(func, test_obj, test_obj);
    }
    return test_obj;
};

const test = cb => {
    cb();
};

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

    if (version) rq_open = indexedDB.open(dbname, version);
    else rq_open = indexedDB.open(dbname);

    /*function auto_fail(evt) {
        rq_open['on' + evt] = function () { test.fail(new Error('Unexpected ' + evt + ' event')) };
    }*/

    function auto_fail(evt, test) {
        /* Fail handlers, if we haven't set on/whatever/, don't
         * expect to get event whatever. */
        rq_open.manually_handled = {};

        rq_open.addEventListener(evt, function(e) {
            test.step(function() {
                if (!rq_open.manually_handled[evt]) {
                    assert_unreached("unexpected open." + evt + " event");
                }

                if (
                    e.target.result + "" == "[object IDBDatabase]" &&
                    !this.db
                ) {
                    this.db = e.target.result;

                    // In many tests, these will get triggered both here and in the browser, but the browser somehow
                    // ignores them and still passes the test
                    /*                  this.db.onerror = fail(test, 'unexpected db.error');
                  this.db.onabort = fail(test, 'unexpected db.abort');
                  this.db.onversionchange =
                      fail(test, 'unexpected db.versionchange');*/
                }
            });
        });
        rq_open.__defineSetter__("on" + evt, function(h) {
            rq_open.manually_handled[evt] = true;
            if (!h) rq_open.addEventListener(evt, function() {});
            else rq_open.addEventListener(evt, test.step_func(h.bind(test)));
        });
    }

    // add a .setTest method to the DB object
    Object.defineProperty(rq_open, "setTest", {
        enumerable: false,
        value: function(test) {
            auto_fail("upgradeneeded", test);
            auto_fail("success", test);
            auto_fail("blocked", test);
            auto_fail("error", test);

            return this;
        },
    });

    return rq_open;
}

/**
 * This constructor helper allows DOM events to be handled using Promises,
 * which can make it a lot easier to test a very specific series of events,
 * including ensuring that unexpected events are not fired at any point.
 */
function EventWatcher(test, watchedNode, eventTypes) {
    if (typeof eventTypes == "string") {
        eventTypes = [eventTypes];
    }

    var waitingFor = null;

    var eventHandler = test.step_func(function(evt) {
        assert_true(
            !!waitingFor,
            "Not expecting event, but got " + evt.type + " event",
        );
        assert_equals(
            evt.type,
            waitingFor.types[0],
            "Expected " +
                waitingFor.types[0] +
                " event, but got " +
                evt.type +
                " event instead",
        );
        if (waitingFor.types.length > 1) {
            // Pop first event from array
            waitingFor.types.shift();
            return;
        }
        // We need to null out waitingFor before calling the resolve function
        // since the Promise's resolve handlers may call wait_for() which will
        // need to set waitingFor.
        var resolveFunc = waitingFor.resolve;
        waitingFor = null;
        resolveFunc(evt);
    });

    for (var i = 0; i < eventTypes.length; i++) {
        watchedNode.addEventListener(eventTypes[i], eventHandler, false);
    }

    /**
     * Returns a Promise that will resolve after the specified event or
     * series of events has occured.
     */
    this.wait_for = function(types) {
        if (waitingFor) {
            return Promise.reject("Already waiting for an event or events");
        }
        if (typeof types == "string") {
            types = [types];
        }
        return new Promise(function(resolve, reject) {
            waitingFor = {
                types: types,
                resolve: resolve,
                reject: reject,
            };
        });
    };

    function stop_watching() {
        for (var i = 0; i < eventTypes.length; i++) {
            watchedNode.removeEventListener(eventTypes[i], eventHandler, false);
        }
    }

    test.add_cleanup(stop_watching);

    return this;
}

// Call with a Test and an array of expected results in order. Returns
// a function; call the function when a result arrives and when the
// expected number appear the order will be asserted and test
// completed.
const expect = (t, expected) => {
    var results = [];
    return result => {
        results.push(result);
        if (results.length === expected.length) {
            assert_array_equals(results, expected);
            t.done();
        }
    };
};

const fail = (test, message) => {
    return () => {
        test.fail(new Error(message));
    };
};

const replacements = {
    "0": "0",
    "1": "x01",
    "2": "x02",
    "3": "x03",
    "4": "x04",
    "5": "x05",
    "6": "x06",
    "7": "x07",
    "8": "b",
    "9": "t",
    "10": "n",
    "11": "v",
    "12": "f",
    "13": "r",
    "14": "x0e",
    "15": "x0f",
    "16": "x10",
    "17": "x11",
    "18": "x12",
    "19": "x13",
    "20": "x14",
    "21": "x15",
    "22": "x16",
    "23": "x17",
    "24": "x18",
    "25": "x19",
    "26": "x1a",
    "27": "x1b",
    "28": "x1c",
    "29": "x1d",
    "30": "x1e",
    "31": "x1f",
    "0xfffd": "ufffd",
    "0xfffe": "ufffe",
    "0xffff": "uffff",
};

function format_value(val, seen) {
    if (!seen) {
        seen = [];
    }
    if (typeof val === "object" && val !== null) {
        if (seen.indexOf(val) >= 0) {
            return "[...]";
        }
        seen.push(val);
    }
    if (Array.isArray(val)) {
        return (
            "[" +
            val
                .map(function(x) {
                    return format_value(x, seen);
                })
                .join(", ") +
            "]"
        );
    }

    switch (typeof val) {
        case "string":
            val = val.replace("\\", "\\\\");
            for (var p in replacements) {
                var replace = "\\" + replacements[p];
                val = val.replace(RegExp(String.fromCharCode(p), "g"), replace);
            }
            return '"' + val.replace(/"/g, '\\"') + '"';
        case "boolean":
        case "undefined":
            return String(val);
        case "number":
            // In JavaScript, -0 === 0 and String(-0) == "0", so we have to
            // special-case.
            if (val === -0 && 1 / val === -Infinity) {
                return "-0";
            }
            return String(val);
        case "object":
            if (val === null) {
                return "null";
            }

            // Special-case Node objects, since those come up a lot in my tests.  I
            // ignore namespaces.
            if (is_node(val)) {
                switch (val.nodeType) {
                    case Node.ELEMENT_NODE:
                        var ret = "<" + val.localName;
                        for (var i = 0; i < val.attributes.length; i++) {
                            ret +=
                                " " +
                                val.attributes[i].name +
                                '="' +
                                val.attributes[i].value +
                                '"';
                        }
                        ret += ">" + val.innerHTML + "</" + val.localName + ">";
                        return "Element node " + truncate(ret, 60);
                    case Node.TEXT_NODE:
                        return 'Text node "' + truncate(val.data, 60) + '"';
                    case Node.PROCESSING_INSTRUCTION_NODE:
                        return (
                            "ProcessingInstruction node with target " +
                            format_value(truncate(val.target, 60)) +
                            " and data " +
                            format_value(truncate(val.data, 60))
                        );
                    case Node.COMMENT_NODE:
                        return (
                            "Comment node <!--" + truncate(val.data, 60) + "-->"
                        );
                    case Node.DOCUMENT_NODE:
                        return (
                            "Document node with " +
                            val.childNodes.length +
                            (val.childNodes.length == 1
                                ? " child"
                                : " children")
                        );
                    case Node.DOCUMENT_TYPE_NODE:
                        return "DocumentType node";
                    case Node.DOCUMENT_FRAGMENT_NODE:
                        return (
                            "DocumentFragment node with " +
                            val.childNodes.length +
                            (val.childNodes.length == 1
                                ? " child"
                                : " children")
                        );
                    default:
                        return "Node object of unknown type";
                }
            }

        /* falls through */
        default:
            try {
                return typeof val + ' "' + truncate(String(val), 1000) + '"';
            } catch (e) {
                return (
                    "[stringifying object threw " +
                    String(e) +
                    " with type " +
                    String(typeof e) +
                    "]"
                );
            }
    }
}

const indexeddb_test = (upgrade_func, open_func, description, options) => {
    async_test(function(t) {
        options = Object.assign({ upgrade_will_abort: false }, options);
        var dbname = "testdb-" + new Date().getTime() + Math.random();
        var del = indexedDB.deleteDatabase(dbname);
        del.onerror = t.unreached_func("deleteDatabase should succeed");
        var open = indexedDB.open(dbname, 1);
        open.onupgradeneeded = t.step_func(function() {
            var db = open.result;
            t.add_cleanup(function() {
                // If open didn't succeed already, ignore the error.
                open.onerror = function(e) {
                    e.preventDefault();
                };
                db.close();
                indexedDB.deleteDatabase(db.name);
            });
            var tx = open.transaction;
            upgrade_func(t, db, tx);
        });
        if (options.upgrade_will_abort) {
            open.onsuccess = t.unreached_func("open should not succeed");
        } else {
            open.onerror = t.unreached_func("open should succeed");
            open.onsuccess = t.step_func(function() {
                var db = open.result;
                if (open_func) open_func(t, db);
            });
        }
    }, description);
};

// Checks to see if the passed transaction is active (by making
// requests against the named store).
const is_transaction_active = (tx, store_name) => {
    try {
        const request = tx.objectStore(store_name).get(0);
        request.onerror = e => {
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
};

// Keep the passed transaction alive indefinitely (by making requests
// against the named store). Returns a function to to let the
// transaction finish, and asserts that the transaction is not yet
// finished.
const keep_alive = (tx, store_name) => {
    let completed = false;
    tx.addEventListener("complete", () => {
        completed = true;
    });

    let pin = true;

    const spin = () => {
        if (!pin) return;
        tx.objectStore(store_name).get(0).onsuccess = spin;
    };
    spin();

    return () => {
        assert_false(completed, "Transaction completed while kept alive");
        pin = false;
    };
};

let active_promise_test;
const promise_test = (func, name, properties) => {
    var test = async_test(name, properties);
    // If there is no promise tests queue make one.
    if (!active_promise_test) {
        active_promise_test = Promise.resolve();
    }
    active_promise_test = active_promise_test.then(function() {
        var donePromise = new Promise(function(resolve) {
            test.add_cleanup(resolve);
        });
        var promise = test.step(func, test, test);
        test.step(function() {
            assert_not_equals(promise, undefined);
        });
        Promise.resolve(promise)
            .then(function() {
                test.done();
            })
            .catch(
                test.step_func(function(value) {
                    throw value;
                }),
            );
        return donePromise;
    });
};

const setup = (...args) => {
    console.log("Setup", ...args);
};

const step_timeout = (fn, timeout, ...args) => {
    return setTimeout(() => {
        fn(...args);
    }, timeout);
};

const addToGlobal = {
    add_completion_callback,
    assert_array_equals,
    assert_class_string,
    assert_equals,
    assert_false,
    assert_key_equals,
    assert_not_equals,
    assert_readonly,
    assert_throws,
    assert_true,
    async_test,
    createdb,
    createdb_for_multiple_tests,
    EventWatcher,
    expect,
    fail,
    format_value,
    indexeddb_test,
    is_transaction_active,
    keep_alive,
    promise_test,
    setup,
    step_timeout,
    test,
};

Object.assign(global, addToGlobal);

require("./support-promises.js");
