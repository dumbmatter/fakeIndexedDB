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



    var db,
      t = async_test(document.title, {timeout: 10000}),
      records = [ { pKey: "primaryKey_0", iKey: "indexKey_0" },
                  { pKey: "primaryKey_1", iKey: "indexKey_1" } ];

    var open_rq = createdb(t);
    open_rq.onupgradeneeded = function(e) {
        db = e.target.result;
        var objStore = db.createObjectStore("test", { keyPath:"pKey" });

        objStore.createIndex("index", "iKey");

        for (var i = 0; i < records.length; i++)
            objStore.add(records[i]);
    };

    open_rq.onsuccess = function(e) {
        var cursor_rq = db.transaction("test")
                          .objectStore("test")
                          .index("index")
                          .openCursor(undefined, "next");

        cursor_rq.onsuccess = t.step_func(function(e) {
            var cursor = e.target.result;

            assert_true(cursor != null, "cursor exist");
            assert_throws(new TypeError(),
                function() { cursor.advance(-1); });

            t.done();
        });
    };

