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


    var db,
      t = async_test();

    var open_rq = createdb(t);
    open_rq.onupgradeneeded = function(e) {
        db = e.target.result;
        db.createObjectStore("store", { keyPath: "key" })
    }

    open_rq.onsuccess = function (e) {
        var store = db.transaction("store")
                      .objectStore("store");
        store.transaction.abort();
        assert_throws("TransactionInactiveError", function () {
            store.get(1);
        }, "throw TransactionInactiveError on aborted transaction.");
        t.done();
    }
