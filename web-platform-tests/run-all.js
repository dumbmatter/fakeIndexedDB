const fs = require("fs");
const {execSync} = require("child_process");
const path = require("path");

const testFolder = path.join(__dirname, "converted");

let passed = 0;
let failed = 0;
let skipped = 0;

const skip = [
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

console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(`Skipped: ${skipped}`);

if (failed > 0) {
    process.exit(1);
}