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
  (t, db, txn) => {
    db.createObjectStore('s');

    txn.onabort = () => {
      setTimeout(t.step_func(() => {
        assert_throws(
          'InvalidStateError', () => { db.createObjectStore('s2'); },
          '"running an upgrade transaction" check (InvalidStateError) ' +
          'should precede "not active" check (TransactionInactiveError)');

        t.done();
      }), 0);
    };
    txn.abort();
  },
  (t, db) => { t.assert_unreached('open should fail'); },
  'IDBDatabase.createObjectStore exception order: ' +
  'InvalidStateError vs. TransactionInactiveError',
  { upgrade_will_abort: true }
);

indexeddb_test(
  (t, db, txn) => {
    const store = db.createObjectStore('s');

    txn.abort();

    assert_throws(
      'TransactionInactiveError',
      () => { db.createObjectStore('s2', {keyPath: '-invalid-'}); },
      '"not active" check (TransactionInactiveError) should precede ' +
      '"valid key path" check (SyntaxError)');

    t.done();
  },
  (t, db) => { t.assert_unreached('open should fail'); },
  'IDBDatabase.createObjectStore exception order: ' +
  'TransactionInactiveError vs. SyntaxError',
  { upgrade_will_abort: true }
);

indexeddb_test(
  (t, db) => {
    db.createObjectStore('s');
    assert_throws('SyntaxError', () => {
      db.createObjectStore('s', {keyPath: 'not a valid key path'});
    }, '"Invalid key path" check (SyntaxError) should precede ' +
       '"duplicate store name" check (ConstraintError)');
    t.done();
  },
  (t, db) => {},
  'IDBDatabase.createObjectStore exception order: ' +
  'SyntaxError vs. ConstraintError'
);

indexeddb_test(
  (t, db) => {
    db.createObjectStore('s');
    assert_throws('ConstraintError', () => {
      db.createObjectStore('s', {autoIncrement: true, keyPath: ''});
    }, '"already exists" check (ConstraintError) should precede ' +
       '"autoIncrement vs. keyPath" check (InvalidAccessError)');
    t.done();
  },
  (t, db) => {},
  'IDBDatabase.createObjectStore exception order: ' +
  'ConstraintError vs. InvalidAccessError'
);

