require("../support-node");

indexeddb_test(
    (t, db) => {
        db.createObjectStore("store");
    },
    (t, db) => {
        const tx = db.transaction("store", "readwrite");
        const store = tx.objectStore("store");

        const buffer = new Uint8Array([1, 2, 3, 4]).buffer;
        assert_equals(buffer.byteLength, 4);

        // Detach the ArrayBuffer by transferring it to a worker.
        const worker = new Worker(URL.createObjectURL(new Blob([])));
        worker.postMessage("", [buffer]);
        assert_equals(buffer.byteLength, 0);

        assert_throws(new TypeError(), () => {
            store.put("", buffer);
        });
        t.done();
    },
    "Detached ArrayBuffer",
);

indexeddb_test(
    (t, db) => {
        db.createObjectStore("store");
    },
    (t, db) => {
        const tx = db.transaction("store", "readwrite");
        const store = tx.objectStore("store");

        const array = new Uint8Array([1, 2, 3, 4]);
        assert_equals(array.length, 4);

        // Detach the ArrayBuffer by transferring it to a worker.
        const worker = new Worker(URL.createObjectURL(new Blob([])));
        worker.postMessage("", [array.buffer]);
        assert_equals(array.length, 0);

        assert_throws(new TypeError(), () => {
            store.put("", array);
        });
        t.done();
    },
    "Detached TypedArray",
);
