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
    setup,
    test,
} = require("../support-node");

const document = {};
const window = global;


    var db, aborted,
      t = async_test(document.title, {timeout:19000})

    var open_rq = createdb(t);
    open_rq.onupgradeneeded = function(e) {
        db = e.target.result;
        var txn = e.target.transaction,
          objStore = db.createObjectStore("store", { keyPath: 'key' });

        for (var i = 0; i < 100; i++)
            objStore.add({ key: "key_" + i, indexedProperty: "indexed_" + i });

        var idx = objStore.createIndex("index", "indexedProperty")

        idx.get('indexed_99').onsuccess = t.step_func(function(e) {
            assert_equals(e.target.result.key, 'key_99', 'key');
        });
        idx.get('indexed_9').onsuccess = t.step_func(function(e) {
            assert_equals(e.target.result.key, 'key_9', 'key');
        });
    }

    open_rq.onsuccess = function() {
        t.done();
    }
