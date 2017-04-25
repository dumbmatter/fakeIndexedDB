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



['get',
 'getAll',
 'getAllKeys',
 'count',
 'openCursor',
 'openKeyCursor'
].forEach(method => {

  indexeddb_test(
    (t, db) => {
      const store = db.createObjectStore('s');
      const store2 = db.createObjectStore('s2');

      db.deleteObjectStore('s2');

      setTimeout(t.step_func(() => {
        assert_throws(
          'InvalidStateError', () => { store2[method]('key'); },
          '"has been deleted" check (InvalidStateError) should precede ' +
          '"not active" check (TransactionInactiveError)');

        t.done();
      }), 0);
    },
    (t, db) => {},
    `IDBObjectStore.${method} exception order: ` +
    'InvalidStateError vs. TransactionInactiveError'
  );

  indexeddb_test(
    (t, db) => {
      const store = db.createObjectStore('s');
    },
    (t, db) => {
      const tx = db.transaction('s');
      const store = tx.objectStore('s');

      setTimeout(t.step_func(() => {
        assert_throws(
          'TransactionInactiveError', () => { store[method]({}); },
          '"not active" check (TransactionInactiveError) should precede ' +
          'query check (DataError)');
        t.done();
      }), 0);
    },
    `IDBObjectStore.${method} exception order: ` +
    'TransactionInactiveError vs. DataError'
  );
});

