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


    var db

    var open_rq = createdb(async_test())
    open_rq.onupgradeneeded = function(e) {
        db = e.target.result
        var store = db.createObjectStore("")

        for (var i = 0; i < 5; i++)
            store.add("object_" + i, i)

        assert_equals(db.objectStoreNames[0], "", "db.objectStoreNames[0]")
        assert_equals(db.objectStoreNames.length, 1, "objectStoreNames.length")
    }

    open_rq.onsuccess = function() {
        var store = db.transaction("").objectStore("")

        store.get(2).onsuccess = this.step_func(function(e) {
            assert_equals(e.target.result, "object_2")
        })

        assert_equals(db.objectStoreNames[0], "", "db.objectStoreNames[0]")
        assert_equals(db.objectStoreNames.length, 1, "objectStoreNames.length")

        this.done()
    }
