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
    t = async_test(document.title, {timeout: 600000}),
    open_rq = createdb(t)

open_rq.onupgradeneeded = function(e) {
    db = e.target.result
    var st, i;
    for (i = 0; i < 1000; i++)
    {
        st = db.createObjectStore("object_store_" + i)
        st.add("test", 1);
    }

    st.get(1).onsuccess = t.step_func(function(e) {
        assert_equals(e.target.result, "test")
    })
}
open_rq.onsuccess = function(e) {
    db.close()
    window.indexedDB.deleteDatabase(db.name).onsuccess = function(e) {
        t.done()
    }
}
