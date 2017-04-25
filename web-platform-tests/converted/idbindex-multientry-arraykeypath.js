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


    createdb(async_test(document.title, {timeout: 10000})).onupgradeneeded = function(e) {
        var store = e.target.result.createObjectStore("store");

        assert_throws('InvalidAccessError', function() {
            store.createIndex('actors', ['name'], { multiEntry: true })
        });

        this.done();
    };
