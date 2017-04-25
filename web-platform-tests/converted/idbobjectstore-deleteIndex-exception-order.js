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



indexeddb_test(
  (t, db) => {
    const store = db.createObjectStore('s');
    store.createIndex('i', 'keyPath');
  },
  (t, db) => {
    const tx = db.transaction('s');
    const store = tx.objectStore('s');

    setTimeout(t.step_func(() => {
      assert_throws(
        'InvalidStateError', () => { store.deleteIndex('i'); },
        '"running an upgrade transaction" check (InvalidStateError) ' +
        'should precede "not active" check (TransactionInactiveError)');
      t.done();
    }), 0);
  },
  'IDBObjectStore.deleteIndex exception order: ' +
  'InvalidStateError #1 vs. TransactionInactiveError'
);

indexeddb_test(
  (t, db) => {
    const store = db.createObjectStore('s');
    const index = store.createIndex('i', 'keyPath');

    db.deleteObjectStore('s');

    setTimeout(t.step_func(() => {
      assert_throws(
        'InvalidStateError', () => { store.deleteIndex('i'); },
        '"deleted" check (InvalidStateError) ' +
        'should precede "not active" check (TransactionInactiveError)');
      t.done();
    }), 0);
  },
  (t, db) => {},
  'IDBObjectStore.deleteIndex exception order: ' +
  'InvalidStateError #2 vs. TransactionInactiveError'
);

indexeddb_test(
  (t, db) => {
    const store = db.createObjectStore('s');

    setTimeout(t.step_func(() => {
      assert_throws(
        'TransactionInactiveError', () => { store.deleteIndex('nope'); },
        '"not active" check (TransactionInactiveError) should precede ' +
        '"name in store" check (NotFoundError)');
      t.done();
    }), 0);
  },
  (t, db) => {},
  'IDBObjectStore.deleteIndex exception order: ' +
  'TransactionInactiveError vs. NotFoundError'
);

