import assert from "node:assert";
import "../../../auto/index.mjs";
import FakeEvent from "../../../build/esm/lib/FakeEvent.js";
import {
    AbortError,
    ConstraintError,
    DataCloneError,
    DataError,
    InvalidAccessError,
    InvalidStateError,
    NotFoundError,
    ReadOnlyError,
    TransactionInactiveError,
    VersionError
} from "../../../build/esm/lib/errors.js"

global.AbortError = AbortError
global.ConstraintError = ConstraintError
global.DataCloneError = DataCloneError
global.DataError = DataError
global.InvalidAccessError = InvalidAccessError
global.InvalidStateError = InvalidStateError
global.NotFoundError = NotFoundError
global.ReadOnlyError = ReadOnlyError
global.TransactionInactiveError = TransactionInactiveError
global.VersionError = VersionError

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
global.location = {
    location: {},
};
global.self = global;
global.window = global;

// This is currently used by the tests just to sniff whether the object is clonable or not
global.postMessage = (obj) => {
    structuredClone(obj)
}

const add_completion_callback = (...args) => {
    console.log("add_completion_callback", ...args);
};

// Array.from is to help with DOMStringList to Array comparisons
const assert_array_equals = (a, b, ...args) =>
    assert.deepEqual(Array.from(a), Array.from(b), ...args);

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

function AssertionError(message)
{
    this.message = message;
    this.stack = this.get_stack();
}

/**
 * Assert the provided value is thrown.
 *
 * @param {value} exception The expected exception.
 * @param {Function} func Function which should throw.
 * @param {string} description Error description for the case that the error is not thrown.
 */
function assert_throws_exactly(exception, func, description)
{
    assert_throws_exactly_impl(exception, func, description,
        "assert_throws_exactly");
}

function same_value(x, y) {
    if (y !== y) {
        //NaN case
        return x !== x;
    }
    if (x === 0 && y === 0) {
        //Distinguish +0 and -0
        return 1/x === 1/y;
    }
    return x === y;
}

/**
 * Like assert_throws_exactly but allows specifying the assertion type
 * (assert_throws_exactly or promise_rejects_exactly, in practice).
 */
function assert_throws_exactly_impl(exception, func, description,
                                    assertion_type)
{
    try {
        func.call(this);
        assert(false, assertion_type, description,
            "${func} did not throw", {func:func});
    } catch (e) {
        if (e instanceof AssertionError) {
            throw e;
        }

        assert(same_value(e, exception), assertion_type, description,
            "${func} threw ${e} but we expected it to throw ${exception}",
            {func:func, e:e, exception:exception});
    }
}

/**
 * Assert a JS Error with the expected constructor is thrown.
 *
 * @param {object} constructor The expected exception constructor.
 * @param {Function} func Function which should throw.
 * @param {string} description Error description for the case that the error is not thrown.
 */
function assert_throws_js(constructor, func, description)
{
    assert_throws_js_impl(constructor, func, description,
        "assert_throws_js");
}

/**
 * Like assert_throws_js but allows specifying the assertion type
 * (assert_throws_js or promise_rejects_js, in practice).
 */
function assert_throws_js_impl(constructor, func, description,
                               assertion_type)
{
    try {
        func.call(this);
        assert(false, assertion_type, description,
            "${func} did not throw", {func:func});
    } catch (e) {
        if (e instanceof AssertionError) {
            throw e;
        }

        // Basic sanity-checks on the thrown exception.
        assert(typeof e === "object",
            assertion_type, description,
            "${func} threw ${e} with type ${type}, not an object",
            {func:func, e:e, type:typeof e});

        assert(e !== null,
            assertion_type, description,
            "${func} threw null, not an object",
            {func:func});

        // Basic sanity-check on the passed-in constructor
        assert(typeof constructor == "function",
            assertion_type, description,
            "${constructor} is not a constructor",
            {constructor:constructor});
        var obj = constructor;
        while (obj) {
            if (typeof obj === "function" &&
                obj.name === "Error") {
                break;
            }
            obj = Object.getPrototypeOf(obj);
        }
        assert(obj != null,
            assertion_type, description,
            "${constructor} is not an Error subtype",
            {constructor:constructor});

        // And checking that our exception is reasonable
        assert(e.constructor === constructor &&
            e.name === constructor.name,
            assertion_type, description,
            "${func} threw ${actual} (${actual_name}) expected instance of ${expected} (${expected_name})",
            {func:func, actual:e, actual_name:e.name,
                expected:constructor,
                expected_name:constructor.name});
    }
}

