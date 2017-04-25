const add_completion_callback = (...args) => {
    console.log("add_completion_callback", ...args);
};

const assert = require("assert");

const assert_array_equals = (...args) => assert.deepEqual(...args);

const assert_equals = (...args) => assert.equal(...args);

const assert_false = (val, message) => assert.ok(!val, message);

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
            fn(...args);
        }
    }

    step_func(fn) {
        return this.step(fn);
    }

    step_func_done(func) {
        return (...args) => {
            fn(...args);
            this.done();
        };
    }

    unreached_func(message) {
        return () => this.fail(new Error(message));
    }

    fail(err) {
        this.complete();
        throw err;
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

    function auto_fail(evt) {
        /* Fail handlers, if we haven't set on/whatever/, don't
         * expect to get event whatever. */
        rq_open['on' + evt] = function () { test.fail(new Error('Unexpected ' + evt + ' event')) };
    }

    // add a .setTest method to the DB object
    Object.defineProperty(rq_open, 'setTest', {
        enumerable: false,
        value: function(test) {
            auto_fail(test, "upgradeneeded");
            auto_fail(test, "success");
            auto_fail(test, "blocked");
            auto_fail(test, "error");

            return this;
        }
    });

    return rq_open;
}

const fail = (test, message) => {
    test.fail(new Error(message));
};

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

const setup = (...args) => {
    console.log("Setup", ...args);
};

module.exports = {
    add_completion_callback,
    assert_array_equals,
    assert_equals,
    assert_false,
    assert_not_equals,
    assert_throws,
    assert_true,
    async_test,
    createdb,
    createdb_for_multiple_tests,
    fail,
    indexeddb_test,
    setup,
    test,
};
