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
      t = async_test(),
      record = { property: "data" },
      expected_keys = [ 1, 2, 3, 4 ];

    var open_rq = createdb(t);
    open_rq.onupgradeneeded = function(e) {
        db = e.target.result;
        var objStore = db.createObjectStore("store", { autoIncrement: true });

        objStore.put(record);
        objStore.put(record);
        objStore.put(record);
        objStore.put(record);
    };

    open_rq.onsuccess = function(e) {
        var actual_keys = [],
          rq = db.transaction("store")
                 .objectStore("store")
                 .openCursor();

        rq.onsuccess = t.step_func(function(e) {
            var cursor = e.target.result;

            if (cursor) {
                actual_keys.push(cursor.key);
                cursor.continue();
            }
            else {
                assert_array_equals(actual_keys, expected_keys);
                t.done();
            }
        });
    };
