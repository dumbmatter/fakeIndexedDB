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
      t = async_test(),
      records = [ { pKey: "primaryKey_0" },
                  { pKey: "primaryKey_1" },
                  { pKey: "primaryKey_2" } ];

    var open_rq = createdb(t);
    open_rq.onupgradeneeded = function(e) {
        db = e.target.result;
        var objStore = db.createObjectStore("test", { keyPath: "pKey" });

        for (var i = 0; i < records.length; i++)
            objStore.add(records[i]);
    };

    open_rq.onsuccess = function(e) {
        var count = 0,
          cursor_rq = db.transaction("test")
                        .objectStore("test")
                        .openCursor(null, "prev");

        cursor_rq.onsuccess = t.step_func(function(e) {
            var cursor = e.target.result;

            assert_true(cursor != null, "cursor exist");

            switch(count) {
            case 0:
                assert_equals(cursor.value.pKey, records[2].pKey, "first cursor pkey");
                cursor.continue(records[1].pKey);
                break;

            case 1:
                assert_equals(cursor.value.pKey, records[1].pKey, "second cursor pkey");
                assert_throws("DataError",
                    function() { cursor.continue(records[2].pKey); });
                t.done();
                break;

            default:
                assert_unreached("Unexpected count value: " + count);
            }

            count++;
        });
    };
