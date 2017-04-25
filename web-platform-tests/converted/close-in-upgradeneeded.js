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



var db
var open_rq = createdb(async_test())
var sawTransactionComplete = false

open_rq.onupgradeneeded = function(e) {
    db = e.target.result
    assert_equals(db.version, 1)

    db.createObjectStore('os')
    db.close()

    e.target.transaction.oncomplete = function() { sawTransactionComplete = true }
}

open_rq.onerror = function(e) {
    assert_true(sawTransactionComplete, "saw transaction.complete")

    assert_equals(e.target.error.name, 'AbortError')
    assert_equals(e.result, undefined)

    assert_true(!!db)
    assert_equals(db.version, 1)
    assert_equals(db.objectStoreNames.length, 1)
    assert_throws("InvalidStateError", function() { db.transaction('os') })

    this.done()
}

