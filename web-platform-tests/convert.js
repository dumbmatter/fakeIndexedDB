const fs = require("fs");
const path = require("path");

const inFolder = path.join(__dirname, "IndexedDB");
const outFolder = path.join(__dirname, "converted");

const filenames = fs.readdirSync(inFolder);
for (const filename of filenames) {
    if (path.extname(filename).indexOf(".htm") !== 0) {
        continue;
    }
    console.log(`Converting ${filename}...`);

    const contents = fs.readFileSync(path.join(inFolder, filename), "utf8");
    let matches = contents.match(/<script>([\s\S]+?)<\/script>/); // http://stackoverflow.com/q/1979884/786644
    if (matches === null || matches.length < 2) {
        matches = contents.match(/<script type="text\/javascript">([\s\S]+?)<\/script>/); // http://stackoverflow.com/q/1979884/786644
    }
    if (matches === null || matches.length < 2) {
        throw new Error("No script found");
    }
    
    const testScript = matches[1];

    const output = `require("../support-node");
${testScript}`;

    const baseFilename = path.basename(path.basename(filename, ".htm"), ".html");
    fs.writeFileSync(path.join(outFolder, `${baseFilename}.js`), output);
}