/**
 * Assert a DOMException with the expected type is thrown.
 *
 * @param {number|string} type The expected exception name or code.  See the
 *        table of names and codes at
 *        https://heycam.github.io/webidl/#dfn-error-names-table
 *        If a number is passed it should be one of the numeric code values
 *        in that table (e.g. 3, 4, etc).  If a string is passed it can
 *        either be an exception name (e.g. "HierarchyRequestError",
 *        "WrongDocumentError") or the name of the corresponding error code
 *        (e.g. "HIERARCHY_REQUEST_ERR", "WRONG_DOCUMENT_ERR").
 *
 * For the remaining arguments, there are two ways of calling
 * promise_rejects_dom:
 *
 * 1) If the DOMException is expected to come from the current global, the
 * second argument should be the function expected to throw and a third,
 * optional, argument is the assertion description.
 *
 * 2) If the DOMException is expected to come from some other global, the
 * second argument should be the DOMException constructor from that global,
 * the third argument the function expected to throw, and the fourth, optional,
 * argument the assertion description.
 */
function assert_throws_dom(type, funcOrConstructor, descriptionOrFunc, maybeDescription)
{
    let constructor, func, description;
    if (funcOrConstructor.name === "DOMException") {
        constructor = funcOrConstructor;
        func = descriptionOrFunc;
        description = maybeDescription;
    } else {
        constructor = self.DOMException;
        func = funcOrConstructor;
        description = descriptionOrFunc;
        assert(maybeDescription === undefined,
            "Too many args pased to no-constructor version of assert_throws_dom");
    }
    assert_throws_dom_impl(type, func, description, "assert_throws_dom", constructor)
}

/**
 * Similar to assert_throws_dom but allows specifying the assertion type
 * (assert_throws_dom or promise_rejects_dom, in practice).  The
 * "constructor" argument must be the DOMException constructor from the
 * global we expect the exception to come from.
 */
