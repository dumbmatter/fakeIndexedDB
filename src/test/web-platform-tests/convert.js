import fs from "node:fs";
import glob from "glob";
import path from "node:path";

const skip = [
    // IDL test; out of scope for the time being.
    "idlharness.any.js",
];

// It's 2019 and JavaScript is only just implementing a `matchAll`
// function.
function* matchAll(string, inputRe) {
    const re = new RegExp(inputRe, inputRe.flags + "g");
    while (true) {
        const match = re.exec(string);
        if (match === null) {
            break;
        }
        yield match;
    }
}

function makeParentDir(file) {
    const dir = path.posix.dirname(file);
    if (!fs.existsSync(dir)) {
        makeParentDir(dir);
        fs.mkdirSync(dir);
    }
}

const __dirname = "src/test/web-platform-tests";

const inFolder = path.posix.join(__dirname, "IndexedDB");
const outFolder = path.posix.join(__dirname, "converted");

{
    const filenames = glob.sync("/**/*.{htm,html}", { root: inFolder });
    for (const filename of filenames) {
        const relative = path.posix.relative(inFolder, filename);
        if (skip.includes(relative)) {
            console.log(`Skipping ${relative}.`);
            continue;
        }
        const { dir, name } = path.parse(relative);
        const dest = path.join(outFolder, dir, `${name}.js`);
        console.log(`Converting ${relative}...`);

        const contents = fs.readFileSync(filename, "utf8");
        let matches = contents.match(/<script>([\s\S]+?)<\/script>/); // http://stackoverflow.com/q/1979884/786644
        if (matches === null || matches.length < 2) {
            matches = contents.match(
                /<script type="text\/javascript">([\s\S]+?)<\/script>/,
            ); // http://stackoverflow.com/q/1979884/786644
        }
        if (matches === null || matches.length < 2) {
            throw new Error("No script found");
        }

        const testScript = matches[1];

        const codeChunks = [];

        {
            const relativeWptEnvLocation = path.posix.join(
                path.posix.relative(path.posix.dirname(dest), __dirname),
                "wpt-env.js",
            );
            codeChunks.push(`import "${relativeWptEnvLocation}";\n`);
        }

        // Because these are 'imported' with <script>, the support
        // scripts share a scope with the test script, and that's how
        // the utilities are accessed. The simplest way to emulate the
        // browser behaviour here is to glom it all into a single
        // file.

        const importMatches = matchAll(
            contents,
            /<script src=["']?(.+?)['"]?>/,
        );

        for (const match of importMatches) {
            if (match[1] === "/resources/testharness.js") {
                continue;
            }
            if (match[1] === "/resources/testharnessreport.js") {
                continue;
            }
            const location = path.posix.join(
                path.posix.dirname(filename),
                match[1],
            );
            codeChunks.push(fs.readFileSync(location) + "\n");
        }

        codeChunks.push(testScript);

        makeParentDir(dest);

        fs.writeFileSync(dest, codeChunks.join("\n"));
    }
}

{
    const filenames = glob.sync("/**/*.any.js", { root: inFolder });
    for (const filename of filenames) {
        const relative = path.posix.relative(inFolder, filename);
        if (skip.includes(relative)) {
            console.log(`Skipping ${relative}.`);
            continue;
        }
        const { dir, name } = path.parse(relative);
        const dest = path.join(outFolder, dir, `${name}.js`);

        console.log(`Converting ${relative}...`);

        const testScript = fs.readFileSync(filename, "utf8");

        // TODO: what does, e.g., 'META: global=window,worker' do? Do
        // we have to care about it?

        const codeChunks = [];

        {
            const relativeWptEnvLocation = path.posix.join(
                path.posix.relative(path.posix.dirname(dest), __dirname),
                "wpt-env.js",
            );
            codeChunks.push(`import "${relativeWptEnvLocation}";\n`);
        }

        const importMatches = matchAll(
            testScript,
            /^\/\/\s*META:\s*script=(.+)$/m,
        );

        for (const match of importMatches) {
            const location = path.posix.join(
                path.posix.dirname(filename),
                match[1],
            );
            codeChunks.push(fs.readFileSync(location) + "\n");
        }

        codeChunks.push(testScript);

        makeParentDir(dest);

        fs.writeFileSync(dest, codeChunks.join("\n"));
    }
}
