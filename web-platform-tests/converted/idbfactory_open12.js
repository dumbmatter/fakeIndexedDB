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


    var db;
    var open_rq = createdb(async_test(document.title, {timeout: 10000}), undefined, 9);
    var open2_t = async_test(document.title + " - second upgrade");

    open_rq.onupgradeneeded = function(e) {
        db = e.target.result;

        assert_true(e instanceof IDBVersionChangeEvent, "e instanceof IDBVersionChangeEvent");
        assert_equals(e.oldVersion, 0, "oldVersion");
        assert_equals(e.newVersion, 9, "newVersion");
        assert_equals(e.type, "upgradeneeded", "event type");

        assert_equals(db.version, 9, "db.version");
    };
    open_rq.onsuccess = function(e) {
        assert_true(e instanceof Event, "e instanceof Event");
        assert_false(e instanceof IDBVersionChangeEvent, "e not instanceof IDBVersionChangeEvent");
        assert_equals(e.type, "success", "event type");
        this.done();


        /**
         * Second test
         */
        db.onversionchange = function() { db.close(); };

        var open_rq2 = createdb(open2_t, db.name, 10);
        open_rq2.onupgradeneeded = function(e) {
            var db2 = e.target.result;
            assert_true(e instanceof IDBVersionChangeEvent, "e instanceof IDBVersionChangeEvent");
            assert_equals(e.oldVersion, 9, "oldVersion");
            assert_equals(e.newVersion, 10, "newVersion");
            assert_equals(e.type, "upgradeneeded", "event type");

            assert_equals(db2.version, 10, "new db.version");

            this.done();
        };
    };
