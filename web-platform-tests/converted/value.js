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


function value(value, _instanceof) {
    var t = async_test(document.title + " - " + _instanceof.name);
    t.step(function() {
        assert_true(value instanceof _instanceof, "TEST ERROR, instanceof");
    });

    createdb(t).onupgradeneeded = function(e) {
        e.target.result
                .createObjectStore("store")
                .add(value, 1);

        e.target.onsuccess = t.step_func(function(e) {
            e.target.result
                    .transaction("store")
                    .objectStore("store")
                    .get(1)
                    .onsuccess = t.step_func(function(e)
            {
                assert_true(e.target.result instanceof _instanceof, "instanceof")
                t.done();
            });
        });
    };
}

value(new Date(), Date);
value(new Array(), Array);

