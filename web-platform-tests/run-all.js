const fs = require("fs");
const {execSync} = require("child_process");
const path = require("path");

const testFolder = path.join(__dirname, "converted");

let passed = 0;
let failed = 0;

const filenames = fs.readdirSync(testFolder);
for (const filename of filenames) {
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

if (failed > 0) {
    process.exit(1);
}