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



var t = async_test(),
    open_rq = createdb(t)

open_rq.onupgradeneeded = function(e) {
    var db = e.target.result
    var objStore = db.createObjectStore('instancetest')

    assert_true(objStore instanceof IDBObjectStore, 'instanceof IDBObjectStore')
}

open_rq.onsuccess = function(e) {
    var db = e.target.result
    var objStore = db.transaction('instancetest').objectStore('instancetest')

    assert_true(objStore instanceof IDBObjectStore, 'instanceof IDBObjectStore')
    t.done()
}
