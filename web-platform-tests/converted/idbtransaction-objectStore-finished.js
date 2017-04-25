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



indexeddb_test(
  (t, db) => {
    db.createObjectStore('store');
  },
  (t, db) => {
    const tx = db.transaction('store');
    tx.abort();
    assert_throws('InvalidStateError', () => tx.objectStore('store'),
                  'objectStore() should throw if transaction is finished');
    t.done();
  },
  'IDBTransaction objectStore() behavior when transaction is finished'
);

