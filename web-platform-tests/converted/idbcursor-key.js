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



    function cursor_key(key)
    {
        var db,
          t = async_test(document.title + " - " + key);

        var open_rq = createdb(t);
        open_rq.onupgradeneeded = function(e) {
            db = e.target.result;
            var objStore = db.createObjectStore("test");

            objStore.add("data", key);
        };

        open_rq.onsuccess = t.step_func(function(e) {
            var cursor_rq = db.transaction("test")
                              .objectStore("test")
                              .openCursor();

            cursor_rq.onsuccess = t.step_func(function(e) {
                var cursor = e.target.result;
                assert_equals(cursor.value, "data", "prequisite cursor.value");

                assert_key_equals(cursor.key, key, 'key');
                assert_readonly(cursor, 'key');

                if (key instanceof Array) {
                    cursor.key.push("new");
                    key.push("new");

                    assert_key_equals(cursor.key, key, 'key after array push');

                    // But we can not change key (like readonly, just a bit different)
                    cursor.key = 10;
                    assert_key_equals(cursor.key, key, 'key after assignment');
                }

                t.done();
            });
        });
    }

    cursor_key(1);
    cursor_key("key");
    cursor_key(["my", "key"]);

