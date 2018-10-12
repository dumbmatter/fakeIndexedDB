require("../support-node");

indexeddb_test(
    (t, db) => {
        const s = db.createObjectStore("s");
        s.put("value", "key");
    },
    (t, db) => {
        const s = db.transaction("s", "readonly").objectStore("s");
        const r = s.openCursor();
        r.onsuccess = t.step_func(() => {
            r.onsuccess = null;
            const cursor = r.result;
            setTimeout(
                t.step_func(() => {
                    assert_throws(
                        "TransactionInactiveError",
                        () => {
                            cursor.delete();
                        },
                        '"Transaction inactive" check (TransactionInactivError) ' +
                            'should precede "read only" check (ReadOnlyError)',
                    );
                    t.done();
                }),
                0,
            );
        });
    },
    "IDBCursor.delete exception order: TransactionInactiveError vs. ReadOnlyError",
);

indexeddb_test(
    (t, db) => {
        const s = db.createObjectStore("s");
        s.put("value", "key");
    },
    (t, db) => {
        const s = db.transaction("s", "readonly").objectStore("s");
        const r = s.openCursor();
        r.onsuccess = t.step_func(() => {
            r.onsuccess = null;
            const cursor = r.result;
            cursor.continue();
            assert_throws(
                "ReadOnlyError",
                () => {
                    cursor.delete();
                },
                '"Read only" check (ReadOnlyError) should precede ' +
                    '"got value flag" (InvalidStateError) check',
            );
            t.done();
        });
    },
    "IDBCursor.delete exception order: ReadOnlyError vs. InvalidStateError #1",
);

indexeddb_test(
    (t, db) => {
        const s = db.createObjectStore("s");
        s.put("value", "key");
    },
    (t, db) => {
        const s = db.transaction("s", "readonly").objectStore("s");
        const r = s.openKeyCursor();
        r.onsuccess = t.step_func(() => {
            r.onsuccess = null;
            const cursor = r.result;
            assert_throws(
                "ReadOnlyError",
                () => {
                    cursor.delete();
                },
                '"Read only" check (ReadOnlyError) should precede ' +
                    '"key only flag" (InvalidStateError) check',
            );
            t.done();
        });
    },
    "IDBCursor.delete exception order: ReadOnlyError vs. InvalidStateError #2",
);
