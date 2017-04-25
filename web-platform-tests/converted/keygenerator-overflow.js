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



    var db,
      t = async_test(document.title, {timeout: 10000}),
      overflow_error_fired = false,
      objects =  [9007199254740991, null, "error", 2, "error" ],
      expected_keys = [2, 9007199254740991, 9007199254740992];

    var open_rq = createdb(t);
    open_rq.onupgradeneeded = function(e) {
        db = e.target.result;
        var objStore = db.createObjectStore("store", { keyPath: "id", autoIncrement: true });

        for (var i = 0; i < objects.length; i++)
        {
            if (objects[i] === null)
            {
                objStore.add({});
            }
            else if (objects[i] === "error")
            {
                var rq = objStore.add({});
                rq.onsuccess = fail(t, 'When "current number" overflows, error event is expected');
                rq.onerror = t.step_func(function(e) {
                    overflow_error_fired = true;
                    assert_equals(e.target.error.name, "ConstraintError", "error name");
                    e.preventDefault();
                    e.stopPropagation();
                });
            }
            else
                objStore.add({ id: objects[i] });
        }
    };

    open_rq.onsuccess = function(e) {
        var actual_keys = [],
          rq = db.transaction("store")
                 .objectStore("store")
                 .openCursor();

        rq.onsuccess = t.step_func(function(e) {
            var cursor = e.target.result;

            if (cursor) {
                actual_keys.push(cursor.key.valueOf());
                cursor.continue();
            }
            else {
                assert_true(overflow_error_fired, "error fired on 'current number' overflow");
                assert_array_equals(actual_keys, expected_keys, "keygenerator array");

                t.done();
            }
        });
    };

