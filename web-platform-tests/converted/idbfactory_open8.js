require("../../build/global.js");
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
} = require("../support-node.js");

const document = {};
const window = global;


    var open_rq = createdb(async_test(), undefined, 13);
    var did_upgrade = false;
    var did_db_abort = false;

    open_rq.onupgradeneeded = function(e) {
        did_upgrade = true;
        e.target.result.onabort = function() {
            did_db_abort = true;
        }
        e.target.transaction.abort();
    };
    open_rq.onerror = function(e) {
        assert_true(did_upgrade);
        assert_equals(e.target.error.name, 'AbortError', 'target.error');
        this.done()
    };
