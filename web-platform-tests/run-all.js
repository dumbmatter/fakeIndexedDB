const fs = require("fs");
const {execSync} = require("child_process");
const path = require("path");

const testFolder = path.join(__dirname, "converted");

let passed = 0;
let failed = 0;
let skipped = 0;

const skip = [
    // First test works, but the others... they are extreme edge cases, and I'm not sure exactly what my implementation
    // should be.
    "bindings-inject-key.js",

    // realistic-structured-clone isn't realistic enough, and even if it was, I doubt this test would pass.
    "clone-before-keypath-eval.js",

    // Maximum call stack size exceeded, possibly due to the promise resolution microtask not taking precedence when it
    // should.
    "event-dispatch-active-flag.js",

    // Hangs because `dbname` is the same for all the async tests. If `dbname` was different for each async test, it
    // would work.
    "idbfactory_open9.js",

    // The tests pass, but then it hangs because the "value after close" tests don't listen for onsuccess. Adding
    // `open2.onsuccess = (e) => e.target.result.close();` fixes it.
    "idbtransaction_objectStoreNames.js",
];

const filenames = fs.readdirSync(testFolder);
for (const filename of filenames) {
    if (skip.includes(filename)) {
        console.log(`Skipping ${filename}...\n`);
        skipped += 1;
        continue;
    }

    console.log(`Running ${filename}...`);
    try {
        const output = execSync(`node ${path.join(testFolder, filename)}`, {cwd: testFolder});
        console.log(output.toString());
        passed += 1;
    } catch (err) {
        console.log("");
        failed += 1;
    }
}

if (skipped !== skip.length) {
    throw new Error(`Skipped ${skipped} tests, but skip.length is ${skip.length}. Missing file?`);
}

console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(`Skipped: ${skipped}`);

if (failed > 0) {
    process.exit(1);
}