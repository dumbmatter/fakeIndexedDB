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



var db, open_rq = createdb(async_test(), undefined, 2);

open_rq.onupgradeneeded = function(e) {
    db = e.target.result;
    assert_equals(db.version, 2);
    var transaction = e.target.transaction;
    transaction.oncomplete = fail(this, "unexpected transaction.complete");
    transaction.onabort = function(e) {
        assert_equals(e.target.db.version, 0);
    }
    db.onabort = function() {}

    transaction.abort();
}

open_rq.onerror = function(e) {
    assert_equals(open_rq, e.target);
    assert_equals(e.target.result, undefined);
    assert_equals(e.target.error.name, "AbortError");
    assert_equals(db.version, 0);
    assert_equals(open_rq.transaction, null);
    this.done();
}
