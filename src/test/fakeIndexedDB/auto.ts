import * as assert from "assert";
import * as fakeIndexedDB from "../../index.js";

// `indexedDB` is read-only, all others are read-write
const props = Object.keys(fakeIndexedDB).filter(
    (prop) => prop.startsWith("IDB") || prop === "indexedDB",
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
        for (const prop of props) {
            Object.defineProperty(globalThis, prop, {
                value: undefined,
                enumerable: true,
                configurable: true,
                writable: true,
            });
        }

        // @ts-expect-error relative to the build/ directory
        await import("../../../../auto/index.mjs");

        // check our own globals
        for (const prop of props) {
            const descriptor = Object.getOwnPropertyDescriptor(
                globalThis,
                prop,
            );
            assert.equal(descriptor!.value, fakeIndexedDB[prop]);
            assert.equal(descriptor!.enumerable, true);
            assert.equal(descriptor!.configurable, true);
            assert.equal(descriptor!.writable, true);
        }

        // check that we can still overwrite them with `globalThis.<prop> = ...`
        for (const prop of props) {
            const fake = {};
            (globalThis as any)[prop] = fake;
            assert.equal((globalThis as any)[prop], fake);
        }
    });

    it("exports as cjs directly, without `default` member - issue #130", async () => {
        // @ts-expect-error relative to the build/ directory
        await import("../../../../auto/index.js");

        // ensure we directly set the export as `module.exports` rather than `module.exports.default`
        for (const prop of props) {
            assert.ok(!(globalThis as any)[prop].default);
        }
    });
});
