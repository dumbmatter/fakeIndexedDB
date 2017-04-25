require("../../build/global");
const Event = require("../../build/lib/FakeEvent").default;
const {
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
} = require("../support-node");

const document = {};
const window = global;


    var events = [];

    var open_rq = createdb(async_test(document.title, {timeout: 10000}));
    open_rq.onupgradeneeded = function(e) {
        var db = e.target.result;
        var txn = e.target.transaction;
        var store = db.createObjectStore("s");
        var rq1 = store.add("", 1);
        var rq2 = store.add("", 1);
        db.onerror = function(){};

        log_request(' db',  db);
        log_request('txn', txn);
        log_request('rq1', rq1);
        log_request('rq2', rq2);

        // Don't let it get to abort
        db.addEventListener('error', function(e) { e.preventDefault() }, false);
    }

    open_rq.onsuccess = function(e) {
        log("open_rq.success")(e);
        assert_array_equals(events, [
                                      "capture  db.success",
                                      "capture txn.success",
                                      "capture rq1.success",
                                      "bubble  rq1.success",

                                      "capture  db.error: ConstraintError",
                                      "capture txn.error: ConstraintError",
                                      "capture rq2.error: ConstraintError",
                                      "bubble  rq2.error: ConstraintError",
                                      "bubble  txn.error: ConstraintError",
                                      "bubble   db.error: ConstraintError",

                                      "open_rq.success"
                                     ],
                            "events");
        this.done();
    }


    function log_request(type, obj) {
        obj.addEventListener('success', log('capture ' + type + '.success'), true);
        obj.addEventListener('success', log('bubble  ' + type + '.success'), false);
        obj.addEventListener('error', log('capture ' + type + '.error'), true);
        obj.addEventListener('error', log('bubble  ' + type + '.error'), false);
    }

    function log(msg) {
        return function(e) {
            if(e && e.target && e.target.error)
                events.push(msg + ": " + e.target.error.name);
            else
                events.push(msg);
        };
    }
