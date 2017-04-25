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


    function invalid_optionalParameters(desc, params, exception = "InvalidAccessError") {
        var t = async_test(document.title + " - " + desc);

        createdb(t).onupgradeneeded = function(e) {
            assert_throws(exception, function() {
                e.target.result.createObjectStore("store", params);
            });

            this.done();
        };
    }

    invalid_optionalParameters("autoInc and empty keyPath", {autoIncrement: true, keyPath: ""});
    invalid_optionalParameters("autoInc and keyPath array", {autoIncrement: true, keyPath: []}, "SyntaxError");
    invalid_optionalParameters("autoInc and keyPath array 2", {autoIncrement: true, keyPath: ["hey"]});
    invalid_optionalParameters("autoInc and keyPath object", {autoIncrement: true, keyPath: {a:"hey", b:2}}, "SyntaxError");

