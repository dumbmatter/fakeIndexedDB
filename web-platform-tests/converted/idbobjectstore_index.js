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

        db.createObjectStore("store")
          .createIndex("index", "indexedProperty");
    };

    open_rq.onsuccess = function(e) {
        var index = db.transaction("store")
                      .objectStore("store")
                      .index("index");

        assert_true(index instanceof IDBIndex, 'instanceof IDBIndex');
        t.done();
    };

