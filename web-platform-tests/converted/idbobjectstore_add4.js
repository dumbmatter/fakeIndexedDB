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
      record = { key: 1, property: "data" };

    var open_rq = createdb(t);
    open_rq.onupgradeneeded = function(e) {
        db = e.target.result;
        var objStore = db.createObjectStore("store", { autoIncrement: true });
        objStore.createIndex("i1", "property", { unique: true });
        objStore.add(record);

        var rq = objStore.add(record);
        rq.onsuccess = fail(t, "success on adding duplicate indexed record")

        rq.onerror = t.step_func(function(e) {
            assert_equals(rq.error.name, "ConstraintError");
            assert_equals(e.target.error.name, "ConstraintError");
            assert_equals(e.type, "error");

            e.preventDefault();
            e.stopPropagation();
        });
    };

    // Defer done, giving a spurious rq.onsuccess a chance to run
    open_rq.onsuccess = function(e) {
        t.done();
    }
