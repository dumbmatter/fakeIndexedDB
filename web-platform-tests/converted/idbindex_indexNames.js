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
      t = async_test(document.title, {timeout: 10000});

    var open_rq = createdb(t);
    open_rq.onupgradeneeded = function(e) {
        db = e.target.result;
        var objStore = db.createObjectStore("test", { keyPath: "key" });
        objStore.createIndex("index", "data");

        assert_equals(objStore.indexNames[0], "index", "indexNames");
        assert_equals(objStore.indexNames.length, 1, "indexNames.length");
    };

    open_rq.onsuccess = function(e) {
        var objStore = db.transaction("test")
                   .objectStore("test");

        assert_equals(objStore.indexNames[0], "index", "indexNames (second)");
        assert_equals(objStore.indexNames.length, 1, "indexNames.length (second)");

        t.done();
    };
