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
      t = async_test(document.title, {timeout: 10000})

    var open_rq = createdb(t);
    open_rq.onupgradeneeded = function(e) {
        db = e.target.result;
        var objStore = db.createObjectStore("test");

        objStore.add("data", "key");
    };

    open_rq.onsuccess = t.step_func(function(e) {
        var txn = db.transaction("test", "readwrite"),
          cursor_rq = txn.objectStore("test")
                         .openCursor();

        cursor_rq.onsuccess = t.step_func(function(e) {
            var cursor = e.target.result;

            cursor.value = "new data!";
            cursor.update(cursor.value).onsuccess = t.step_func(function(e) {
                assert_equals(e.target.result, "key");
                t.done();
            });
        });
    });

