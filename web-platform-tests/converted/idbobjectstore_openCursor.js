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



    var db
    var open_rq = createdb(async_test())

    open_rq.onupgradeneeded = function(e) {
        db = e.target.result;
        var store = db.createObjectStore("store");

        for (var i=0; i < 100; i++)
            store.add("record_" + i, i);
    };

    open_rq.onsuccess = function(e) {
        var count = 0
        var txn = db.transaction("store")

        txn.objectStore("store")
           .openCursor().onsuccess = this.step_func(function(e)
        {
            if (e.target.result) {
                count += 1;
                e.target.result.continue()
            }
        })

        txn.oncomplete = this.step_func(function() {
            assert_equals(count, 100);
            this.done()
        })
    }

