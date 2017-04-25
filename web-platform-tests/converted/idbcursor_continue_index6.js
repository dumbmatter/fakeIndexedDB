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



    var db,
      t = async_test(document.title, {timeout: 10000}),
      records = [ { pKey: "primaryKey_0",   iKey: "indexKey_0" },
                  { pKey: "primaryKey_1",   iKey: "indexKey_1" },
                  { pKey: "primaryKey_1-2", iKey: "indexKey_1" },
                  { pKey: "primaryKey_2",   iKey: "indexKey_2" } ],

      expected = [ { pKey: "primaryKey_0",   iKey: "indexKey_0" },
                 { pKey: "primaryKey_1",   iKey: "indexKey_1" },
                 { pKey: "primaryKey_2",   iKey: "indexKey_2" } ];

    var open_rq = createdb(t);
    open_rq.onupgradeneeded = function(e) {
        db = e.target.result;
        var objStore = db.createObjectStore("test", { keyPath: "pKey" });

        objStore.createIndex("index", "iKey");

        for (var i = 0; i < records.length; i++)
            objStore.add(records[i]);
    };

    open_rq.onsuccess = function(e) {
        var count = 0,
          cursor_rq = db.transaction("test")
                        .objectStore("test")
                        .index("index")
                        .openCursor(undefined, "nextunique");

        cursor_rq.onsuccess = t.step_func(function(e) {
            if (!e.target.result) {
                assert_equals(count, expected.length, 'count');
                t.done();
                return;
            }
            var cursor = e.target.result,
              record = cursor.value;

            assert_equals(record.pKey, expected[count].pKey, "pKey #" + count);
            assert_equals(record.iKey, expected[count].iKey, "iKey #" + count);

            assert_equals(cursor.key,  expected[count].iKey, "cursor.key #" + count);
            assert_equals(cursor.primaryKey, expected[count].pKey, "cursor.primaryKey #" + count);

            count++;
            cursor.continue(expected[count] ? expected[count].iKey : undefined);
        });
    };

