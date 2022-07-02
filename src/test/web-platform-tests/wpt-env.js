import assert from "node:assert";
import "../../../auto/index.mjs";
import FakeEvent from "../../../build/esm/lib/FakeEvent.js";

global.Event = FakeEvent;

global.Blob = function (parts, options = {}) {
    this.size = 0;
    Object.assign(this, options);
    return this;
};

global.File = function (bits, name, options = {}) {
    this.name = name;
    Object.assign(this, options);
    return this;
};

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

const assert_object_equals = (...args) => assert.deepEqual(...args);

const assert_unreached = (msg) => assert.fail(msg);

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
        description
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
            timeout
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

const test = (cb) => {
    cb();
};

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

    var eventHandler = test.step_func(function (evt) {
        assert_true(
            !!waitingFor,
            "Not expecting event, but got " + evt.type + " event"
        );
        assert_equals(
            evt.type,
            waitingFor.types[0],
            "Expected " +
                waitingFor.types[0] +
                " event, but got " +
                evt.type +
                " event instead"
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
    this.wait_for = function (types) {
        if (waitingFor) {
            return Promise.reject("Already waiting for an event or events");
        }
        if (typeof types == "string") {
            types = [types];
        }
        return new Promise(function (resolve, reject) {
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

const replacements = {
    0: "0",
    1: "x01",
    2: "x02",
    3: "x03",
    4: "x04",
    5: "x05",
    6: "x06",
    7: "x07",
    8: "b",
    9: "t",
    10: "n",
    11: "v",
    12: "f",
    13: "r",
    14: "x0e",
    15: "x0f",
    16: "x10",
    17: "x11",
    18: "x12",
    19: "x13",
    20: "x14",
    21: "x15",
    22: "x16",
    23: "x17",
    24: "x18",
    25: "x19",
    26: "x1a",
    27: "x1b",
    28: "x1c",
    29: "x1d",
    30: "x1e",
    31: "x1f",
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
                .map(function (x) {
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

let active_promise_test;
const promise_test = (func, name, properties) => {
    var test = async_test(name, properties);
    // If there is no promise tests queue make one.
    if (!active_promise_test) {
        active_promise_test = Promise.resolve();
    }
    active_promise_test = active_promise_test.then(function () {
        var donePromise = new Promise(function (resolve) {
            test.add_cleanup(resolve);
        });
        var promise = test.step(func, test, test);
        test.step(function () {
            assert_not_equals(promise, undefined);
        });
        Promise.resolve(promise)
            .then(function () {
                test.done();
            })
            .catch(
                test.step_func(function (value) {
                    throw value;
                })
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
    assert_object_equals,
    assert_not_equals,
    assert_readonly,
    assert_throws,
    assert_true,
    assert_unreached,
    async_test,
    EventWatcher,
    format_value,
    promise_test,
    setup,
    step_timeout,
    test,
};

Object.assign(global, addToGlobal);
