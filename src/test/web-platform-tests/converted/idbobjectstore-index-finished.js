require("../support-node");


indexeddb_test(
  (t, db) => {
    const store = db.createObjectStore('store');
    store.createIndex('index', 'key_path');
  },
  (t, db) => {
    const tx = db.transaction('store');
    const store = tx.objectStore('store');
    tx.abort();
    assert_throws('InvalidStateError', () => store.index('index'),
                  'index() should throw if transaction is finished');
    t.done();
  },
  'IDBObjectStore index() behavior when transaction is finished'
);

