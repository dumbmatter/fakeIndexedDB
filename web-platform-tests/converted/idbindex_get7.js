require("../../build/global.js");
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
    indexeddb_test,
    setup,
    test,
} = require("../support-node.js");

const document = {};
const window = global;


    var db,
        t = async_test();

    var open_rq = createdb(t);
    open_rq.onupgradeneeded = function(e) {
        db = e.target.result;
        var store = db.createObjectStore("store", { keyPath: "key" });
        var index = store.createIndex("index", "indexedProperty");
        store.add({ key: 1, indexedProperty: "data" });
    }
    open_rq.onsuccess = function(e) {
        db = e.target.result;
        var tx = db.transaction('store');
        var index = tx.objectStore('store').index('index');
        tx.abort();

        assert_throws("TransactionInactiveError", function(){
            index.get("data");
        });
        t.done();
    }
