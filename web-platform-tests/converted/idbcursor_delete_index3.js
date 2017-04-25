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
      t = async_test(),
      records = [ { pKey: "primaryKey_0", iKey: "indexKey_0" },
                  { pKey: "primaryKey_1", iKey: "indexKey_1" } ];

    var open_rq = createdb(t);
    open_rq.onupgradeneeded = function(e) {
        db = e.target.result;
        var objStore = db.createObjectStore("test", { keyPath: "pKey" });
        var index = objStore.createIndex("index", "iKey");

        for (var i = 0; i < records.length; i++)
            objStore.add(records[i]);

        var cursor_rq = index.openCursor();

        cursor_rq.onsuccess = t.step_func(function(e) {
            var cursor = e.target.result;
            assert_true(cursor instanceof IDBCursor, "cursor exist");
            window.cursor = cursor;
        });

        e.target.transaction.oncomplete = t.step_func(function(e) {
            assert_throws('TransactionInactiveError', function() { window.cursor.delete(); })
            t.done();
        });
    }

