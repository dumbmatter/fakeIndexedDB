require("../../build/global");
const Event = require("../../build/lib/FakeEvent").default;
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
} = require("../support-node");

const document = {};
const window = global;



indexeddb_test(
  (t, db) => {
    const s = db.createObjectStore('s');
    s.put('value', 'key');
  },
  (t, db) => {
    const s = db.transaction('s', 'readonly').objectStore('s');
    const r = s.openCursor();
    r.onsuccess = t.step_func(() => {
      r.onsuccess = null;
      const cursor = r.result;
      setTimeout(t.step_func(() => {
        assert_throws('TransactionInactiveError', () => {
          cursor.update('value2');
        }, '"Transaction inactive" check (TransactionInactiveError) ' +
           'should precede "read only" check (ReadOnlyError)');
        t.done();
      }), 0);
    });
  },
  'IDBCursor.update exception order: TransactionInactiveError vs. ReadOnlyError'
);

indexeddb_test(
  (t, db) => {
    const s = db.createObjectStore('s');
    s.put('value', 'key');
  },
  (t, db) => {
    const s = db.transaction('s', 'readonly').objectStore('s');
    const r = s.openCursor();
    r.onsuccess = t.step_func(() => {
      r.onsuccess = null;
      const cursor = r.result;
      cursor.continue();
      assert_throws('ReadOnlyError', () => {
        cursor.update('value2');
      }, '"Read only" check (ReadOnlyError) should precede '+
         '"got value flag" check (InvalidStateError)');
      t.done();
    });
  },
  'IDBCursor.update exception order: ReadOnlyError vs. InvalidStateError #1'
);

indexeddb_test(
  (t, db) => {
    const s = db.createObjectStore('s');
    s.put('value', 'key');
  },
  (t, db) => {
    const s = db.transaction('s', 'readonly').objectStore('s');
    const r = s.openKeyCursor();
    r.onsuccess = t.step_func(() => {
      r.onsuccess = null;
      const cursor = r.result;
      assert_throws('ReadOnlyError', () => {
        cursor.update('value2');
      }, '"Read only" check (ReadOnlyError) should precede '+
         '"key only flag" check (InvalidStateError)');
      t.done();
    });
  },
  'IDBCursor.update exception order: ReadOnlyError vs. InvalidStateError #2'
);

indexeddb_test(
  (t, db) => {
    const s = db.createObjectStore('s', {keyPath: 'id'});
    s.put({id: 123, data: 'value'});
  },
  (t, db) => {
    const s = db.transaction('s', 'readwrite').objectStore('s');
    const r = s.openCursor();
    r.onsuccess = t.step_func(() => {
      r.onsuccess = null;
      const cursor = r.result;
      cursor.continue();
      assert_throws('InvalidStateError', () => {
        cursor.update({id: 123, data: 'value2'});
      }, '"Got value flag" check (InvalidStateError) should precede ' +
         '"modified key" check (DataError)');
      t.done();
    });
  },
  'IDBCursor.update exception order: InvalidStateError vs. DataError'
);

