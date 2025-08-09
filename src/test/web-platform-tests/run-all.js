/* global console */

import { test } from "node:test";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { glob } from "glob";

const execAsync = promisify(exec);

const __dirname = "src/test/web-platform-tests";
const testFolder = path.join(__dirname, "converted");

/* global process */
const nodeMajorVersion = parseInt(process.version.substring(1).split(".")[0]);

let skipped = new Set();

const skip = [
    // Maximum call stack size exceeded, possibly due to the promise resolution microtask not taking precedence when it
    // should (keep_alive not working).
    "event-dispatch-active-flag.any.js",
    "transaction-deactivation-timing.any.js",
    "upgrade-transaction-deactivation-timing.any.js",

    // These are pretty tricky. Would be nice to have them working.
    "fire-error-event-exception.any.js",
    "fire-success-event-exception.any.js",
    "fire-upgradeneeded-event-exception.any.js",

    // Mostly works, except the last test which is edge cases
    "get-databases.any.js",

    // No Web Worker in Node.js.
    "idb_webworkers.js",

    // Mostly works, but Node.js doesn't support trailing commas in function parameters, and there's some other subtle
    // issues too.
    "idb-binary-key-roundtrip.any.js",

    // Mostly works, but keepAlive results in an infinite loop
    "idb-explicit-commit.any.js",

    // Not sure how to do this weird error silencing in Node.js.
    "idb-explicit-commit-throw.any.js",

    // Usually works, but there is a race condition. Sometimes the setTimeout runs before the transaction commits.
    "idbcursor-continue-exception-order.any.js",
    "idbcursor-delete-exception-order.any.js",
    "idbcursor-update-exception-order.any.js",
    "idbobjectstore-add-put-exception-order.any.js",
    "idbobjectstore-clear-exception-order.any.js",
    "idbobjectstore-delete-exception-order.any.js",
    "idbobjectstore-deleteIndex-exception-order.any.js",
    "idbobjectstore-query-exception-order.any.js",

    // No iframe in Node.js.
    "idbfactory-deleteDatabase-opaque-origin.js",
    "idbfactory-open-opaque-origin.js",

    // Hangs because `dbname` is the same for all the async tests. If `dbname` was different for each async test, it
    // would work.
    "idbfactory_open.any.js",

    // Fails because FDBTransaction._abort synchronously sends out error events to open requests, when it should be
    // asynchronous according to the spec. Making it asynchronous causes other tests to fail though. Need to be more
    // careful about making sure other asynchronous things are actually asynchronous, and also "asynchronous" doesn't
    // just mean "wrap in setImmediate", in this context it means to wait until prior requests are complete and then
    // execute.
    "idbindex_get.any.js",
    "idbindex_getKey.any.js",
    "idbindex_openCursor.any.js",
    "idbindex_openKeyCursor.any.js",

    // Mostly works, but subtlely wrong behavior when renaming a newly-created index/store and then aborting the upgrade
    // transaction (this has roughly 0 real world impact, but could be indicative of other problems in fake-indexeddb).
    "idbindex-rename-abort.any.js",
    "idbobjectstore-rename-abort.any.js",
    "transaction-abort-index-metadata-revert.any.js",
    "transaction-abort-multiple-metadata-revert.any.js",
    "transaction-abort-object-store-metadata-revert.any.js",

    // Half works, and I don't care enough to investigate further right now.
    "idbrequest-onupgradeneeded.any.js",

    // db2.close() sets _closePending flag, and then that's checked in runVersionchangeTransaction resulting in an
    // AbortError. Based on https://w3c.github.io/IndexedDB/#opening this seems corret, so I'm not sure why this test is
    // supposed to work.
    "idbtransaction_objectStoreNames.any.js",

    // Node.js doesn't have Blob or File, and my simple mocks aren't good enough for these tests.
    "blob-valid-before-commit.any.js",
    "blob-valid-after-deletion.any.js",
    "blob-delete-objectstore-db.any.js",
    "blob-contenttype.any.js",
    "blob-composite-blob-reads.any.js",
    "nested-cloning-small.any.js",
    "nested-cloning-large.any.js",
    "nested-cloning-large-multiple.any.js",
    "nested-cloning-basic.any.js",
    "blob-valid-after-abort.any.js",

    // All kinds of fucked up.
    "open-request-queue.any.js",

    // Flakey test - sometimes passes, sometimes fails, needs investigation
    "idbtransaction_abort.any.js",

    // Did not investigate in great detail.
    "bindings-inject-keys-bypass.any.js",
    "bindings-inject-values-bypass.any.js",
    "idbfactory-databases-opaque-origin.js",
    "request-event-ordering-large-mixed-with-small-values.any.js",
    "request-event-ordering-large-then-small-values.any.js",
    "request-event-ordering-large-values.any.js",
    "request-event-ordering-small-values.any.js",
    "transaction-abort-generator-revert.any.js",
    "transaction-lifetime-empty.any.js",
    "upgrade-transaction-lifecycle-backend-aborted.any.js",
    "upgrade-transaction-lifecycle-user-aborted.any.js",

    // Fails because `onerror` is never called since it is set after the abort call and the events on the request are
    // triggered synchronously. Not sure how to reconcile this with the spec. Same issue affected some other test too, I
    // think.
    "transaction-abort-request-error.any.js",

    // Relies on an <input type=file> which is hard for us to simulate
    "file_support.sub.js",

    // Doesn't seem relevant to a node.js test (cross-origin isolation)
    "resources/idbfactory-origin-isolation-iframe.js",
    "idbfactory-origin-isolation.js",
    "serialize-sharedarraybuffer-throws.https.js",

    // fakeIndexedDB does not currently support relaxed durability or durability options
    "transaction-relaxed-durability.any.js",

    // these test our ability to do a structured clone on various DOM types like DOMRect which we don't support
    "structured-clone.any.js",
    "structured-clone-transaction-state.any.js",

    // these tests rely on the precise ordering of exceptions, which we currently fail
    "idbcursor-advance-exception-order.any.js",
    "idbdatabase-createObjectStore-exception-order.any.js",
    "idbdatabase-deleteObjectStore-exception-order.any.js",
    "idbdatabase-transaction-exception-order.any.js",

    // async timing test which we currently fail:
    // "Check that read-only transactions within a database can run in parallel"
    "transaction-scheduling-within-database.any.js",

    // relies on cross-iframe/cross-window communication which isn't relevant to us
    "database-names-by-origin.js",
    "idbindex-cross-realm-methods.js",
    "idbobjectstore-cross-realm-methods.js",
    "idb-partitioned-basic.sub.js",
    "idb-partitioned-coverage.sub.js",
    "idb-partitioned-persistence.sub.js",
    "ready-state-destroyed-execution-context.js",
    "resources/cross-origin-helper-frame.js",
    "resources/idb-partitioned-basic-iframe.js",
    "resources/idb-partitioned-coverage-iframe.js",
    "resources/idb-partitioned-persistence-iframe.js",

    // we do not currently support `navigator.storageBuckets`
    "storage-buckets.https.any.js",

    // test hangs, needs further investigation
    "transaction-lifetime.any.js",

    // These break in Node <20 because of lack of support for `ArrayBuffer.prototype.detached`
    ...(nodeMajorVersion < 22
        ? [
              "idb_binary_key_conversion.any.js",
              "idb-binary-key-detached.any.js",
              "idbindex_getAll.any.js",
              "idbindex_getAllKeys.any.js",
              "idbindex_getAllKeys-options.tentative.any.js",
              "idbindex_getAll-options.tentative.any.js",
              "idbindex_getAllRecords.tentative.any.js",
              "idbobjectstore_getAll.any.js",
              "idbobjectstore_getAllKeys.any.js",
              "idbobjectstore_getAllKeys-options.tentative.any.js",
              "idbobjectstore_getAll-options.tentative.any.js",
              "idbobjectstore_getAllRecords.tentative.any.js",
          ]
        : []),
];

