import * as assert from "assert";
import fakeIndexedDB from "../../fakeIndexedDB.js";
import FDBKeyRange from "../../FDBKeyRange.js";
import type FDBDatabase from "../../FDBDatabase.js";
import type FDBRequest from "../../FDBRequest.js";
import type FDBTransaction from "../../FDBTransaction.js";

// Deleting or overwriting an object store record must remove exactly the index records that were stored for it, for
// every kind of index, and nothing else.

const requestToPromise = (request: FDBRequest) =>
    new Promise<any>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });

const transactionToPromise = (tx: FDBTransaction) =>
    new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onabort = () => reject(tx.error);
    });

const openDatabase = async (): Promise<FDBDatabase> => {
    const request = fakeIndexedDB.open("test" + Math.random());
    request.onupgradeneeded = () => {
        const store = request.result.createObjectStore("store", {
            keyPath: "id",
        });
        store.createIndex("shared", "shared");
        store.createIndex("name", "name");
        store.createIndex("unique", "unique", { unique: true });
        store.createIndex("tags", "tags", { multiEntry: true });
        store.createIndex("compound", ["shared", "name"]);
        store.createIndex("nested", "a.b");
    };
    return requestToPromise(request);
};

// [index key, primary key] pairs of an index, in index order
const indexEntries = async (db: FDBDatabase, indexName: string) => {
    const tx = db.transaction("store", "readonly");
    const request = tx.objectStore("store").index(indexName).openKeyCursor();
    const entries: [any, any][] = [];
    await new Promise<void>((resolve, reject) => {
        request.onsuccess = () => {
            const cursor = request.result;
            if (cursor) {
                entries.push([cursor.key, cursor.primaryKey]);
                cursor.continue();
            } else {
                resolve();
            }
        };
        request.onerror = () => reject(request.error);
    });
    return entries;
};

// What every index should hold for these records, built by recreating the indexes from scratch in a new database
const expectedEntries = async (records: any[]) => {
    const db = await openDatabase();
    const tx = db.transaction("store", "readwrite");
    for (const record of records) {
        tx.objectStore("store").put(record);
    }
    await transactionToPromise(tx);
    const expected: { [indexName: string]: [any, any][] } = {};
    for (const indexName of db.transaction("store").objectStore("store")
        .indexNames) {
        expected[indexName] = await indexEntries(db, indexName);
    }
    db.close();
    return expected;
};

const assertIndexesMatch = async (db: FDBDatabase) => {
    const records = await requestToPromise(
        db.transaction("store").objectStore("store").getAll(),
    );
    const expected = await expectedEntries(records);
    for (const indexName of Object.keys(expected)) {
        assert.deepStrictEqual(
            await indexEntries(db, indexName),
            expected[indexName],
            indexName,
        );
    }
};

const makeRecord = (id: number, version: number) => {
    const record: any = {
        id,
        // every record shares this index key
        shared: "same",
        name: `name ${id} v${version}`,
        // duplicates and an invalid key inside a multiEntry array
        tags: ["x", `t${id % 3}`, "x", { notAKey: true }, `v${version}`],
    };
    if (id % 2 === 0) {
        record.unique = `u${id} v${version}`;
    }
    if (id % 3 === 0) {
        // key path that resolves only for some records
        record.a = { b: id * 10 + version };
    }
    return record;
};

describe("Deleting index records", () => {
    it("removes exactly the deleted records' index entries", async () => {
        const db = await openDatabase();

        let tx = db.transaction("store", "readwrite");
        for (let i = 0; i < 30; i++) {
            tx.objectStore("store").put(makeRecord(i, 0));
        }
        await transactionToPromise(tx);
        await assertIndexesMatch(db);

        // single deletes, including a key that does not exist
        tx = db.transaction("store", "readwrite");
        tx.objectStore("store").delete(3);
        tx.objectStore("store").delete(4);
        tx.objectStore("store").delete(1000);
        await transactionToPromise(tx);
        await assertIndexesMatch(db);

        // range delete
        tx = db.transaction("store", "readwrite");
        tx.objectStore("store").delete(FDBKeyRange.bound(10, 15, false, true));
        await transactionToPromise(tx);
        await assertIndexesMatch(db);

        // overwrite, changing every index key, and dropping some out of indexes entirely
        tx = db.transaction("store", "readwrite");
        for (let i = 0; i < 30; i += 2) {
            const record = makeRecord(i, 1);
            if (i % 4 === 0) {
                delete record.unique;
                delete record.tags;
            }
            tx.objectStore("store").put(record);
        }
        await transactionToPromise(tx);
        await assertIndexesMatch(db);

        // delete through a cursor
        tx = db.transaction("store", "readwrite");
        const request = tx.objectStore("store").openCursor();
        request.onsuccess = () => {
            const cursor = request.result;
            if (cursor) {
                if (cursor.primaryKey % 5 === 0) {
                    cursor.delete();
                }
                cursor.continue();
            }
        };
        await transactionToPromise(tx);
        await assertIndexesMatch(db);

        db.close();
    });

    it("restores index entries when a transaction with deletes and overwrites aborts", async () => {
        const db = await openDatabase();

        let tx = db.transaction("store", "readwrite");
        for (let i = 0; i < 10; i++) {
            tx.objectStore("store").put(makeRecord(i, 0));
        }
        await transactionToPromise(tx);
        const before = await expectedEntries(
            await requestToPromise(
                db.transaction("store").objectStore("store").getAll(),
            ),
        );

        tx = db.transaction("store", "readwrite");
        tx.objectStore("store").delete(2);
        tx.objectStore("store").delete(FDBKeyRange.bound(5, 7));
        tx.objectStore("store").put(makeRecord(4, 1));
        tx.objectStore("store").put(makeRecord(20, 1));
        tx.objectStore("store").get(0).onsuccess = () => tx.abort();
        await assert.rejects(transactionToPromise(tx));

        await assertIndexesMatch(db);
        for (const indexName of Object.keys(before)) {
            assert.deepStrictEqual(
                await indexEntries(db, indexName),
                before[indexName],
                indexName,
            );
        }

        db.close();
    });

    // Rolling back the failed put deletes the index entries derived from the value that failed, and in the unique index
    // that key belongs to another record, whose entry must survive
    it("keeps another record's unique index entry when an overwrite fails on it", async () => {
        const db = await openDatabase();

        let tx = db.transaction("store", "readwrite");
        tx.objectStore("store").put({ id: 1, name: "one", unique: "taken" });
        tx.objectStore("store").put({ id: 2, name: "two", unique: "free" });
        await transactionToPromise(tx);

        tx = db.transaction("store", "readwrite");
        const request = tx
            .objectStore("store")
            .put({ id: 2, name: "two v2", unique: "taken" });
        request.onerror = (event) => {
            // keep the transaction alive
            event.preventDefault();
        };
        await transactionToPromise(tx);

        assert.deepStrictEqual(
            await requestToPromise(
                db.transaction("store").objectStore("store").getAll(),
            ),
            [
                { id: 1, name: "one", unique: "taken" },
                { id: 2, name: "two", unique: "free" },
            ],
        );
        assert.deepStrictEqual(await indexEntries(db, "unique"), [
            ["free", 2],
            ["taken", 1],
        ]);
        await assertIndexesMatch(db);

        db.close();
    });
});
