import * as assert from "assert";
import fakeIndexedDB from "../../fakeIndexedDB.js";
import type FDBDatabase from "../../FDBDatabase.js";
import type FDBOpenDBRequest from "../../FDBOpenDBRequest.js";

const req = (r: FDBOpenDBRequest): Promise<FDBDatabase> =>
    new Promise((res, rej) => {
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
    });

describe("memory leaks", () => {
    let db: FDBDatabase | undefined;

    before(async () => {
        const open = fakeIndexedDB.open("test-mem-leaks", 1);
        open.onupgradeneeded = () => open.result.createObjectStore("s");
        db = await req(open);
    });

    it("does not leak memory in database.transactions (issue #170)", async () => {
        for (let i = 0; i < 100; i++) {
            const tx = db!.transaction("s", "readwrite");
            tx.objectStore("s").put("foo", "k" + (i % 10));
            await new Promise((r) => {
                tx.oncomplete = r;
            });
        }
        await new Promise((resolve) => setTimeout(resolve));
        assert.equal(
            db?._rawDatabase.transactions.length,
            0,
            "Transactions should not be held onto indefinitely",
        );
    });

    it("does not leak memory an aborted transaction (issue #170)", async () => {
        const tx = db!.transaction("s", "readwrite");
        tx.abort();

        await new Promise((resolve) => setTimeout(resolve));
        assert.equal(
            db?._rawDatabase.transactions.length,
            0,
            "Transactions should not be held onto indefinitely",
        );
    });

    after(async () => {
        db!.close();
    });
});