if (new Set(skip).size !== skip.length) {
    const skipCounts = new Map();
    for (const test of skip) {
        skipCounts.set(test, 1 + (skipCounts.get(test) || 0));
    }
    throw new Error(
        "Duplicates exist in skip array, please remove them: " +
            [...skipCounts.entries()]
                .filter((_) => _[1] > 1)
                .map((_) => _[0])
                .join(", "),
    );
}

const filenames = glob.sync("/**/*.js", { root: testFolder });
for (const absFilename of filenames) {
    const filename = path.relative(testFolder, absFilename);
    const shouldSkip = skip.includes(filename);
    if (shouldSkip) {
        skipped.add(filename);
    }
    await test(filename, { skip: shouldSkip }, async (t) => {
        const { stdout, stderr } = await execAsync(`node ${filename}`, {
            cwd: testFolder,
            encoding: "utf-8",
        });
        if (stderr) {
            console.error(stderr);
        }
        const results = Object.create(null);
        try {
            const resultLines = stdout
                .split("\n")
                .filter((_) => _.includes("testResult"))
                .map((_) => JSON.parse(_));
            for (const resultLine of resultLines) {
                Object.assign(results, resultLine.testResult);
            }
        } catch (err) {
            throw new Error("Could not parse output from test", { cause: err });
        }
        if (!Object.keys(results).length) {
            throw new Error("Did not receive any test results from test");
        }
        for (const [name, result] of Object.entries(results)) {
            await t.test(name, () => {
                if (!result.passed) {
                    throw new Error(result.error);
                }
            });
        }
    });
}

if (skipped.size !== skip.length) {
    const extraneous = skip.filter((test) => !skipped.has(test));
    const errorMsg = `Skipped ${skipped.size} tests, but skip.length is ${skip.length}. Missing file? Extraneous files are: ${extraneous.join(", ")}`;
    throw new Error(errorMsg);
}
