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



    var db,
      t = async_test(document.title, {timeout: 10000});

    var open_rq = createdb(t);
    open_rq.onupgradeneeded = function(e) {
        db = e.target.result;
        var objStore = db.createObjectStore("test");

        objStore.createIndex("index", "");

        objStore.add("data",  1);
        objStore.add("data2", 2);
    };

    open_rq.onsuccess = function(e) {
        var count = 0;
        var cursor_rq = db.transaction("test")
                          .objectStore("test")
                          .index("index")
                          .openCursor();

        cursor_rq.onsuccess = t.step_func(function(e) {
            if (!e.target.result) {
                assert_equals(count, 2, 'count');
                t.done();
                return;
            }
            var cursor = e.target.result;

            cursor.continue(undefined);

            // Second try
            assert_throws('InvalidStateError',
                function() { cursor.continue(); }, 'second continue');

            assert_throws('InvalidStateError',
                function() { cursor.continue(3); }, 'third continue');

            count++;
        });
    };

