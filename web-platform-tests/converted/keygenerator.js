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


    function keygenerator(objects, expected_keys, desc, func) {
        var db,
          t = async_test(document.title + " - " + desc);

        var open_rq = createdb(t);
        open_rq.onupgradeneeded = function(e) {
            db = e.target.result;
            var objStore = db.createObjectStore("store", { keyPath: "id", autoIncrement: true });

            for (var i = 0; i < objects.length; i++)
            {
                if (objects[i] === null)
                    objStore.add({});
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
                    assert_key_equals(actual_keys, expected_keys, "keygenerator array");
                    t.done();
                }
            });
        };
    }


    keygenerator([null, null, null, null],  [1, 2, 3, 4],
        "starts at one, and increments by one");

    keygenerator([2, null, 5, null, 6.66, 7],  [2, 3, 5, 6, 6.66, 7],
        "increments by one from last set key");

    keygenerator([-10, null, "6", 6.3, [10], -2, 4, null],   [-10, -2, 1, 4, 6.3, 7, "6", [10]],
        "don't increment when new key is not bigger than current");

