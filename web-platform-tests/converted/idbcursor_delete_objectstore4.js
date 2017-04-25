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
        t = async_test(),
        records = [{ pKey: "primaryKey_0"},
                   { pKey: "primaryKey_1"}];

    var open_rq = createdb(t);
    open_rq.onupgradeneeded = function (event) {
        db = event.target.result;
        var objStore = db.createObjectStore("store", {keyPath:"pKey"});
        for (var i = 0; i < records.length; i++) {
            objStore.add(records[i]);
        }
        var rq = objStore.openCursor();
        rq.onsuccess = t.step_func(function(event) {
            var cursor = event.target.result;
            assert_true(cursor instanceof IDBCursor, "cursor exist");

            db.deleteObjectStore("store");
            assert_throws("InvalidStateError", function() {
                cursor.delete();
            }, "If the cursor's source or effective object store has been deleted, the implementation MUST throw a DOMException of type InvalidStateError");

            t.done();
        });
    }

