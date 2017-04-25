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


    var db

    createdb(async_test()).onupgradeneeded = function(e) {
        db = e.target.result

        var store = db.createObjectStore("store", { keyPath: "k" })

        for (var i = 0; i < 5; i++)
            store.add({ k: "key_" + i });

        store.count("key_2").onsuccess = this.step_func(function(e) {
            assert_equals(e.target.result, 1, "count(key_2)")

            store.count("key_").onsuccess = this.step_func(function(e) {
                assert_equals(e.target.result, 0, "count(key_)")
                this.done()
            })
        })
    }

