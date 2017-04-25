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


    var db, count = 0,
      t = async_test();
      t.add_cleanup(function() { indexedDB.deleteDatabase('webworker101'); });

    t.step(function() {
        var worker = new Worker("idbworker.js");
        worker.onmessage = t.step_func(function (e) {
            switch(count) {
                case 0:
                    assert_equals(e.data, true, 'worker has idb object')
                    break

                case 1:
                    assert_equals(e.data, "test", "get(1) in worker")
                    t.done()
            }

            count++
        });

        worker.postMessage(1);
    })
