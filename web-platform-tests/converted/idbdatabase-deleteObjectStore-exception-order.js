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
    promise_test,
    setup,
    step_timeout,
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
          'InvalidStateError', () => { db.deleteObjectStore('s'); },
          '"running an upgrade transaction" check (InvalidStateError) ' +
          'should precede "not active" check (TransactionInactiveError)');
        t.done();
      }), 0);
    };
    txn.abort();
  },
  (t, db) => { t.assert_unreached('open should fail'); },
  'IDBDatabase.deleteObjectStore exception order: ' +
  'InvalidStateError vs. TransactionInactiveError',
  { upgrade_will_abort: true }
);

indexeddb_test(
  (t, db, txn) => {
    txn.abort();
    assert_throws(
      'TransactionInactiveError', () => { db.deleteObjectStore('nope'); },
      '"not active" check (TransactionInactiveError) should precede ' +
      '"name in database" check (NotFoundError)');
    t.done();
  },
  (t, db) => { t.assert_unreached('open should fail'); },
  'IDBDatabase.deleteObjectStore exception order: ' +
  'TransactionInactiveError vs. NotFoundError',
  { upgrade_will_abort: true }
);

