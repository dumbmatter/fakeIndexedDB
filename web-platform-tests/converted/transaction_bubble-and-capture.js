require("../../build/global");
const Event = require("../../build/lib/FakeEvent").default;
const {
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
    format_value,
    indexeddb_test,
    setup,
    test,
} = require("../support-node");

const document = {};
const window = global;


    var events = [];

    var open_rq = createdb(async_test(document.title, {timeout: 10000}));
    open_rq.onupgradeneeded = function(e) {
        var db = e.target.result;
        var txn = e.target.transaction;
        var store = db.createObjectStore("store");
        var rq1 = store.add("", 1);
        var rq2 = store.add("", 1);

        db.onerror = undefined; // We will run db.error, but don't let that fail the test

        log_events('db', db, 'success');
        log_events('db', db, 'error');

        log_events('txn', txn, 'success');
        log_events('txn', txn, 'error');

        log_events('rq1', rq1, 'success');
        log_events('rq1', rq1, 'error');

        log_events('rq2', rq2, 'success');
        log_events('rq2', rq2, 'error');

        // Don't let it get to abort
        db.addEventListener('error', function(e) { e.preventDefault(); }, false);
    }

    open_rq.onsuccess = function(e) {
        log("open_rq.success")(e);
        assert_array_equals(events, [
                                      "capture db.success",
                                      "capture txn.success",
                                      "capture rq1.success",
                                      "bubble  rq1.success",

                                      "capture db.error: ConstraintError",
                                      "capture txn.error: ConstraintError",
                                      "capture rq2.error: ConstraintError",
                                      "bubble  rq2.error: ConstraintError",
                                      "bubble  txn.error: ConstraintError",
                                      "bubble  db.error: ConstraintError",

                                      "open_rq.success",
                                     ],
                            "events");
        this.done();
    }


    function log_events(type, obj, evt) {
        obj.addEventListener(evt, log('capture ' + type + '.' + evt), true);
        obj.addEventListener(evt, log('bubble  ' + type + '.' + evt), false);
    }

    function log(msg) {
        return function(e) {
            if(e && e.target && e.target.error)
                events.push(msg + ": " + e.target.error.name);
            else
                events.push(msg);
        };
    }
