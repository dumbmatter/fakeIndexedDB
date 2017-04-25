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


    var db, aborted,
      t = async_test(document.title, {timeout: 10000})

    var open_rq = createdb(t);
    open_rq.onupgradeneeded = function(e) {
        db = e.target.result;
        var txn = e.target.transaction,
          objStore = db.createObjectStore("store");

        for (var i = 0; i < 5; i++)
            objStore.add("object_" + i, i);

        var rq = objStore.createIndex("index", "")
        rq.onerror = function() { assert_unreached("error: " + rq.error.name); }
        rq.onsuccess = function() { }

        objStore.index("index")
                .get('object_4')
                .onsuccess = t.step_func(function(e) {
            assert_equals(e.target.result, 'object_4', 'result');
        });
    }

    open_rq.onsuccess = function() {
        t.done();
    }
