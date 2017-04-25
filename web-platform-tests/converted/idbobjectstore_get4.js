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


    var db,
      t = async_test();

    var open_rq = createdb(t);
    open_rq.onupgradeneeded = function(e) {
        db = e.target.result;
        var rq = db.createObjectStore("store", { keyPath: "key" })
                   .get(1);
        rq.onsuccess = t.step_func(function(e) {
            assert_equals(e.target.results, undefined);
            step_timeout(function() { t.done(); }, 10);
        });
    };

    open_rq.onsuccess = function() {};
