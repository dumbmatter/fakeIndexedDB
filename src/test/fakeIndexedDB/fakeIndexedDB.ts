import * as assert from "assert";
import {FDBCursorWithValue, FDBDatabase} from "../../classes";
import fakeIndexedDB from "../../fakeIndexedDB";
import {TransactionMode} from "../../lib/types";

describe("fakeIndexedDB Tests", () => {
    describe("Transaction Lifetime", () => {
        it("Transactions should be activated from queue based on mode", (done) => {
            const request = fakeIndexedDB.open("test" + Math.random());
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                const store = db.createObjectStore("store", {keyPath: "key"});

                for (let i = 0; i < 10; i++) {
                    store.add({key: i, content: "test" + i});
                }
            };

            const started: Array<number | string> = [];
            const completed: Array<number | string> = [];

            const startTx = (db: FDBDatabase, mode: TransactionMode, desc: number | string) => {
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
                                tx.objectStore("store").get(5).onsuccess = () => {
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
                const store = db.createObjectStore("store", {autoIncrement: true});

                for (let i = 0; i < 10; i++) {
                    store.add({content: "test" + (i + 1)});
                }
            };
            request.onsuccess = (e) => {
                const db: FDBDatabase = e.target.result;

                const tx = db.transaction("store", "readwrite");
                tx.objectStore("store").count().onsuccess = (e2) => {
                    assert.equal(e2.target.result, 10);
                    tx.objectStore("store").add({content: "SHOULD BE ROLLED BACK"});

                    tx.objectStore("store").get(11).onsuccess = (e3) => {
                        assert.equal(e3.target.result.content, "SHOULD BE ROLLED BACK");
                        tx.abort();
                    };
                };

                const tx2 = db.transaction("store", "readwrite");
                tx2.objectStore("store").count().onsuccess = (e2) => {
                    assert.equal(e2.target.result, 10);

                    // add would fail if SHOULD BE ROLLED BACK was still there
                    tx2.objectStore("store").add({content: "SHOULD BE 11TH RECORD"});

                    tx2.objectStore("store").count().onsuccess = (e3) => {
                        assert.equal(e3.target.result, 11);
                    };
                    tx2.objectStore("store").get(11).onsuccess = (e3) => {
                        assert.equal(e3.target.result.content, "SHOULD BE 11TH RECORD");
                    };
                };

                tx2.oncomplete = () => { done(); };
            };
        });

        it("Rollback FDBObjectStore.clear", (done) => {
            const request = fakeIndexedDB.open("test" + Math.random());
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                const store = db.createObjectStore("store", {autoIncrement: true});

                for (let i = 0; i < 10; i++) {
                    store.add({content: "test" + (i + 1)});
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

                tx2.oncomplete = () => { done(); };
            };
        });

        it("Rollback FDBObjectStore.delete", (done) => {
            const request = fakeIndexedDB.open("test" + Math.random());
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                const store = db.createObjectStore("store", {autoIncrement: true});

                for (let i = 0; i < 10; i++) {
                    store.add({content: "test" + (i + 1)});
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

                tx2.oncomplete = () => { done(); };
            };
        });

        it("Rollback FDBObjectStore.put", (done) => {
            const request = fakeIndexedDB.open("test" + Math.random());
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                const store = db.createObjectStore("store", {autoIncrement: true});

                for (let i = 0; i < 10; i++) {
                    store.add({content: "test" + (i + 1)});
                }
            };
            request.onsuccess = (e) => {
                const db: FDBDatabase = e.target.result;

                const tx = db.transaction("store", "readwrite");
                tx.objectStore("store").put({content: "SHOULD BE ROLLED BACK"}, 10);
                tx.objectStore("store").get(10).onsuccess = (e2) => {
                    assert.equal(e2.target.result.content, "SHOULD BE ROLLED BACK");
                    tx.abort();
                };

                const tx2 = db.transaction("store", "readwrite");
                tx2.objectStore("store").get(10).onsuccess = (e2) => {
                    assert.equal(e2.target.result.content, "test10");
                };

                tx2.oncomplete = () => { done(); };
            };
        });

        it("Rollback FDBCursor.delete", (done) => {
            const request = fakeIndexedDB.open("test" + Math.random());
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                const store = db.createObjectStore("store", {autoIncrement: true});

                for (let i = 0; i < 10; i++) {
                    store.add({content: "test" + (i + 1)});
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

                tx2.oncomplete = () => { done(); };
            };
        });

        it("Rollback FDBCursor.update", (done) => {
            const request = fakeIndexedDB.open("test" + Math.random());
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                const store = db.createObjectStore("store", {autoIncrement: true});

                for (let i = 0; i < 10; i++) {
                    store.add({content: "test" + (i + 1)});
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
                        assert.equal(e3.target.result.content, "SHOULD BE ROLLED BACK");
                        tx.abort();
                    };
                };

                const tx2 = db.transaction("store", "readwrite");
                tx2.objectStore("store").get(3).onsuccess = (e2) => {
                    assert.equal(e2.target.result.content, "test3");
                };

                tx2.oncomplete = () => { done(); };
            };
        });

        it("Rollback of versionchange transaction", (done) => {
            const dbName = "test" + Math.random();
            const request = fakeIndexedDB.open(dbName);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                const store = db.createObjectStore("store", {autoIncrement: true});
                store.createIndex("content", "content");

                for (let i = 0; i < 10; i++) {
                    store.add({content: "test" + (i + 1)});
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

                    db.createObjectStore("store2", {autoIncrement: true});
                    assert.equal(db.objectStoreNames.length, 2);

                    store.createIndex("content2", "content");
                    assert.equal(store.indexNames.length, 2);

                    store.add({content: "SHOULD BE ROLLED BACK"});

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
                        assert(!store._rawObjectStore.deleted);
                        const index = store.index("content");
                        assert(!index._rawIndex.deleted);

                        store.count().onsuccess = (e3) => {
                            assert.equal(e3.target.result, 10);
                        };

                        index.get("test2").onsuccess = (e3) => {
                            assert.deepEqual(e3.target.result, {content: "test2"});
                        };

                        assert.equal(store.indexNames.length, 1);

                        tx.oncomplete = () => { done(); };
                    };
                };
            };
        });
    });

    it("should allow index where not all records have keys", (done) => {
        const request = fakeIndexedDB.open("test" + Math.random());
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            const store = db.createObjectStore("store", {autoIncrement: true});
            store.createIndex("compound", ["a", "b"], {unique: false });
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

                tx2.oncomplete = () => { done(); };
            };
        };
    });

    it("Properly handles compound keys (issue #18)", (done) => {
        const request = fakeIndexedDB.open("test", 3);
        request.onupgradeneeded = () => {
            const db: FDBDatabase = request.result;
            const store = db.createObjectStore("books", {keyPath: ["author", "isbn"]});
            store.createIndex("by_title", "title", {unique: true});

            store.put({title: "Quarry Memories", author: "Fred", isbn: 123456});
            store.put({title: "Water Buffaloes", author: "Fred", isbn: 234567});
            store.put({title: "Bedrock Nights", author: "Barney", isbn: 345678});
        };
        request.onsuccess = (event) => {
            const db: FDBDatabase = event.target.result;

            const tx = db.transaction("books", "readwrite");
            const request2 = tx.objectStore("books").openCursor(["Fred", 123456]).onsuccess = (event2) => {
                const cursor: FDBCursorWithValue = event2.target.result;
                cursor.value.price = 5.99;
                cursor.update(cursor.value);
            };

            tx.oncomplete = () => {
                done();
            };
        };
    });
});
