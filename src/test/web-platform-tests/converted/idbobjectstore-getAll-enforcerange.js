require("../support-node");


indexeddb_test(
  (t, db) => {
    const store = db.createObjectStore('store');
  },
  (t, db) => {
    const tx = db.transaction('store');
    const store = tx.objectStore('store');
    [NaN, Infinity, -Infinity, -1, -Number.MAX_SAFE_INTEGER].forEach(count => {
      assert_throws(TypeError(), () => { store.getAll(null, count); },
                    `getAll with count ${count} count should throw TypeError`);
    });
    t.done();
  },
  `IDBObjectStore.getAll() uses [EnforceRange]`
);
