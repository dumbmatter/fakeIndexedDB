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


    test(function() {
        var greater = window.indexedDB.cmp(2, 1);
        var equal = window.indexedDB.cmp(2, 2);
        var less = window.indexedDB.cmp(1, 2);

        assert_equals(greater, 1, "greater");
        assert_equals(equal, 0, "equal");
        assert_equals(less, -1, "less");
    }, "IDBFactory.cmp()");
