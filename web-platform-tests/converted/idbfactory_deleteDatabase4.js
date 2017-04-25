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



    var t = async_test("Delete an existing database");

    t.step(function() {
        var db;
        var openrq = indexedDB.open('db', 3);

        openrq.onupgradeneeded = function(e) {
            e.target.result.createObjectStore('store');
        };
        openrq.onsuccess = t.step_func(function(e) {
            db = e.target.result;

            // Errors
            db.onversionchange = fail(t, "db.versionchange");
            db.onerror = fail(t, "db.error");
            db.abort = fail(t, "db.abort");

            step_timeout(t.step_func(Second), 4);
            db.close();
        });

        // Errors
        openrq.onerror = fail(t, "open.error");
        openrq.onblocked = fail(t, "open.blocked");
    });

    function Second(e) {
        var deleterq = indexedDB.deleteDatabase('db');

        deleterq.onsuccess = function(e) { t.done(); }

        deleterq.onerror = fail(t, "delete.error");
        deleterq.onblocked = fail(t, "delete.blocked");
        deleterq.onupgradeneeded = fail(t, "delete.upgradeneeded");
    }

    async_test("Delete a nonexistent database").step(function(e) {
        var deleterq = indexedDB.deleteDatabase('nonexistent');

        deleterq.onsuccess = this.step_func(function(e) { this.done(); });

        deleterq.onerror = fail(this, "delete.error");
        deleterq.onblocked = fail(this, "delete.blocked");
        deleterq.onupgradeneeded = fail(this, "delete.upgradeneeded");
    });

