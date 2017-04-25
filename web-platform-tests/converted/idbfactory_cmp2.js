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
