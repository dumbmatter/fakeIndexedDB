import * as assert from "assert";
import fakeIndexedDB from "../../fakeIndexedDB.js";
import FDBCursorWithValue from "../../FDBCursorWithValue.js";
import FDBDatabase from "../../FDBDatabase.js";
import FDBFactory from "../../FDBFactory.js";
import FDBKeyRange from "../../FDBKeyRange.js";
import FakeDOMStringList from "../../lib/FakeDOMStringList.js";
import { TransactionMode } from "../../lib/types.js";

describe("fakeIndexedDB Tests", () => {
    describe("Transaction Lifetime", () => {
        it("Transactions should be activated from queue based on mode", (done) => {
            const request = fakeIndexedDB.open("test" + Math.random());
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                const store = db.createObjectStore("store", { keyPath: "key" });

                for (let i = 0; i < 10; i++) {
                    store.add({ key: i, content: "test" + i });
                }
            };

            const started: (number | string)[] = [];
            const completed: (number | string)[] = [];

            const startTx = (
                db: FDBDatabase,
                mode: TransactionMode,
                desc: number | string
            ) => {
                const tx = db.transaction("store", mode);
                tx.objectStore("store").get(1).onsuccess = () => {
                    // If this is one of the readwrite transactions or the first readonly after a readwrite, make sure
                    // we waited for all active transactions to finish before starting a new one
                    if (mode === "readwrite" || started.length === 7) {
                        assert.equal(started.length, completed.length);
                    }

                    started.push(desc);
                    // console.log("start", desc);

                    tx.objectStore("store").get(2).onsuccess = () => {
                        tx.objectStore("store").get(3).onsuccess = () => {
                            tx.objectStore("store").get(4).onsuccess = () => {
                                tx.objectStore("store").get(5).onsuccess =
                                    () => {
                                        tx.objectStore("store").get(6);
                                    };
                            };
                        };
                    };
                };
                tx.oncomplete = () => {
                    completed.push(desc);
                    // console.log("done", desc);

                    if (completed.length >= 12) {
                        done();
                    }
                };
            };

            request.onsuccess = (e) => {
                const db = e.target.result;

                for (let i = 0; i < 5; i++) {
                    startTx(db, "readonly", "1-" + i);
                }
                startTx(db, "readwrite", 2);
                startTx(db, "readwrite", 3);
                for (let i = 0; i < 5; i++) {
                    startTx(db, "readonly", "4-" + i);
                }
            };
        });
    });

    describe("Transaction Rollback", () => {
        it("Rollback FDBObjectStore.add", (done) => {
            const request = fakeIndexedDB.open("test" + Math.random());
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                const store = db.createObjectStore("store", {
                    autoIncrement: true,
                });

                for (let i = 0; i < 10; i++) {
                    store.add({ content: "test" + (i + 1) });
                }
            };
            request.onsuccess = (e) => {
                const db: FDBDatabase = e.target.result;

                const tx = db.transaction("store", "readwrite");
                tx.objectStore("store").count().onsuccess = (e2) => {
                    assert.equal(e2.target.result, 10);
                    tx.objectStore("store").add({
                        content: "SHOULD BE ROLLED BACK",
                    });

                    tx.objectStore("store").get(11).onsuccess = (e3) => {
                        assert.equal(
                            e3.target.result.content,
                            "SHOULD BE ROLLED BACK"
                        );
                        tx.abort();
                    };
                };

                const tx2 = db.transaction("store", "readwrite");
                tx2.objectStore("store").count().onsuccess = (e2) => {
                    assert.equal(e2.target.result, 10);

                    // add would fail if SHOULD BE ROLLED BACK was still there
                    tx2.objectStore("store").add({
                        content: "SHOULD BE 11TH RECORD",
                    });

                    tx2.objectStore("store").count().onsuccess = (e3) => {
                        assert.equal(e3.target.result, 11);
                    };
                    tx2.objectStore("store").get(11).onsuccess = (e3) => {
                        assert.equal(
                            e3.target.result.content,
                            "SHOULD BE 11TH RECORD"
                        );
                    };
                };

                tx2.oncomplete = () => {
                    done();
                };
            };
        });

        it("Rollback FDBObjectStore.clear", (done) => {
            const request = fakeIndexedDB.open("test" + Math.random());
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                const store = db.createObjectStore("store", {
                    autoIncrement: true,
                });

                for (let i = 0; i < 10; i++) {
                    store.add({ content: "test" + (i + 1) });
                }
            };
            request.onsuccess = (e) => {
                const db: FDBDatabase = e.target.result;

                const tx = db.transaction("store", "readwrite");
                tx.objectStore("store").clear().onsuccess = () => {
                    tx.objectStore("store").count().onsuccess = (e2) => {
                        assert.equal(e2.target.result, 0);
                        tx.abort();
                    };
                };

                const tx2 = db.transaction("store", "readwrite");
                tx2.objectStore("store").count().onsuccess = (e2) => {
                    assert.equal(e2.target.result, 10);
                };

                tx2.oncomplete = () => {
                    done();
                };
            };
        });

        it("Rollback FDBObjectStore.delete", (done) => {
            const request = fakeIndexedDB.open("test" + Math.random());
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                const store = db.createObjectStore("store", {
                    autoIncrement: true,
                });

                for (let i = 0; i < 10; i++) {
                    store.add({ content: "test" + (i + 1) });
                }
            };
            request.onsuccess = (e) => {
                const db: FDBDatabase = e.target.result;

                const tx = db.transaction("store", "readwrite");
                tx.objectStore("store").delete(2).onsuccess = () => {
                    tx.objectStore("store").count().onsuccess = (e2) => {
                        assert.equal(e2.target.result, 9);
                        tx.abort();
                    };
                };

                const tx2 = db.transaction("store", "readwrite");
                tx2.objectStore("store").count().onsuccess = (e2) => {
                    assert.equal(e2.target.result, 10);
                };

                tx2.oncomplete = () => {
                    done();
                };
            };
        });

        it("Rollback FDBObjectStore.put", (done) => {
            const request = fakeIndexedDB.open("test" + Math.random());
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                const store = db.createObjectStore("store", {
                    autoIncrement: true,
                });

                for (let i = 0; i < 10; i++) {
                    store.add({ content: "test" + (i + 1) });
                }
            };
            request.onsuccess = (e) => {
                const db: FDBDatabase = e.target.result;

                const tx = db.transaction("store", "readwrite");
                tx.objectStore("store").put(
                    { content: "SHOULD BE ROLLED BACK" },
                    10
                );
                tx.objectStore("store").get(10).onsuccess = (e2) => {
                    assert.equal(
                        e2.target.result.content,
                        "SHOULD BE ROLLED BACK"
                    );
                    tx.abort();
                };

                const tx2 = db.transaction("store", "readwrite");
                tx2.objectStore("store").get(10).onsuccess = (e2) => {
                    assert.equal(e2.target.result.content, "test10");
                };

                tx2.oncomplete = () => {
                    done();
                };
            };
        });

        it("Rollback FDBCursor.delete", (done) => {
            const request = fakeIndexedDB.open("test" + Math.random());
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                const store = db.createObjectStore("store", {
                    autoIncrement: true,
                });

                for (let i = 0; i < 10; i++) {
                    store.add({ content: "test" + (i + 1) });
                }
            };
            request.onsuccess = (e) => {
                const db: FDBDatabase = e.target.result;

                const tx = db.transaction("store", "readwrite");
                tx.objectStore("store").openCursor(3).onsuccess = (e2) => {
                    const cursor = e2.target.result;
                    const obj = cursor.value;
                    obj.content = "SHOULD BE ROLLED BACK";
                    cursor.delete();
                    tx.objectStore("store").get(3).onsuccess = (e3) => {
                        assert.equal(e3.target.result, undefined);
                        tx.abort();
                    };
                };

                const tx2 = db.transaction("store", "readwrite");
                tx2.objectStore("store").get(3).onsuccess = (e2) => {
                    assert.equal(e2.target.result.content, "test3");
                };

                tx2.oncomplete = () => {
                    done();
                };
            };
        });

        it("Rollback FDBCursor.update", (done) => {
            const request = fakeIndexedDB.open("test" + Math.random());
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                const store = db.createObjectStore("store", {
                    autoIncrement: true,
                });

                for (let i = 0; i < 10; i++) {
                    store.add({ content: "test" + (i + 1) });
                }
            };
            request.onsuccess = (e) => {
                const db: FDBDatabase = e.target.result;

                const tx = db.transaction("store", "readwrite");
                tx.objectStore("store").openCursor(3).onsuccess = (e2) => {
                    const cursor = e2.target.result;
                    const obj = cursor.value;
                    obj.content = "SHOULD BE ROLLED BACK";
                    cursor.update(obj);
                    tx.objectStore("store").get(3).onsuccess = (e3) => {
                        assert.equal(
                            e3.target.result.content,
                            "SHOULD BE ROLLED BACK"
                        );
                        tx.abort();
                    };
                };

                const tx2 = db.transaction("store", "readwrite");
                tx2.objectStore("store").get(3).onsuccess = (e2) => {
                    assert.equal(e2.target.result.content, "test3");
                };

                tx2.oncomplete = () => {
                    done();
                };
            };
        });

        it("Rollback of versionchange transaction", (done) => {
            const dbName = "test" + Math.random();
            const request = fakeIndexedDB.open(dbName);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                const store = db.createObjectStore("store", {
                    autoIncrement: true,
                });
                store.createIndex("content", "content");

                for (let i = 0; i < 10; i++) {
                    store.add({ content: "test" + (i + 1) });
                }
            };
            request.onsuccess = (e) => {
                const db0 = e.target.result;
                db0.close();

                const request2 = fakeIndexedDB.open(dbName, 2);
                request2.onupgradeneeded = (e2) => {
                    const db = e2.target.result;
                    const tx = e2.target.transaction;
                    const store = tx.objectStore("store");

                    db.createObjectStore("store2", { autoIncrement: true });
                    assert.equal(db.objectStoreNames.length, 2);

                    store.createIndex("content2", "content");
                    assert.equal(store.indexNames.length, 2);

                    store.add({ content: "SHOULD BE ROLLED BACK" });

                    store.deleteIndex("content");
                    assert.equal(store.indexNames.length, 1);

                    db.deleteObjectStore("store");
                    assert.equal(db.objectStoreNames.length, 1);

                    tx.abort();
                };
                request2.onerror = () => {
                    const request3 = fakeIndexedDB.open(dbName);
                    request3.onsuccess = (e2) => {
                        const db: FDBDatabase = e2.target.result;
                        assert.equal(db.version, 1);
                        assert.equal(db.objectStoreNames.length, 1);

                        const tx = db.transaction("store");
                        const store = tx.objectStore("store");
                        assert.ok(!store._rawObjectStore.deleted);
                        const index = store.index("content");
                        assert.ok(!index._rawIndex.deleted);

                        store.count().onsuccess = (e3) => {
                            assert.equal(e3.target.result, 10);
                        };

                        index.get("test2").onsuccess = (e3) => {
                            assert.deepEqual(e3.target.result, {
                                content: "test2",
                            });
                        };

                        assert.equal(store.indexNames.length, 1);

                        tx.oncomplete = () => {
                            done();
                        };
                    };
                };
            };
        });
    });

    it("should allow index where not all records have keys", (done) => {
        const request = fakeIndexedDB.open("test" + Math.random());
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            const store = db.createObjectStore("store", {
                autoIncrement: true,
            });
            store.createIndex("compound", ["a", "b"], { unique: false });
        };
        request.onsuccess = (e) => {
            const db: FDBDatabase = e.target.result;

            const tx = db.transaction("store", "readwrite");
            tx.objectStore("store").put({
                whatever: "foo",
            });
            tx.onerror = (e2) => {
                done(e2.target.error);
            };

            tx.oncomplete = () => {
                const tx2 = db.transaction("store");
                const request2 = tx2.objectStore("store").get(1);

                request2.onsuccess = (e3) => {
                    assert.deepEqual(e3.target.result, {
                        whatever: "foo",
                    });
                };

                tx2.oncomplete = () => {
                    done();
                };
            };
        };
    });

    it("properly handles compound keys (issue #18)", (done) => {
        const request = fakeIndexedDB.open("test", 3);
        request.onupgradeneeded = () => {
            const db: FDBDatabase = request.result;
            const store = db.createObjectStore("books", {
                keyPath: ["author", "isbn"],
            });
            store.createIndex("by_title", "title", { unique: true });

            store.put({
                author: "Fred",
                isbn: 123456,
                title: "Quarry Memories",
            });
            store.put({
                author: "Fred",
                isbn: 234567,
                title: "Water Buffaloes",
            });
            store.put({
                author: "Barney",
                isbn: 345678,
                title: "Bedrock Nights",
            });
        };
        request.onsuccess = (event) => {
            const db: FDBDatabase = event.target.result;

            const tx = db.transaction("books", "readwrite");
            tx.objectStore("books").openCursor(["Fred", 123456]).onsuccess = (
                event2
            ) => {
                const cursor: FDBCursorWithValue = event2.target.result;
                cursor.value.price = 5.99;
                cursor.update(cursor.value);
            };

            tx.oncomplete = () => {
                done();
            };
        };
    });

    it("iterates correctly regardless of add order (issue #20)", (done) => {
        const request = fakeIndexedDB.open(`test${Math.random()}`);
        request.onupgradeneeded = (e) => {
            const db2 = e.target.result;
            const collStore = db2.createObjectStore("store", { keyPath: "id" });

            collStore.createIndex("_status", "_status", { unique: false });

            collStore.add({ id: "5", _status: "created" });
            collStore.add({ id: "0", _status: "created" });
        };
        request.onsuccess = (e) => {
            const db: FDBDatabase = e.target.result;

            const txn = db.transaction(["store"]);
            const store = txn.objectStore("store");
            const request2 = store.index("_status").openCursor();
            const expected = ["0", "5"];
            request2.onsuccess = (event) => {
                const cursor: FDBCursorWithValue = event.target.result;
                if (!cursor) {
                    assert.equal(expected.length, 0);
                    done();
                    return;
                }
                const { key, value } = cursor;
                const expectedID = expected.shift();
                assert.equal(value.id, expectedID);
                cursor.continue();
            };
            request2.onerror = (e2) => {
                done(e2.target.error);
            };
        };
        request.onerror = (e) => {
            done(e.target.error);
        };
    });

    it("handles two open requests at the same time (issue #22)", (done) => {
        const name = `test${Math.random()}`;

        const openDb = (cb?: (db: FDBDatabase) => void) => {
            const request = fakeIndexedDB.open(name, 3);
            request.onupgradeneeded = () => {
                const db = request.result;
                db.createObjectStore("books", { keyPath: "isbn" });
            };
            request.onsuccess = (event) => {
                const db: FDBDatabase = event.target.result;
                if (cb) {
                    cb(db);
                }
            };
        };

        openDb();

        openDb((db) => {
            db.transaction("books");
            done();
        });
    });

    it("correctly rolls back adding record to store when index constraint error occurs (issue #41)", async () => {
        function setup() {
            /* Create database, object store, and unique index */
            return new Promise<void>((resolve) => {
                fakeIndexedDB.deleteDatabase("mydb").onsuccess = () => {
                    const openreq = fakeIndexedDB.open("mydb");

                    openreq.onupgradeneeded = (event) => {
                        const db: FDBDatabase = event.target.result;
                        const store = db.createObjectStore("mystore", {
                            autoIncrement: true,
                        });
                        store.createIndex("myindex", "indexed_attr", {
                            unique: true,
                        });
                    };

                    openreq.onsuccess = (_event) => resolve();
                };
            });
        }

        const my_object = { indexed_attr: "xxx" };

        function put() {
            /* Put `my_object` into the db. */
            return new Promise((resolve) => {
                fakeIndexedDB.open("mydb").onsuccess = (event) => {
                    const db: FDBDatabase = event.target.result;
                    const tx = db.transaction(["mystore"], "readwrite");
                    const store = tx.objectStore("mystore");
                    const addreq = store.add(my_object);
                    addreq.onsuccess = (_event) => resolve("succ");
                    addreq.onerror = (_event) => resolve("fail");
                };
            });
        }

        function read() {
            /* Return list of all objects in the db */
            return new Promise<any[]>((resolve) => {
                fakeIndexedDB.open("mydb").onsuccess = (event) => {
                    const db: FDBDatabase = event.target.result;
                    const tx = db.transaction(["mystore"], "readonly");
                    const store = tx.objectStore("mystore");
                    store.getAll().onsuccess = (event2) =>
                        resolve(event2.target.result);
                };
            });
        }

        await setup();
        assert.equal(await put(), "succ"); // returns 'succ', as expected
        assert.equal(await put(), "fail"); // returns 'fail', as expected
        assert.equal((await read()).length, 1); // previously returned [my_object, my_object] instead of just [my_object]
    });

    it("FDBObjectStore.delete works with a key range (issue #53)", (done) => {
        const openreq = fakeIndexedDB.open("test53");
        openreq.onupgradeneeded = (event) => {
            const db = event.target.result;
            const store = db.createObjectStore("items", { keyPath: "key" });
            store.put({ key: "foo.a", value: 1 });
            store.put({ key: "foo.b", value: 2 });
            store.put({ key: "bar.c", value: 3 });
        };
        openreq.onsuccess = (event) => {
            const db = event.target.result;
            db.transaction("items").objectStore("items").count().onsuccess = (
                event2: any
            ) => {
                assert.equal(event2.target.result, 3);
                const req = db
                    .transaction("items", "readwrite")
                    .objectStore("items")
                    .delete(FDBKeyRange.bound("foo.", "foo.￿", false, false));
                req.onsuccess = () => {
                    db
                        .transaction("items")
                        .objectStore("items")
                        .count().onsuccess = (event3: any) => {
                        assert.equal(event3.target.result, 1);
                        done();
                    };
                };
                req.onerror = (event3: any) => {
                    done(event3.target.error);
                };
            };
        };
    });

    it("properly handles processing transactions with no requests (issue #54)", async () => {
        function open(): Promise<FDBDatabase> {
            /* Create database and object store */
            return new Promise((resolve, reject) => {
                fakeIndexedDB.deleteDatabase("test1").onsuccess = () => {
                    const openreq = fakeIndexedDB.open("test1");
                    openreq.onupgradeneeded = (event) => {
                        const db: FDBDatabase = event.target.result;
                        db.createObjectStore("table1");
                    };
                    openreq.onsuccess = (event) => {
                        const db: FDBDatabase = event.target.result;
                        resolve(db);
                    };
                    openreq.onerror = reject;
                };
            });
        }

        function bulkGet(db: FDBDatabase, table: string, keys: number[]) {
            /* relevant parts of Dexie.Table.bulkGet for 0 or 1 key */
            return new Promise((resolve, reject) => {
                const tx = db.transaction([table], "readonly");
                const store = tx.objectStore(table);
                if (keys.length === 0) {
                    resolve([]);
                } else if (keys.length === 1) {
                    const req = store.get(keys[0]);
                    req.onsuccess = (event2) => resolve([event2.target.result]);
                    req.onerror = () => resolve([undefined]);
                } else {
                    reject(new Error("test bulkGet only handles one key"));
                }
            });
        }

        const theDB = await open();
        // In the error case, this times out with the third promise unresolved:
        const result = await Promise.all([
            bulkGet(theDB, "table1", [1]),
            bulkGet(theDB, "table1", []),
            bulkGet(theDB, "table1", [3]),
        ]);
        assert.deepEqual(result, [[undefined], [], [undefined]]);
    });

    describe("Events", () => {
        it("doesn't call listeners added during a callback for the event that triggered the callback", (done) => {
            const name = `test${Math.random()}`;
            let called = false;
            const dummy = () => {
                called = true;
            };
            const handler = () => {
                request.addEventListener("upgradeneeded", dummy);
            };

            const request = fakeIndexedDB.open(name, 3);
            request.addEventListener("upgradeneeded", handler);
            request.addEventListener("success", () => {
                assert.ok(!called);
                done();
            });
        });

        it("doesn't get confused by removeEventListener during callbacks", (done) => {
            const name = `test${Math.random()}`;
            let called = false;
            const dummy = () => {
                called = true;
            };
            const handler = () => {
                request.removeEventListener("upgradeneeded", handler);
            };

            const request = fakeIndexedDB.open(name, 3);
            request.addEventListener("upgradeneeded", handler);
            request.addEventListener("upgradeneeded", dummy);
            request.addEventListener("success", () => {
                assert.ok(called);
                done();
            });
        });
    });

    it("confirm openCursor works (issue #60)", (done) => {
        const indexedDB = new FDBFactory();

        function idb(): Promise<FDBDatabase> {
            return new Promise((resolve, reject) => {
                indexedDB.deleteDatabase("issue60").onsuccess = () => {
                    const openreq = indexedDB.open("issue60");
                    openreq.onupgradeneeded = (event) => {
                        const db: FDBDatabase = event.target.result;
                        const albumStore = db.createObjectStore("album");
                        db.createObjectStore("photo");
                        albumStore.createIndex("albumId", "albumId");
                    };
                    openreq.onsuccess = (event) => {
                        const db: FDBDatabase = event.target.result;
                        resolve(db);
                    };
                    openreq.onerror = reject;
                };
            });
        }

        idb().then((db2) => {
            const cursor = db2
                .transaction(["album", "photo"], "readwrite")
                .objectStore("album")
                .index("albumId")
                .openCursor();

            cursor.onsuccess = () => {
                done();
            };
        });
    });

    describe("FakeDOMStringList", () => {
        it("contains", () => {
            const list = new FakeDOMStringList("a", "b", "c");
            assert.strictEqual(list.contains("a"), true);
            assert.strictEqual(list.contains("d"), false);
        });

        it("item", () => {
            const list = new FakeDOMStringList("a", "b", "c");
            assert.strictEqual(list.item(0), "a");
            assert.strictEqual(list.item(1), "b");
            assert.strictEqual(list.item(2), "c");
            assert.strictEqual(list.item(3), null);
            assert.strictEqual(list.item(10), null);
            assert.strictEqual(list.item(-1), null);
        });

        it.skip("does not include various Array properties", () => {
            const list = new FakeDOMStringList("a", "b", "c");
            const array = ["a", "b", "c"];

            assert.strictEqual(FakeDOMStringList.from, undefined);
            assert.deepStrictEqual(Array.from(array), array);

            assert.strictEqual(list.includes, undefined);
            assert.strictEqual(array.includes("b"), true);
        });
    });

    it("can use deep index keypaths on undefined objects", async () => {
        const indexedDB = new FDBFactory();

        function idb(): Promise<FDBDatabase> {
            return new Promise((resolve, reject) => {
                indexedDB.deleteDatabase("deepPath").onsuccess = () => {
                    const openreq = indexedDB.open("deepPath");
                    openreq.onupgradeneeded = (event) => {
                        const db: FDBDatabase = event.target.result;
                        const test = db.createObjectStore("test");
                        test.createIndex("deep", "foo.bar");
                    };
                    openreq.onsuccess = (event) => {
                        const db: FDBDatabase = event.target.result;
                        resolve(db);
                    };
                    openreq.onerror = reject;
                };
            });
        }

        const db1 = await idb();

        const put = db1
            .transaction(["test"], "readwrite")
            .objectStore("test")
            .put({ foo: undefined }, "key");

        return new Promise((resolve, reject) => {
            put.onsuccess = () => {
                resolve();
            };

            put.onerror = () => {
                reject(put.error);
            };
        });
    });
});
