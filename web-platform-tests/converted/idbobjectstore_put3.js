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


    var db, success_event,
      t = async_test(),
      record = { key: 1, property: "data" },
      record_put = { key: 1, property: "changed", more: ["stuff", 2] };

    var open_rq = createdb(t);
    open_rq.onupgradeneeded = function(e) {
        db = e.target.result;
        var objStore = db.createObjectStore("store", { keyPath: "key" });
        objStore.put(record);

        var rq = objStore.put(record_put);
        rq.onerror = fail(t, "error on put");

        rq.onsuccess = t.step_func(function(e) {
            success_event = true;
        });
    };

    open_rq.onsuccess = function(e) {
        assert_true(success_event);

        var rq = db.transaction("store")
                   .objectStore("store")
                   .get(1);

        rq.onsuccess = t.step_func(function(e) {
            var rec = e.target.result;

            assert_equals(rec.key, record_put.key);
            assert_equals(rec.property, record_put.property);
            assert_array_equals(rec.more, record_put.more);

            t.done();
        });
    };