function assert_throws_dom_impl(type, func, description, assertion_type, constructor)
{
    try {
        func.call(this);
        assert(false, assertion_type, description,
            "${func} did not throw", {func:func});
    } catch (e) {
        if (e instanceof AssertionError) {
            throw e;
        }

        // Basic sanity-checks on the thrown exception.
        assert(typeof e === "object",
            assertion_type, description,
            "${func} threw ${e} with type ${type}, not an object",
            {func:func, e:e, type:typeof e});

        assert(e !== null,
            assertion_type, description,
            "${func} threw null, not an object",
            {func:func});

        // Sanity-check our type
        assert(typeof type == "number" ||
            typeof type == "string",
            assertion_type, description,
            "${type} is not a number or string",
            {type:type});

        var codename_name_map = {
            INDEX_SIZE_ERR: 'IndexSizeError',
            HIERARCHY_REQUEST_ERR: 'HierarchyRequestError',
            WRONG_DOCUMENT_ERR: 'WrongDocumentError',
            INVALID_CHARACTER_ERR: 'InvalidCharacterError',
            NO_MODIFICATION_ALLOWED_ERR: 'NoModificationAllowedError',
            NOT_FOUND_ERR: 'NotFoundError',
            NOT_SUPPORTED_ERR: 'NotSupportedError',
            INUSE_ATTRIBUTE_ERR: 'InUseAttributeError',
            INVALID_STATE_ERR: 'InvalidStateError',
            SYNTAX_ERR: 'SyntaxError',
            INVALID_MODIFICATION_ERR: 'InvalidModificationError',
            NAMESPACE_ERR: 'NamespaceError',
            INVALID_ACCESS_ERR: 'InvalidAccessError',
            TYPE_MISMATCH_ERR: 'TypeMismatchError',
            SECURITY_ERR: 'SecurityError',
            NETWORK_ERR: 'NetworkError',
            ABORT_ERR: 'AbortError',
            URL_MISMATCH_ERR: 'URLMismatchError',
            QUOTA_EXCEEDED_ERR: 'QuotaExceededError',
            TIMEOUT_ERR: 'TimeoutError',
            INVALID_NODE_TYPE_ERR: 'InvalidNodeTypeError',
            DATA_CLONE_ERR: 'DataCloneError'
        };

        var name_code_map = {
            IndexSizeError: 1,
            HierarchyRequestError: 3,
            WrongDocumentError: 4,
            InvalidCharacterError: 5,
            NoModificationAllowedError: 7,
            NotFoundError: 8,
            NotSupportedError: 9,
            InUseAttributeError: 10,
            InvalidStateError: 11,
            SyntaxError: 12,
            InvalidModificationError: 13,
            NamespaceError: 14,
            InvalidAccessError: 15,
            TypeMismatchError: 17,
            SecurityError: 18,
            NetworkError: 19,
            AbortError: 20,
            URLMismatchError: 21,
            QuotaExceededError: 22,
            TimeoutError: 23,
            InvalidNodeTypeError: 24,
            DataCloneError: 25,

            EncodingError: 0,
            NotReadableError: 0,
            UnknownError: 0,
            ConstraintError: 0,
            DataError: 0,
            TransactionInactiveError: 0,
            ReadOnlyError: 0,
            VersionError: 0,
            OperationError: 0,
            NotAllowedError: 0
        };

        var code_name_map = {};
        for (var key in name_code_map) {
            if (name_code_map[key] > 0) {
                code_name_map[name_code_map[key]] = key;
            }
        }

        var required_props = {};
        var name;

        if (typeof type === "number") {
            if (type === 0) {
                throw new AssertionError('Test bug: ambiguous DOMException code 0 passed to assert_throws_dom()');
            } else if (!(type in code_name_map)) {
                throw new AssertionError('Test bug: unrecognized DOMException code "' + type + '" passed to assert_throws_dom()');
            }
            name = code_name_map[type];
            required_props.code = type;
        } else if (typeof type === "string") {
            name = type in codename_name_map ? codename_name_map[type] : type;
            if (!(name in name_code_map)) {
                throw new AssertionError('Test bug: unrecognized DOMException code name or name "' + type + '" passed to assert_throws_dom()');
            }

            required_props.code = name_code_map[name];
        }

        if (required_props.code === 0 ||
            ("name" in e &&
                e.name !== e.name.toUpperCase() &&
                e.name !== "DOMException")) {
            // New style exception: also test the name property.
            required_props.name = name;
        }

        for (var prop in required_props) {
            if (!(prop in e && e[prop] == required_props[prop])) {
                debugger
            }
            assert(prop in e && e[prop] == required_props[prop],
                assertion_type, description,
                "${func} threw ${e} that is not a DOMException " + type + ": property ${prop} is equal to ${actual}, expected ${expected}",
                {func:func, e:e, prop:prop, actual:e[prop], expected:required_props[prop]});
        }

        // FakeIndexedDB modification from the original test
        // Here we just check if the error has the right superclass since we don't throw straight DOMExceptions
        const testCondition = e.constructor === constructor || Object.getPrototypeOf(e.constructor) === constructor;

        // Check that the exception is from the right global.  This check is last
        // so more specific, and more informative, checks on the properties can
        // happen in case a totally incorrect exception is thrown.
        assert(testCondition,
            assertion_type, description,
            "${func} threw an exception from the wrong global",
            {func});

    }
}

// Designed to limit tests based on a query string param, here we just run it
function subsetTest(testFunc, ...args) {
    return testFunc(...args);
}

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
    assert_object_equals,
    assert_not_equals,
    assert_readonly,
    assert_throws,
    assert_throws_dom,
    assert_throws_exactly,
    assert_throws_js,
    assert_true,
    assert_unreached,
    async_test,
    EventWatcher,
    format_value,
    promise_test,
    setup,
    step_timeout,
    subsetTest,
    test,
};

Object.assign(global, addToGlobal);
