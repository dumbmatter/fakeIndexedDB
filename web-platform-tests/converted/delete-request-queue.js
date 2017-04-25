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



let saw;
indexeddb_test(
    (t, db) => {
        saw = expect(t, ['delete1', 'delete2']);
        let r = indexedDB.deleteDatabase(db.name);
        r.onerror = t.unreached_func('delete should succeed');
        r.onsuccess = t.step_func(e => saw('delete1'));
    },
    (t, db) => {
        let r = indexedDB.deleteDatabase(db.name);
        r.onerror = t.unreached_func('delete should succeed');
        r.onsuccess = t.step_func(e => saw('delete2'));

        db.close();
    },
    'Deletes are processed in order');

