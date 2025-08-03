import * as assert from "assert";
import fakeIndexedDB from "../../fakeIndexedDB.js";
import FDBDatabase from "../../FDBDatabase.js";
import FDBKeyRange from "../../FDBKeyRange.js";
import FDBObjectStore from "../../FDBObjectStore.js";

// Tests taken from https://github.com/dumbmatter/IndexedDB-getAll-shim

let db: FDBDatabase;

describe("getAll", () => {
    beforeEach((done) => {
        const request = fakeIndexedDB.open("test" + Math.random());
        request.onupgradeneeded = (e) => {
            const db2: FDBDatabase = e.target.result;
            const store = db2.createObjectStore("store", { keyPath: "key" });
            store.createIndex("content", "content");

            for (let i = 0; i < 10; i++) {
                store.add({ key: i, content: "test" + i });
            }
        };
        request.onsuccess = (e) => {
            db = e.target.result;
            done();
        };
        request.onerror = (e) => {
            done(e.target.error);
        };
    });

    it("should work on object store", (done) => {
        const request = db.transaction("store").objectStore("store").getAll();
        request.onsuccess = (e) => {
            assert.equal(e.target.result.length, 10);
            done();
        };
        request.onerror = (e) => {
            done(e.target.error);
        };
    });

    it("should work on object store - empty IDBGetAllOptions", (done) => {
        const request = db.transaction("store").objectStore("store").getAll({});
        request.onsuccess = (e) => {
            assert.equal(e.target.result.length, 10);
            done();
        };
        request.onerror = (e) => {
            done(e.target.error);
        };
    });

    it("should work on index", (done) => {
        const request = db
            .transaction("store")
            .objectStore("store")
            .index("content")
            .getAll();
        request.onsuccess = (e) => {
            assert.equal(e.target.result.length, 10);
            done();
        };
        request.onerror = (e) => {
            done(e.target.error);
        };
    });

    it("should work on index - empty IDBGetAllOptions", (done) => {
        const request = db
            .transaction("store")
            .objectStore("store")
            .index("content")
            .getAll({});
        request.onsuccess = (e) => {
            assert.equal(e.target.result.length, 10);
            done();
        };
        request.onerror = (e) => {
            done(e.target.error);
        };
    });

    it("should work with query parameter", (done) => {
        const request = db
            .transaction("store")
            .objectStore("store")
            .getAll(FDBKeyRange.bound(2, 5));
        request.onsuccess = (e) => {
            assert.equal(e.target.result.length, 4);
            assert.equal(e.target.result[0].key, 2);
            assert.equal(e.target.result[3].key, 5);
            done();
        };
        request.onerror = (e) => {
            done(e.target.error);
        };
    });

    it("should work with count parameter", (done) => {
        const request = db
            .transaction("store")
            .objectStore("store")
            .getAll(null, 3);
        request.onsuccess = (e) => {
            assert.equal(e.target.result.length, 3);
            assert.equal(e.target.result[0].key, 0);
            assert.equal(e.target.result[2].key, 2);
            done();
        };
        request.onerror = (e) => {
            done(e.target.error);
        };
    });

    it("should work with query and count parameters", (done) => {
        const request = db
            .transaction("store")
            .objectStore("store")
            .getAll(FDBKeyRange.lowerBound(6), 3);
        request.onsuccess = (e) => {
            assert.equal(e.target.result.length, 3);
            assert.equal(e.target.result[0].key, 6);
            assert.equal(e.target.result[2].key, 8);
            done();
        };
        request.onerror = (e) => {
            done(e.target.error);
        };
    });

    it("throws InvalidStateError when store has been deleted", (done) => {
        db.close();
        let store: FDBObjectStore;
        const request = fakeIndexedDB.open(db.name, 2);
        request.onupgradeneeded = (e) => {
            const db2 = e.target.result;
            const tx = e.target.transaction;
            store = tx.objectStore("store");
            db2.deleteObjectStore("store");
        };
        request.onsuccess = () => {
            assert.throws(() => {
                store.getAll();
            }, /InvalidStateError/);
            done();
        };
        request.onerror = (e) => {
            done(e.target.error);
        };
    });

    it("throws TransactionInactiveError on aborted transaction", () => {
        const tx = db.transaction("store");
        const store = tx.objectStore("store");
        tx.abort();
        assert.throws(() => {
            store.getAll();
        }, /TransactionInactiveError/);
    });

    it("throws DataError when using invalid key", () => {
        assert.throws(() => {
            db.transaction("store").objectStore("store").getAll(NaN);
        }, /DataError/);
    });

    it("should work with query and count options as IDBGetAllOptions", (done) => {
        const request = db
            .transaction("store")
            .objectStore("store")
            .getAll({ query: FDBKeyRange.lowerBound(6), count: 3 });
        request.onsuccess = (e) => {
            assert.equal(e.target.result.length, 3);
            assert.equal(e.target.result[0].key, 6);
            assert.equal(e.target.result[2].key, 8);
            done();
        };
        request.onerror = (e) => {
            done(e.target.error);
        };
    });

    it("should work with query+count+direction options as IDBGetAllOptions", (done) => {
        const request = db
            .transaction("store")
            .objectStore("store")
            .getAll({
                query: FDBKeyRange.lowerBound(6),
                count: 3,
                direction: "prev",
            });
        request.onsuccess = (e) => {
            assert.equal(e.target.result.length, 3);
            assert.equal(e.target.result[0].key, 9);
            assert.equal(e.target.result[2].key, 7);
            done();
        };
        request.onerror = (e) => {
            done(e.target.error);
        };
    });
});

