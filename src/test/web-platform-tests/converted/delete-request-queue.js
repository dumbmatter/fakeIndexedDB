require("../support-node");

let saw;
indexeddb_test(
    (t, db) => {
        saw = expect(t, ["delete1", "delete2"]);
        let r = indexedDB.deleteDatabase(db.name);
        r.onerror = t.unreached_func("delete should succeed");
        r.onsuccess = t.step_func(e => saw("delete1"));
    },
    (t, db) => {
        let r = indexedDB.deleteDatabase(db.name);
        r.onerror = t.unreached_func("delete should succeed");
        r.onsuccess = t.step_func(e => saw("delete2"));

        db.close();
    },
    "Deletes are processed in order",
);
