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


    var db,
      count = 0,
      t = async_test(document.title, {timeout: 10000}),
      records = [ { pKey: "primaryKey_0", obj: { iKey: "iKey_0" }},
                  { pKey: "primaryKey_2", obj: { iKey: "iKey_2" }} ],

      expected = [ [ "primaryKey_2", "iKey_2" ],
                   [ "primaryKey_1", "iKey_1" ],
                   [ "primaryKey_0", "iKey_0" ] ];

    var open_rq = createdb(t);
    open_rq.onupgradeneeded = function(e) {
        db = e.target.result;
        var objStore = db.createObjectStore("test", {keyPath:"pKey"});
        objStore.createIndex("index", [ "pKey", "obj.iKey" ]);

        for (var i = 0; i < records.length; i++)
            objStore.add(records[i]);
    };

    open_rq.onsuccess = function(e) {
        var cursor_rq = db.transaction("test", "readwrite")
                          .objectStore("test")
                          .index("index")
                          .openCursor(null, "prev");

        cursor_rq.onsuccess = t.step_func(function(e) {
            var cursor = e.target.result;
            if (!cursor) {
                assert_equals(count, 3, "cursor run count");
                t.done();
            }

            if (count === 0) {
                e.target.source.objectStore.add({ pKey: "primaryKey_1", obj: { iKey: "iKey_1" } });
            }
            assert_array_equals(cursor.key, expected[count], "primary key");

            cursor.continue();
            count++;
        });
    };