describe("getAllKeys", () => {
    beforeEach((done) => {
        const request = fakeIndexedDB.open("test" + Math.random());
        request.onupgradeneeded = (e) => {
            const db2 = e.target.result;
            const store = db2.createObjectStore("store", { keyPath: "key" });
            store.createIndex("content", "content");

            for (let i = 0; i < 10; i++) {
                store.add({ key: i, content: "test" + i });
            }
        };
        request.onsuccess = (e) => {
            db = e.target.result;
            done();
        };
        request.onerror = (e) => {
            done(e.target.error);
        };
    });

    it("should work on object store", (done) => {
        const request = db
            .transaction("store")
            .objectStore("store")
            .getAllKeys();
        request.onsuccess = (e) => {
            assert.equal(e.target.result.length, 10);
            done();
        };
        request.onerror = (e) => {
            done(e.target.error);
        };
    });

    it("should work on object store - empty IDBGetAllOptions", (done) => {
        const request = db
            .transaction("store")
            .objectStore("store")
            .getAllKeys({});
        request.onsuccess = (e) => {
            assert.equal(e.target.result.length, 10);
            done();
        };
        request.onerror = (e) => {
            done(e.target.error);
        };
    });

    it("should work on index", (done) => {
        const request = db
            .transaction("store")
            .objectStore("store")
            .index("content")
            .getAllKeys();
        request.onsuccess = (e) => {
            assert.equal(e.target.result.length, 10);
            done();
        };
        request.onerror = (e) => {
            done(e.target.error);
        };
    });

    it("should work on index - empty IDBGetAllOptions", (done) => {
        const request = db
            .transaction("store")
            .objectStore("store")
            .index("content")
            .getAllKeys({});
        request.onsuccess = (e) => {
            assert.equal(e.target.result.length, 10);
            done();
        };
        request.onerror = (e) => {
            done(e.target.error);
        };
    });

    it("should work with query parameter", (done) => {
        const request = db
            .transaction("store")
            .objectStore("store")
            .getAllKeys(FDBKeyRange.bound(2, 5));
        request.onsuccess = (e) => {
            assert.equal(e.target.result.length, 4);
            assert.equal(e.target.result[0], 2);
            assert.equal(e.target.result[3], 5);
            done();
        };
        request.onerror = (e) => {
            done(e.target.error);
        };
    });

    it("should work with count parameter", (done) => {
        const request = db
            .transaction("store")
            .objectStore("store")
            .getAllKeys(null, 3);
        request.onsuccess = (e) => {
            assert.equal(e.target.result.length, 3);
            assert.equal(e.target.result[0], 0);
            assert.equal(e.target.result[2], 2);
            done();
        };
        request.onerror = (e) => {
            done(e.target.error);
        };
    });

    it("should work with query and count parameters", (done) => {
        const request = db
            .transaction("store")
            .objectStore("store")
            .getAllKeys(FDBKeyRange.lowerBound(6), 3);
        request.onsuccess = (e) => {
            assert.equal(e.target.result.length, 3);
            assert.equal(e.target.result[0], 6);
            assert.equal(e.target.result[2], 8);
            done();
        };
        request.onerror = (e) => {
            done(e.target.error);
        };
    });

    it("throws InvalidStateError when store has been deleted", (done) => {
        db.close();
        let store: FDBObjectStore;
        const request = fakeIndexedDB.open(db.name, 2);
        request.onupgradeneeded = (e) => {
            const db2 = e.target.result;
            const tx = e.target.transaction;
            store = tx.objectStore("store");
            db2.deleteObjectStore("store");
        };
        request.onsuccess = () => {
            assert.throws(() => {
                store.getAllKeys();
            }, /InvalidStateError/);
            done();
        };
        request.onerror = (e) => {
            done(e.target.error);
        };
    });

    it("throws TransactionInactiveError on aborted transaction", () => {
        const tx = db.transaction("store");
        const store = tx.objectStore("store");
        tx.abort();
        assert.throws(() => {
            store.getAllKeys();
        }, /TransactionInactiveError/);
    });

    it("throws DataError when using invalid key", () => {
        assert.throws(() => {
            db.transaction("store").objectStore("store").getAllKeys(NaN);
        }, /DataError/);
    });

    it("should work with query and count options as IDBGetAllOptions", (done) => {
        const request = db
            .transaction("store")
            .objectStore("store")
            .getAllKeys({ query: FDBKeyRange.lowerBound(6), count: 3 });
        request.onsuccess = (e) => {
            assert.equal(e.target.result.length, 3);
            assert.equal(e.target.result[0], 6);
            assert.equal(e.target.result[2], 8);
            done();
        };
        request.onerror = (e) => {
            done(e.target.error);
        };
    });

    it("should work with query+count+direction options as IDBGetAllOptions", (done) => {
        const request = db
            .transaction("store")
            .objectStore("store")
            .getAllKeys({
                query: FDBKeyRange.lowerBound(6),
                count: 3,
                direction: "prev",
            });
        request.onsuccess = (e) => {
            assert.equal(e.target.result.length, 3);
            assert.equal(e.target.result[0], 9);
            assert.equal(e.target.result[2], 7);
            done();
        };
        request.onerror = (e) => {
            done(e.target.error);
        };
    });
});

