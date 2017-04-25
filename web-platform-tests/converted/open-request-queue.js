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



async_test(t => {
    let db_name = 'db' + self.location.pathname + '-' + t.name;
    indexedDB.deleteDatabase(db_name);

    // Open and hold connection while other requests are queued up.
    let r = indexedDB.open(db_name, 1);
    r.onerror = t.unreached_func('open should succeed');
    r.onsuccess = t.step_func(e => {
        let db = r.result;

        let saw = expect(t, [
            'open1 success',
            'open1 versionchange',
            'delete1 blocked',
            'delete1 success',
            'open2 success',
            'open2 versionchange',
            'delete2 blocked',
            'delete2 success'
        ]);

        function open(token, version) {
            let r = indexedDB.open(db_name, version);
            r.onsuccess = t.step_func(e => {
                saw(token + ' success');
                let db = r.result;
                db.onversionchange = t.step_func(e => {
                    saw(token + ' versionchange');
                    setTimeout(t.step_func(() => db.close()), 0);
                });
            });
            r.onblocked = t.step_func(e => saw(token + ' blocked'));
            r.onerror = t.unreached_func('open should succeed');
        }

        function deleteDatabase(token) {
            let r = indexedDB.deleteDatabase(db_name);
            r.onsuccess = t.step_func(e => saw(token + ' success'));
            r.onblocked = t.step_func(e => saw(token + ' blocked'));
            r.onerror = t.unreached_func('deleteDatabase should succeed');
        }

        open('open1', 2);
        deleteDatabase('delete1');
        open('open2', 3);
        deleteDatabase('delete2');

        // Now unblock the queue.
        db.close();
    });

}, 'Opens and deletes are processed in order');

