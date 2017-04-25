require("../../build/global");
const Event = require("../../build/lib/FakeEvent").default;
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
    format_value,
    indexeddb_test,
    setup,
    test,
} = require("../support-node");

const document = {};
const window = global;


    var db,
      t = async_test(),
      record = { key: 1, property: "data" };

    var open_rq = createdb(t);
    open_rq.onupgradeneeded = function(e) {
        db = e.target.result;

        var objStore = db.createObjectStore("test", { keyPath: "key" });
        objStore.add(record);
    };

    open_rq.onsuccess = function(e) {
        var delete_rq = db.transaction("test", "readwrite")
                          .objectStore("test")
                          .delete(record.key);

        delete_rq.onsuccess = t.step_func(function(e) {
            assert_equals(e.target.result, undefined);

            e.target.transaction.oncomplete = t.step_func(VerifyRecordRemoved);
        });
    };

    function VerifyRecordRemoved() {
        var rq = db.transaction("test")
                   .objectStore("test")
                   .get(record.key);

        rq.onsuccess = t.step_func(function(e) {
            assert_equals(e.target.result, undefined);
            t.done();
        });
    }