describe("getAllRecords", () => {
    beforeEach((done) => {
        const request = fakeIndexedDB.open("test" + Math.random());
        request.onupgradeneeded = (e) => {
            const db2 = e.target.result;
            const store = db2.createObjectStore("store", { keyPath: "key" });
            store.createIndex("content", "content");

            for (let i = 0; i < 10; i++) {
                store.add({ key: i, content: "test" + i });
            }
        };
        request.onsuccess = (e) => {
            db = e.target.result;
            done();
        };
        request.onerror = (e) => {
            done(e.target.error);
        };
    });

    it("should work on object store", (done) => {
        const request = db
            .transaction("store")
            .objectStore("store")
            .getAllRecords();
        request.onsuccess = (e) => {
            assert.equal(e.target.result.length, 10);
            done();
        };
        request.onerror = (e) => {
            done(e.target.error);
        };
    });

    it("should work on object store - empty IDBGetAllOptions", (done) => {
        const request = db
            .transaction("store")
            .objectStore("store")
            .getAllRecords({});
        request.onsuccess = (e) => {
            assert.equal(e.target.result.length, 10);
            done();
        };
        request.onerror = (e) => {
            done(e.target.error);
        };
    });

    it("should work on index", (done) => {
        const request = db
            .transaction("store")
            .objectStore("store")
            .index("content")
            .getAllRecords();
        request.onsuccess = (e) => {
            assert.equal(e.target.result.length, 10);
            done();
        };
        request.onerror = (e) => {
            done(e.target.error);
        };
    });

    it("should work on index - empty IDBGetAllOptions", (done) => {
        const request = db
            .transaction("store")
            .objectStore("store")
            .index("content")
            .getAllRecords({});
        request.onsuccess = (e) => {
            assert.equal(e.target.result.length, 10);
            done();
        };
        request.onerror = (e) => {
            done(e.target.error);
        };
    });

    it("should work with query parameter", (done) => {
        const request = db
            .transaction("store")
            .objectStore("store")
            .getAllRecords({ query: FDBKeyRange.bound(2, 5) });
        request.onsuccess = (e) => {
            assert.equal(e.target.result.length, 4);
            assert.deepStrictEqual(e.target.result[0], {
                key: 2,
                value: { content: "test2", key: 2 },
            });
            assert.deepStrictEqual(e.target.result[3], {
                key: 5,
                value: { content: "test5", key: 5 },
            });
            done();
        };
        request.onerror = (e) => {
            done(e.target.error);
        };
    });

    it("should work with count option", (done) => {
        const request = db
            .transaction("store")
            .objectStore("store")
            .getAllRecords({ query: null, count: 3 });
        request.onsuccess = (e) => {
            assert.equal(e.target.result.length, 3);
            assert.deepStrictEqual(e.target.result[0], {
                key: 0,
                value: { content: "test0", key: 0 },
            });
            assert.deepStrictEqual(e.target.result[2], {
                key: 2,
                value: { content: "test2", key: 2 },
            });
            done();
        };
        request.onerror = (e) => {
            done(e.target.error);
        };
    });

    it("should work with query and count option", (done) => {
        const request = db
            .transaction("store")
            .objectStore("store")
            .getAllRecords({ query: FDBKeyRange.lowerBound(6), count: 3 });
        request.onsuccess = (e) => {
            assert.equal(e.target.result.length, 3);
            assert.deepStrictEqual(e.target.result[0], {
                key: 6,
                value: { content: "test6", key: 6 },
            });
            assert.deepStrictEqual(e.target.result[2], {
                key: 8,
                value: { content: "test8", key: 8 },
            });
            done();
        };
        request.onerror = (e) => {
            done(e.target.error);
        };
    });

    it("throws InvalidStateError when store has been deleted", (done) => {
        db.close();
        let store: FDBObjectStore;
        const request = fakeIndexedDB.open(db.name, 2);
        request.onupgradeneeded = (e) => {
            const db2 = e.target.result;
            const tx = e.target.transaction;
            store = tx.objectStore("store");
            db2.deleteObjectStore("store");
        };
        request.onsuccess = () => {
            assert.throws(() => {
                store.getAllRecords();
            }, /InvalidStateError/);
            done();
        };
        request.onerror = (e) => {
            done(e.target.error);
        };
    });

    it("throws TransactionInactiveError on aborted transaction", () => {
        const tx = db.transaction("store");
        const store = tx.objectStore("store");
        tx.abort();
        assert.throws(() => {
            store.getAllRecords();
        }, /TransactionInactiveError/);
    });

    it("throws DataError when using invalid key", () => {
        assert.throws(() => {
            db.transaction("store")
                .objectStore("store")
                .getAllRecords({ query: NaN });
        }, /DataError/);
    });

    it("should work with query+count+direction options as IDBGetAllOptions", (done) => {
        const request = db
            .transaction("store")
            .objectStore("store")
            .getAllRecords({
                query: FDBKeyRange.lowerBound(6),
                count: 3,
                direction: "prev",
            });
        request.onsuccess = (e) => {
            assert.equal(e.target.result.length, 3);
            assert.deepStrictEqual(e.target.result[0], {
                key: 9,
                value: { content: "test9", key: 9 },
            });
            assert.deepStrictEqual(e.target.result[2], {
                key: 7,
                value: { content: "test7", key: 7 },
            });
            done();
        };
        request.onerror = (e) => {
            done(e.target.error);
        };
    });
});
