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
        t_add = async_test("Adding one item with 1000 multiEntry keys", { timeout: 10000 }),
        t_get = async_test("Getting the one item by 1000 indeced keys ", { timeout: 10000 });

    var open_rq = createdb(t_add);
    var obj = { test: 'yo', idxkeys: [] };

    for (var i = 0; i < 1000; i++)
        obj.idxkeys.push('index_no_' + i);


    open_rq.onupgradeneeded = function(e) {
        db = e.target.result;

        db.createObjectStore('store')
          .createIndex('index', 'idxkeys', { multiEntry: true });
    };
    open_rq.onsuccess = function(e) {
        var tx = db.transaction('store', 'readwrite');
        tx.objectStore('store')
          .put(obj, 1)
          .onsuccess = t_add.step_func(function(e)
        {
            assert_equals(e.target.result, 1, "put'd key");
            this.done();
        });

        tx.oncomplete = t_get.step_func(function() {
            var idx = db.transaction('store').objectStore('store').index('index')

            for (var i = 0; i < 1000; i++)
            {
                idx.get('index_no_' + i).onsuccess = t_get.step_func(function(e) {
                    assert_equals(e.target.result.test, "yo");
                });
            }

            idx.get('index_no_999').onsuccess = t_get.step_func(function(e) {
                assert_equals(e.target.result.test, "yo");
                assert_equals(e.target.result.idxkeys.length, 1000);
                this.done();
            });
        });
    };
