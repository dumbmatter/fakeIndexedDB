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
        t = async_test(document.title, {timeout: 10000});

    t.step(function() {
        var openrq = indexedDB.open('db', 3);

        openrq.onupgradeneeded = t.step_func(function(e) {
            assert_equals(e.oldVersion, 0, "old version (upgradeneeded)");
            assert_equals(e.newVersion, 3, "new version (upgradeneeded)");
            assert_true(e instanceof IDBVersionChangeEvent, "upgradeneeded instanceof IDBVersionChangeEvent");
        });

        openrq.onsuccess = t.step_func(function(e) {
            db = e.target.result;

            db.onversionchange = t.step_func(function(e) {
                assert_equals(e.oldVersion, 3, "old version (versionchange)");
                assert_equals(e.newVersion, null, "new version (versionchange)");
                assert_true(e instanceof IDBVersionChangeEvent, "versionchange instanceof IDBVersionChangeEvent");
                db.close();
            });

            // Errors
            db.onerror = fail(t, "db.error");
            db.onabort = fail(t, "db.abort");

            setTimeout(t.step_func(deleteDB), 10);
        });

        // Errors
        openrq.onerror = fail(t, "open.error");
        openrq.onblocked = fail(t, "open.blocked");

    });

    function deleteDB (e) {
        var deleterq = indexedDB.deleteDatabase('db');

        deleterq.onsuccess = t.step_func(function(e) {
            assert_equals(e.result, undefined, "result (delete.success for nonexistent db)");
            assert_equals(e.oldVersion, 3, "old version (delete.success)");
            assert_equals(e.newVersion, null, "new version (delete.success)");
            assert_true(e instanceof IDBVersionChangeEvent, "delete.success instanceof IDBVersionChangeEvent");

            setTimeout(deleteNonExistentDB, 10);
        });

        // Errors
        deleterq.onerror = fail(t, "delete.error");
        deleterq.onblocked = fail(t, "delete.blocked");
    }

    function deleteNonExistentDB (e) {
        var deleterq = indexedDB.deleteDatabase('db-does-not-exist');

        deleterq.onsuccess = t.step_func(function(e) {
            assert_equals(e.result, undefined, "result (delete.success for nonexistent db)");
            assert_equals(e.oldVersion, 0, "old version (delete.success for nonexistent db)");
            assert_equals(e.newVersion, null, "new version (delete.success for nonexistent db)");
            assert_true(e instanceof IDBVersionChangeEvent, "delete.success instanceof IDBVersionChangeEvent");

            setTimeout(function() { t.done(); }, 10);
        });

        // Errors
        deleterq.onerror = fail(t, "delete.error");
        deleterq.onblocked = fail(t, "delete.blocked");
    }

