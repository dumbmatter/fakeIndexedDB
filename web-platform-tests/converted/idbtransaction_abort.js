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
    test,
} = require("../support-node");

const document = {};
const window = global;


    var db, aborted,
      t = async_test(document.title, {timeout: 10000}),
      record = { indexedProperty: "bar" };

    var open_rq = createdb(t);
    open_rq.onupgradeneeded = function(e) {
        db = e.target.result;
        var txn = e.target.transaction,
          objStore = db.createObjectStore("store");

        objStore.add(record, 1);
        objStore.add(record, 2);
        var index = objStore.createIndex("index", "indexedProperty", { unique: true });

        assert_true(index instanceof IDBIndex, "IDBIndex");

        e.target.transaction.onabort = t.step_func(function(e) {
            aborted = true;
            assert_equals(e.type, "abort", "event type");
        });

        db.onabort = function(e) {
            assert_true(aborted, "transaction.abort event has fired");
            t.done();
        };

        e.target.transaction.oncomplete = fail(t, "got complete, expected abort");
    };

