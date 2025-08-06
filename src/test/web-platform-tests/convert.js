/* global console */
import fs from "node:fs";
import { glob } from "glob";
import path from "node:path";

const skip = [
    // IDL test; out of scope for the time being.
    "idlharness.any.js",
];

function makeParentDir(file) {
    const dir = path.posix.dirname(file);
    fs.mkdirSync(dir, { recursive: true });
}

function addConst(string) {
    return string.replace(
        /^(\s+)(.*)/,
        (whole, match1, match2) => match1 + "const " + match2,
    );
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

        let codeChunks = [];

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

        const importMatches = contents.matchAll(
            /<script src=["']?(.+?)['"]?>/g,
        );

        for (const match of importMatches) {
            if (
                [
                    "/resources/testharness.js",
                    "/resources/testharnessreport.js",
                    "/resources/testdriver.js",
                    "/resources/testdriver-vendor.js",
                    "/common/get-host-info.sub.js",
                    "../common/get-host-info.sub.js",
                ].includes(match[1])
            ) {
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

        codeChunks = codeChunks.map((chunk) => {
            return (
                chunk
                    // HACK: some of the tests use sloppy mode, probably due to author error
                    // This causes problems for us because we convert to ESM (strict) mode
                    // So manually fix some of the sloppy global assigments in tests
                    .replaceAll(/ {4}loop_array = \[];/g, addConst)
                    .replaceAll(
                        / {12}store = db.createObjectStore\("store"\);/g,
                        addConst,
                    )
                    .replaceAll(
                        / {12}store2 = db.createObjectStore\("store2", \{ keyPath: \["x", "keypath"] }\);/g,
                        addConst,
                    )
                    .replaceAll(/ {8}attrs = \[];/g, addConst)

                    // this test has to be disabled because we can't detect Proxies vs non-Proxies in JS
                    .replaceAll(
                        /invalid_key\('proxy of an array', new Proxy\(\[1,2,3], \{}\)\);/g,
                        "",
                    )
            );
        });

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

        let codeChunks = [];

        {
            const relativeWptEnvLocation = path.posix.join(
                path.posix.relative(path.posix.dirname(dest), __dirname),
                "wpt-env.js",
            );
            codeChunks.push(`import "${relativeWptEnvLocation}";\n`);
        }

        const importMatches = testScript
            .matchAll(/^\/\/\s*META:\s*script=(.+)$/gm)
            .filter((match) => match[1] !== "/common/subset-tests.js");

        for (const match of importMatches) {
            const location = path.posix.join(
                path.posix.dirname(filename),
                match[1],
            );
            codeChunks.push(fs.readFileSync(location) + "\n");
        }

        codeChunks.push(testScript);

        codeChunks = codeChunks.map((chunk) => {
            return (
                chunk
                    // HACK: same as above, some of the tests use sloppy mode
                    .replaceAll(
                        / {2}cursor = txn.objectStore\('objectStore'\)\.index\('index'\)\.openCursor\(/g,
                        addConst,
                    )
                    .replaceAll(
                        / {2}cursor = txn4.objectStore\('objectStore'\)\.index\('index'\)\.openCursor\(IDBKeyRange\.bound\(0, 10\), "prev"\);/g,
                        addConst,
                    )
                    .replaceAll(
                        / {2}cursor = txn2.objectStore\('objectStore'\)\.index\('index'\)\.openCursor\(IDBKeyRange\.bound\(0, 10\), "prev"\);/g,
                        addConst,
                    )
            );
        });

        makeParentDir(dest);

        fs.writeFileSync(dest, codeChunks.join("\n"));
    }
}
