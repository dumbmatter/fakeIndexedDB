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


    var db, store,
      t = async_test(document.title, {timeout: 10000}),
      open_rq = createdb(t),
      stages = [];

    open_rq.onupgradeneeded = function(e) {
        stages.push("upgradeneeded");

        db = e.target.result;
        store = db.createObjectStore('store');

        e.target.transaction.oncomplete = function() {
            stages.push("complete");
        };
    };

    open_rq.onsuccess = function(e) {
        stages.push("success");

        // Making a totally new transaction to check
        db.transaction('store').objectStore('store').count().onsuccess = t.step_func(function(e) {
            assert_array_equals(stages, [ "upgradeneeded",
                                          "complete",
                                          "success" ]);
            t.done();
        });
        // XXX: Make one with real transactions, not only open() versionchange one

        /*db.transaction.objectStore('store').openCursor().onsuccess = function(e) {
            stages.push("opencursor1");
        }

        store.openCursor().onsuccess = function(e) {
            stages.push("opencursor2");
        }

        e.target.transaction.objectStore('store').openCursor().onsuccess = function(e) {
            stages.push("opencursor3");
        }
        */
    }

