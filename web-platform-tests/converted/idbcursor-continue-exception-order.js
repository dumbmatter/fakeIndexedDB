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
    const s = db.createObjectStore('s');
    s.put('value', 'key');
  },
  (t, db) => {
    const s = db.transaction('s', 'readonly').objectStore('s');
    const r = s.openKeyCursor();
    r.onsuccess = t.step_func(() => {
      r.onsuccess = null;
      const cursor = r.result;
      setTimeout(t.step_func(() => {
        assert_throws('TransactionInactiveError', () => {
          cursor.continue({not: "a valid key"});
        }, '"Transaction inactive" check (TransactionInactiveError) ' +
           'should precede "invalid key" check (DataError)');
        t.done();
      }), 0);
    });
  },
  'IDBCursor.continue exception order: TransactionInactiveError vs. DataError'
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
      cursor.continue();
      r.onsuccess = t.step_func(() => {
        setTimeout(t.step_func(() => {
          assert_throws('TransactionInactiveError', () => {
            cursor.continue();
          }, '"Transaction inactive" check (TransactionInactiveError) ' +
             'should precede "got value flag" check (InvalidStateError)');
          t.done();
        }), 0);
      });
    });
  },
  'IDBCursor.continue exception order: TransactionInactiveError vs. InvalidStateError'
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
      cursor.continue();
      assert_throws('InvalidStateError', () => {
        cursor.continue({not: "a valid key"});
      }, '"got value flag" check (InvalidStateError) should precede ' +
         '"invalid key" check (DataError)');
      t.done();
    });
  },
  'IDBCursor.continue exception order: InvalidStateError vs. DataError'
);

