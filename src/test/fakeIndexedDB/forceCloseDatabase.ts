import * as assert from "assert";
import fakeIndexedDB from "../../fakeIndexedDB.js";
import forceCloseDatabase from "../../forceCloseDatabase.js";
import type FDBDatabase from "../../FDBDatabase.js";

let db: FDBDatabase;

describe("forceCloseDatabase", () => {
    beforeEach(async () => {
        db = await new Promise<FDBDatabase>((resolve, reject) => {
            const request = fakeIndexedDB.open("test" + Math.random());
            request.onsuccess = (e) => resolve(e.target.result);
            request.onerror = (e) => reject(e.target.error);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                db.createObjectStore("store", { keyPath: "key" });
            };
        });
    });

    it("should fire a close event when forcibly closed", async () => {
        await new Promise<void>((resolve) => {
            db.addEventListener("close", () => {
                resolve();
            });
            forceCloseDatabase(db);
        });
    });

    it("should not fire a close event when closed manually", async () => {
        await new Promise<void>((resolve, reject) => {
            db.addEventListener("close", () => {
                reject(new Error("close event fired unexpectedly"));
            });
            db.close();
            setTimeout(() => resolve());
        });
    });

    it("should fire a close event only after transactions are complete", async () => {
        let fired = false;

        const firedPromise = new Promise<void>((resolve) => {
            db.addEventListener("close", () => {
                fired = true;
                resolve();
            });
        });

        await new Promise<void>((resolve, reject) => {
            const txn = db.transaction("store", "readwrite");
            forceCloseDatabase(db);
            const store = txn.objectStore("store");
            store.add({ key: "1" }).onsuccess = () => {
                assert.equal(fired, false);
                store.add({ key: "2" }).onsuccess = () => {
                    assert.equal(fired, false);
                    store.add({ key: "3" }).onsuccess = () => {
                        assert.equal(fired, false);
                    };
                };
            };
            txn.oncomplete = () => resolve();
            txn.onerror = (e) => reject(e.target.error);
        });

        await firedPromise;
        assert.equal(fired, true);
    });

    // The spec seems to imply that the "forced" flag only applies to the connection being force closed:
    // https://www.w3.org/TR/IndexedDB/#closing-connection
    // In practice, all connections with the same name will be closed because it only seems to happen for cases like
    // clearing data in DevTools, which doesn't allow you to target one IDBDatabase or another. But in our case we're
    // just simulating the API, and the FDBDatabase object is explicitly passed in to forceCloseDatabase, so it feels
    // more natural to just close the one database.
    it("should not fire a close event on another database with the same name", async () => {
        const db2 = await new Promise<FDBDatabase>((resolve, reject) => {
            const request = fakeIndexedDB.open(db.name);
            request.onsuccess = (e) => resolve(e.target.result);
            request.onerror = (e) => reject(e.target.error);
        });

        assert.notEqual(db, db2);
        assert.equal(db.name, db2.name);

        const promises = [
            new Promise<void>((resolve) => {
                db.addEventListener("close", () => resolve());
            }),
            new Promise<void>((resolve, reject) => {
                db2.addEventListener("close", () =>
                    reject(new Error("close event fired unexpectedly")),
                );
                setTimeout(() => resolve());
            }),
        ];
        forceCloseDatabase(db);
        await Promise.all(promises);
        assert.equal(db._closed, true);
        assert.equal(db2._closed, false);
    });
});
