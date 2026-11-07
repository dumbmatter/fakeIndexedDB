import * as assert from "assert";
import fakeIndexedDB from "../../fakeIndexedDB.js";
import type FDBDatabase from "../../FDBDatabase.js";

// Regression tests for https://github.com/dumbmatter/fakeIndexedDB/issues/175
// A typed array used as a key must be converted to an ArrayBuffer by
// "convert a value to a key", whether it comes from a single inline key
// path or from an index key path.

const step = (request: any): Promise<any> =>
    new Promise((resolve, reject) => {
        request.onsuccess = (e: any) => resolve(e.target.result);
        request.onerror = (e: any) => reject(e.target.error);
    });

describe("typed array key (#175)", () => {
    it("stores an ArrayBuffer key for a single inline key path and allows delete", async () => {
        const db: FDBDatabase = await step(
            (() => {
                const request = fakeIndexedDB.open("test" + Math.random());
                request.onupgradeneeded = (e: any) => {
                    e.target.result.createObjectStore("store", {
                        keyPath: "k",
                    });
                };
                return request;
            })(),
        );

        const store = db.transaction("store", "readwrite").objectStore("store");
        await step(store.put({ k: new Uint8Array([1, 2]) }));

        const keys = await step(
            db.transaction("store").objectStore("store").getAllKeys(),
        );
        assert.ok(
            keys[0] instanceof ArrayBuffer,
            `expected ArrayBuffer key, got ${Object.prototype.toString.call(keys[0])}`,
        );

        await step(
            db
                .transaction("store", "readwrite")
                .objectStore("store")
                .delete(new Uint8Array([1, 2])),
        );
        const remaining = await step(
            db.transaction("store").objectStore("store").getAllKeys(),
        );
        assert.equal(remaining.length, 0);
    });

    it("stores an ArrayBuffer index key and allows index.get", async () => {
        const db: FDBDatabase = await step(
            (() => {
                const request = fakeIndexedDB.open("test" + Math.random());
                request.onupgradeneeded = (e: any) => {
                    const store = e.target.result.createObjectStore("store", {
                        keyPath: "id",
                    });
                    store.createIndex("byK", "k");
                };
                return request;
            })(),
        );

        const store = db.transaction("store", "readwrite").objectStore("store");
        await step(store.put({ id: 1, k: new Uint8Array([5, 6]) }));

        const index = db.transaction("store").objectStore("store").index("byK");
        const cursor = await step(index.openCursor());
        assert.ok(
            cursor.key instanceof ArrayBuffer,
            `expected ArrayBuffer index key, got ${Object.prototype.toString.call(cursor.key)}`,
        );

        const found = await step(index.get(new Uint8Array([5, 6])));
        assert.equal(found.id, 1);
    });

    it("control: array key path parts are already converted", async () => {
        const db: FDBDatabase = await step(
            (() => {
                const request = fakeIndexedDB.open("test" + Math.random());
                request.onupgradeneeded = (e: any) => {
                    e.target.result.createObjectStore("store", {
                        keyPath: ["a", "b"],
                    });
                };
                return request;
            })(),
        );

        const store = db.transaction("store", "readwrite").objectStore("store");
        await step(
            store.put({ a: new Uint8Array([7]), b: new Uint8Array([8]) }),
        );

        const keys = await step(
            db.transaction("store").objectStore("store").getAllKeys(),
        );
        assert.ok(keys[0][0] instanceof ArrayBuffer);
        assert.ok(keys[0][1] instanceof ArrayBuffer);

        await step(
            db
                .transaction("store", "readwrite")
                .objectStore("store")
                .delete([new Uint8Array([7]), new Uint8Array([8])]),
        );
        const remaining = await step(
            db.transaction("store").objectStore("store").getAllKeys(),
        );
        assert.equal(remaining.length, 0);
    });
});
