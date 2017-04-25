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


    var db, t = async_test();

    var open_rq = createdb(t);

    open_rq.onupgradeneeded = function(e) {
        db = e.target.result;
        var store = db.createObjectStore("store");

        for(var i = 0; i < 10; i++) {
            store.add({ data: "data" + i }, i);
        }
    }

    open_rq.onsuccess = function(e) {
        var rq = db.transaction("store")
                   .objectStore("store")
                   .count(IDBKeyRange.bound(5,20));

        rq.onsuccess = t.step_func(function(e) {
            assert_equals(e.target.result, 5);
            t.done();
        });
    }
