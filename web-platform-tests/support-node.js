const assert = require("assert");
require("../build/global");
global.Event = require("../build/lib/FakeEvent").default;

global.document = {};
global.self = {
    location: {},
};
global.window = global;

const add_completion_callback = (...args) => {
    console.log("add_completion_callback", ...args);
};

const assert_array_equals = (...args) => assert.deepEqual(...args);

const assert_equals = (...args) => assert.equal(...args);

const assert_false = (val, message) => assert.ok(!val, message);

const assert_key_equals = (actual, expected, description) => {
  assert_equals(indexedDB.cmp(actual, expected), 0, description);
};

const assert_not_equals = (...args) => assert.notEqual(...args);

const assert_throws = (errName, block, message) => assert.throws(block, new RegExp(errName), message);

const assert_true = (...args) => assert.ok(...args);

class AsyncTest {
    constructor() {
        this.completed = false;
        this.cleanupCallbacks = [];

        this.timeoutID = setTimeout(() => {
            if (!this.completed) {
                this.completed = true;
                throw new Error("Timed out!");
            }
        }, 1000);
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
            console.log("Success!");
        } else {
            throw new Error("AsyncTest.done() called multiple times");
        }
    }

    step(fn) {
        return (...args) => {
            try {
                fn.apply(this, args);
            } catch (err) {
                if (!this.completed) {
                    throw err;
                }
            }
        }
    }

    step_func(fn) {
        return this.step(fn);
    }

    step_func_done(fn) {
        return (...args) => {
            fn.apply(this, args);
            this.done();
        };
    }

    step_timeout(fn, timeout, ...args) {
        return setTimeout(this.step_func(() => {
            return fn(...args);
        }), timeout);
    }

    unreached_func(message) {
        return () => this.fail(new Error(message));
    }

    fail(err) {
        console.log('Failed!');
        this.complete();

        // `throw err` was silent
        console.error(err);
        process.exit(1);
    }

    add_cleanup(cb) {
        this.cleanupCallbacks.push(cb);
    }
}

const async_test = (cb) => {
    const t = new AsyncTest();
    if (typeof cb === "function") {
        cb(t);
    }
    return t;
};

const test = (cb) => {
    cb();
};

function createdb(test, dbname, version)
{
    var rq_open = createdb_for_multiple_tests(dbname, version);
    return rq_open.setTest(test);
}

function createdb_for_multiple_tests(dbname, version) {
    var rq_open,
        fake_open = {},
        test = null,
        dbname = (dbname ? dbname : "testdb-" + new Date().getTime() + Math.random() );

    if (version)
        rq_open = indexedDB.open(dbname, version);
    else
        rq_open = indexedDB.open(dbname);

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

                if (e.target.result + '' == '[object IDBDatabase]' &&
                    !this.db) {
                  this.db = e.target.result;

                  this.db.onerror = fail(test, 'unexpected db.error');
                  this.db.onabort = fail(test, 'unexpected db.abort');
                  this.db.onversionchange =
                      fail(test, 'unexpected db.versionchange');
                }
            });
        });
        rq_open.__defineSetter__("on" + evt, function(h) {
            rq_open.manually_handled[evt] = true;
            if (!h)
                rq_open.addEventListener(evt, function() {});
            else
                rq_open.addEventListener(evt, test.step_func(h.bind(test)));
        });
    }

    // add a .setTest method to the DB object
    Object.defineProperty(rq_open, 'setTest', {
        enumerable: false,
        value: function(test) {
            auto_fail("upgradeneeded", test);
            auto_fail("success", test);
            auto_fail("blocked", test);
            auto_fail("error", test);

            return this;
        }
    });

    return rq_open;
}

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
        return "[" + val.map(function(x) {return format_value(x, seen);}).join(", ") + "]";
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
        if (val === -0 && 1/val === -Infinity) {
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
                    ret += " " + val.attributes[i].name + '="' + val.attributes[i].value + '"';
                }
                ret += ">" + val.innerHTML + "</" + val.localName + ">";
                return "Element node " + truncate(ret, 60);
            case Node.TEXT_NODE:
                return 'Text node "' + truncate(val.data, 60) + '"';
            case Node.PROCESSING_INSTRUCTION_NODE:
                return "ProcessingInstruction node with target " + format_value(truncate(val.target, 60)) + " and data " + format_value(truncate(val.data, 60));
            case Node.COMMENT_NODE:
                return "Comment node <!--" + truncate(val.data, 60) + "-->";
            case Node.DOCUMENT_NODE:
                return "Document node with " + val.childNodes.length + (val.childNodes.length == 1 ? " child" : " children");
            case Node.DOCUMENT_TYPE_NODE:
                return "DocumentType node";
            case Node.DOCUMENT_FRAGMENT_NODE:
                return "DocumentFragment node with " + val.childNodes.length + (val.childNodes.length == 1 ? " child" : " children");
            default:
                return "Node object of unknown type";
            }
        }

    /* falls through */
    default:
        try {
            return typeof val + ' "' + truncate(String(val), 1000) + '"';
        } catch(e) {
            return ("[stringifying object threw " + String(e) +
                    " with type " + String(typeof e) + "]");
        }
    }
}

const indexeddb_test = (upgrade_func, open_func, description, options) => {
    async_test(function(t) {
        options = Object.assign({upgrade_will_abort: false}, options);
        var dbname = "testdb-" + new Date().getTime() + Math.random();
        var del = indexedDB.deleteDatabase(dbname);
        del.onerror = t.unreached_func('deleteDatabase should succeed');
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
            open.onsuccess = t.unreached_func('open should not succeed');
        } else {
            open.onerror = t.unreached_func('open should succeed');
            open.onsuccess = t.step_func(function() {
                var db = open.result;
                if (open_func)
                    open_func(t, db);
            });
        }
    }, description);
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
        Promise.resolve(promise).then(
                function() {
                    test.done();
                })
            .catch(test.step_func(
                function(value) {
                    throw value;
                }));
        return donePromise;
    });
}

const setup = (...args) => {
    console.log("Setup", ...args);
};

const step_timeout = (fn, timeout, ...args) => {
    return setTimeout(() => {
        fn(...args);
    }, timeout);
}

const addToGlobal = {
    add_completion_callback,
    assert_array_equals,
    assert_equals,
    assert_false,
    assert_key_equals,
    assert_not_equals,
    assert_throws,
    assert_true,
    async_test,
    createdb,
    createdb_for_multiple_tests,
    fail,
    format_value,
    indexeddb_test,
    promise_test,
    setup,
    step_timeout,
    test,
};

Object.assign(global, addToGlobal);
