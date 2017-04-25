require("../support-node");


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

