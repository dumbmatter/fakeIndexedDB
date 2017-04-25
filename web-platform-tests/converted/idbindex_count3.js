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


    var db

    createdb(async_test()).onupgradeneeded = function(e) {
        db = e.target.result

        var store = db.createObjectStore("store", { autoIncrement: true })
        store.createIndex("myindex", "idx")

        for (var i = 0; i < 10; i++)
            store.add({ idx: "data_" + (i%2) });

        store.index("myindex").count("data_0").onsuccess = this.step_func(function(e) {
            assert_equals(e.target.result, 5, "count(data_0)")
            this.done()
        })
    }

