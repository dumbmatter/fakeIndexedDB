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


    test( function() {
        assert_throws(new TypeError(), function() {
            indexedDB.cmp();
        });
    }, "IDBFactory.cmp() - no argument");

    test( function() {
        assert_throws("DataError", function() {
            indexedDB.cmp(null, null);
        });
        assert_throws("DataError", function() {
            indexedDB.cmp(1, null);
        });
        assert_throws("DataError", function() {
            indexedDB.cmp(null, 1);
        });
    }, "IDBFactory.cmp() - null");

    test( function() {
        assert_throws("DataError", function() {
            indexedDB.cmp(NaN, NaN);
        });
        assert_throws("DataError", function() {
            indexedDB.cmp(1, NaN);
        });
        assert_throws("DataError", function() {
            indexedDB.cmp(NaN, 1);
        });
    }, "IDBFactory.cmp() - NaN");
