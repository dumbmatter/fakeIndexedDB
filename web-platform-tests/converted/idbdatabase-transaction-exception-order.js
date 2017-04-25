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
    db.createObjectStore('s');
  },
  (t, db) => {
    db.close();
    assert_throws('InvalidStateError', () => {
      db.transaction('no-such-store');
    }, '"Connection is closed" check (InvalidStateError) should precede ' +
       '"store names" check (NotFoundError)');
    t.done();
  },
  'IDBDatabase.transaction exception order: InvalidStateError vs. NotFoundError'
);

indexeddb_test(
  (t, db) => {
    db.createObjectStore('s');
  },
  (t, db) => {
    db.close();
    assert_throws('InvalidStateError', () => {
      db.transaction([]);
    }, '"Connection is closed" check (InvalidStateError) should precede ' +
       '"stores is empty" check (InvalidAccessError)');
    t.done();
  },
  'IDBDatabase.transaction exception order: InvalidStateError vs. InvalidAccessError'
);

indexeddb_test(
  (t, db) => {
    db.createObjectStore('s');
  },
  (t, db) => {
    assert_throws('NotFoundError', () => {
      db.transaction('no-such-store', 'versionchange');
    }, '"No such store" check (NotFoundError) should precede ' +
       '"invalid mode" check (TypeError)');
    t.done();
  },
  'IDBDatabase.transaction exception order: NotFoundError vs. TypeError'
);

