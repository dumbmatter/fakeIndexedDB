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
  (t, db) => {
    const store = db.createObjectStore('s');
  },
  (t, db) => {
    const tx = db.transaction('s');
    tx.oncomplete = t.step_func(() => {
        assert_throws('InvalidStateError', () => { tx.objectStore('nope'); },
                      '"finished" check (InvalidStateError) should precede ' +
                      '"name in scope" check (NotFoundError)');
      t.done();
    });
  },
  'IDBTransaction.objectStore exception order: InvalidStateError vs. NotFoundError'
);

