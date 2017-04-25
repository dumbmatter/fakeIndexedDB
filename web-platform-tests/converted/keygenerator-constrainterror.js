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
    setup,
    test,
} = require("../support-node");

const document = {};
const window = global;



    var db,
      t = async_test(document.title, {timeout: 10000}),
      objects = [1, null, {id: 2}, null, 2.00001, 5, null, {id: 6} ],
      expected = [1, 2, 2.00001, 3, 5, 6],
      errors = 0;

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
            else if (typeof objects[i] === "object")
            {
                var rq = objStore.add(objects[i])
                rq.yeh = objects[i];
                rq.onerror = t.step_func(function(e) {
                    errors++;

                    assert_equals(e.target.error.name, "ConstraintError");
                    assert_equals(e.type, "error");

                    e.stopPropagation();
                    e.preventDefault();
                });
                rq.onsuccess = t.step_func(function(e) {
                    assert_unreached("Got rq.success when adding duplicate id " + objects[i]);
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
                assert_equals(errors, 2, "expected ConstraintError's");
                assert_array_equals(actual_keys, expected, "keygenerator array");
                t.done();
            }
        });
    };

