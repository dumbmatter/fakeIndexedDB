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



indexeddb_test(
    function(t, db) {
        db.createObjectStore('store');
    },
    function(t, db) {
        var tx = db.transaction('store', 'readwrite');
        var store = tx.objectStore('store');
        var r1 = store.add('value', 'key');
        r1.onerror = t.unreached_func('first add should succeed');

        var r2 = store.add('value', 'key');
        r2.onsuccess = t.unreached_func('second add should fail');

        r2.onerror = t.step_func(function() {
            assert_true(r2.error instanceof DOMException);
            assert_equals(r2.error.name, 'ConstraintError');
        });

        tx.oncomplete = t.unreached_func('transaction should not complete');
        tx.onabort = t.step_func(function() {
            assert_true(tx.error instanceof DOMException);
            assert_equals(tx.error.name, 'ConstraintError');
            t.done();
        });
    },
    'IDBRequest and IDBTransaction error properties should be DOMExceptions'
);

