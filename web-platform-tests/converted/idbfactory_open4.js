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
    indexeddb_test,
    setup,
    test,
} = require("../support-node.js");

const document = {};
const window = global;


    var open_rq = createdb(async_test(), 'database_name');

    open_rq.onupgradeneeded = function(e) {
        assert_equals(e.target.result.version, 1, "db.version");
    };
    open_rq.onsuccess = function(e) {
        assert_equals(e.target.result.version, 1, "db.version");
        this.done();
    };
