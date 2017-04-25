require("../../build/global");
const Event = require("../../build/lib/FakeEvent").default;
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
    format_value,
    indexeddb_test,
    setup,
    test,
} = require("../support-node");

const document = {};
const window = global;


    var open_rq = createdb(async_test(), undefined, 13);
    var did_upgrade = false;

    open_rq.onupgradeneeded = function() {};
    open_rq.onsuccess = function(e) {
        var db = e.target.result;
        db.close();

        var open_rq2 = window.indexedDB.open(db.name, 14);
        open_rq2.onupgradeneeded = function() {
            did_upgrade = true;
        };
        open_rq2.onsuccess = this.step_func(open_current_db);
        open_rq2.onerror = fail(this, 'Unexpected error')
    }

    function open_current_db(e) {
        var open_rq3 = window.indexedDB.open(e.target.result.name);
        open_rq3.onsuccess = this.step_func(function(e) {
            assert_equals(e.target.result.version, 14, "db.version")
            this.done();
        });
        open_rq3.onupgradeneeded = fail(this, 'Unexpected upgradeneeded')
        open_rq3.onerror = fail(this, 'Unexpected error')

        assert_true(did_upgrade, 'did upgrade');
    }
