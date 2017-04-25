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
    setup,
    test,
} = require("../support-node");

const document = {};
const window = global;


    var db,
        t = async_test();

    var open_rq = createdb(t);
    open_rq.onupgradeneeded = function (event) {
        db = event.target.result;
        db.createObjectStore("store");
    }

    open_rq.onsuccess = function (event) {
        var txn = db.transaction("store", "readwrite");
        var ostore = txn.objectStore("store");
        t.step(function(){
            assert_throws("InvalidStateError", function(){
                ostore.createIndex("index", "indexedProperty");
            });
        });
        t.done();
    }
