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



    function cursor_direction(constant, dir)
    {
        var db,
          t = async_test(document.title + " - " + dir),
          expected = dir ? dir : "next";

        var open_rq = createdb(t);

        open_rq.onupgradeneeded = function(e) {
            db = e.target.result;
            t.add_cleanup(function() {
                db.close();
                indexedDB.deleteDatabase(db.name);
            });

            var objStore = db.createObjectStore("test");

            objStore.add("data", "key");
        };

        open_rq.onsuccess = t.step_func(function(e) {
            var cursor_rq, count = 0;
            var os = db.transaction("test")
                       .objectStore("test");
            if (dir)
                cursor_rq = os.openCursor(undefined, dir);
            else
                cursor_rq = os.openCursor();

            cursor_rq.onsuccess = t.step_func(function(e) {
                var cursor = e.target.result;

                assert_equals(cursor.direction, constant, 'direction constant');
                assert_equals(cursor.direction, expected, 'direction');
                assert_readonly(cursor, 'direction');

                count++;
                if (count >= 2)
                    t.done();
            });

            var cursor_rq2 = db.transaction("test")
                              .objectStore("test")
                              .openCursor(undefined, constant);

            cursor_rq2.onsuccess = t.step_func(function(e) {
                var cursor = e.target.result;

                assert_equals(cursor.direction, constant, 'direction constant (second try)');
                assert_equals(cursor.direction, expected, 'direction (second try)');
                assert_readonly(cursor, 'direction');

                count++;
                if (count >= 2)
                    t.done();
            });

        });
    }

    cursor_direction("next");
    cursor_direction("next",       "next");
    cursor_direction("prev",       "prev");
    cursor_direction("nextunique", "nextunique");
    cursor_direction("prevunique", "prevunique");

