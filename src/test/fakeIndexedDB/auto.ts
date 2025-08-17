import * as assert from "assert";
import * as fakeIndexedDB from "../../index.js";

// `indexedDB` is read-only, all others are read-write
const readWriteProps = Object.keys(fakeIndexedDB).filter((prop) =>
    prop.startsWith("IDB"),
) as Array<keyof typeof fakeIndexedDB>;

describe("auto", () => {
    it("correctly overrides globals in fake-indexeddb/auto", async () => {
        // simulate what the native property descriptors do
        Object.defineProperty(globalThis, "indexedDB", {
            set: undefined,
            get: () => undefined,
            enumerable: true,
            configurable: true,
        });
        for (const prop of readWriteProps) {
            Object.defineProperty(globalThis, prop, {
                value: undefined,
                enumerable: true,
                configurable: true,
                writable: true,
            });
        }

        // @ts-expect-error relative to the build/ directory
        await import("../../../../auto/index.mjs");

        // check read-only indexedDB global
        const descriptor = Object.getOwnPropertyDescriptor(
            globalThis,
            "indexedDB",
        );
        assert.equal(descriptor!.set, undefined);
        assert.equal(descriptor!.get!(), fakeIndexedDB.indexedDB);
        assert.equal(descriptor!.enumerable, true);
        assert.equal(descriptor!.configurable, true);

        // check read-write globals
        for (const prop of readWriteProps) {
            const descriptor = Object.getOwnPropertyDescriptor(
                globalThis,
                prop,
            );
            assert.equal(descriptor!.value, fakeIndexedDB[prop]);
            assert.equal(descriptor!.enumerable, true);
            assert.equal(descriptor!.configurable, true);
            assert.equal(descriptor!.writable, true);
        }
    });
});
