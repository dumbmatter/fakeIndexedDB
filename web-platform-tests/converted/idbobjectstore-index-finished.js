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



indexeddb_test(
  (t, db) => {
    const store = db.createObjectStore('store');
    store.createIndex('index', 'key_path');
  },
  (t, db) => {
    const tx = db.transaction('store');
    const store = tx.objectStore('store');
    tx.abort();
    assert_throws('InvalidStateError', () => store.index('index'),
                  'index() should throw if transaction is finished');
    t.done();
  },
  'IDBObjectStore index() behavior when transaction is finished'
);

