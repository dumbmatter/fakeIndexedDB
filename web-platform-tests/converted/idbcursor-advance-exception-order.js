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
    store.put('value', 'key');
  },
  (t, db) => {
    const tx = db.transaction('s');
    const store = tx.objectStore('s');

    const r = store.openKeyCursor();
    r.onsuccess = t.step_func(() => {
      r.onsuccess = null;

      const cursor = r.result;

      setTimeout(t.step_func(() => {
        assert_throws(new TypeError, () => { cursor.advance(0); },
                      '"zero" check (TypeError) should precede ' +
                      '"not active" check (TransactionInactiveError)');
        t.done();
      }), 0);
    });
  },
  'IDBCursor.advance exception order: TypeError vs. TransactionInactiveError'
);

indexeddb_test(
  (t, db) => {
    const store = db.createObjectStore('s');

    const s = db.createObjectStore('s2');
    s.put('value', 'key');

    const r = s.openKeyCursor();
    r.onsuccess = t.step_func(() => {
      r.onsuccess = null;

      const cursor = r.result;
      db.deleteObjectStore('s2');

      setTimeout(t.step_func(() => {
        assert_throws('TransactionInactiveError', () => { cursor.advance(1); },
                      '"not active" check (TransactionInactiveError) ' +
                      'should precede "deleted" check (InvalidStateError)');
        t.done();
      }), 0);
    });
  },
  (t, db) => {},
  'IDBCursor.advance exception order: ' +
  'TransactionInactiveError vs. InvalidStateError #1'
);

indexeddb_test(
  (t, db) => {
    const store = db.createObjectStore('s');
    store.put('value', 'key');
  },
  (t, db) => {
    const tx = db.transaction('s');
    const store = tx.objectStore('s');

    const r = store.openKeyCursor();
    r.onsuccess = t.step_func(() => {
      r.onsuccess = null;

      const cursor = r.result;
      cursor.advance(1);

      setTimeout(t.step_func(() => {
        assert_throws('TransactionInactiveError', () => { cursor.advance(1); },
                      '"not active" check (TransactionInactiveError) ' +
                      'should precede "got value" check (InvalidStateError)');
        t.done();
      }), 0);
    });
  },
  'IDBCursor.advance exception order: ' +
  'TransactionInactiveError vs. InvalidStateError #2'
);

