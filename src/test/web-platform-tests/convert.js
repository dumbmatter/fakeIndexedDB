/* global console */
import fs from "node:fs";
import path from "node:path";
import { glob } from "glob";

// HACK: some of the tests use sloppy mode, probably due to author error
// This causes problems for us because we convert to ESM (strict) mode
// So manually fix some of the sloppy global assignments in tests
const globalVars = ["cursor", "db", "result", "store", "value"];
const declareGlobalVars = `let ${globalVars.join(",")};\n`;

const skip = [
    // Skip here rather than in manifest TOML file because we don't support all the scripts this imports
    "idlharness.any.js",
];

function makeParentDir(file) {
    const dir = path.posix.dirname(file);
    fs.mkdirSync(dir, { recursive: true });
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

        codeChunks.push(declareGlobalVars);

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
                    "/IndexedDB/idbindex_getAll.any.js",
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

        // HACK: these tests don't need the sloppy mode fixes, and in fact already declare the relevant variables
        // so would fail with the fixes
        if (
            !filename.endsWith("/idbcursor-continue.any.js") &&
            !filename.endsWith("/value.any.js")
        ) {
            codeChunks.push(declareGlobalVars);
        }

        const titleMatches = [
            ...testScript.matchAll(/\/\/\s*META:\s*title=(.+)$/gm),
        ];
        if (titleMatches.length) {
            // some tests use `self.title` to create the test name
            codeChunks.push(
                `globalThis.title = ${JSON.stringify(titleMatches[0][1])};\n`,
            );
        }

        const importMatches = testScript
            .matchAll(/^\/\/\s*META:\s*script=(.+)$/gm)
            .filter(
                (match) =>
                    ![
                        "/common/subset-tests.js",
                        "/storage/buckets/resources/util.js",
                    ].includes(match[1]),
            );

        for (const match of importMatches) {
            const location = path.posix.join(
                path.posix.dirname(filename),
                match[1],
            );
            codeChunks.push(fs.readFileSync(location) + "\n");
        }

        // HACK: this test re-declares the `expect` function, so wrap in an IIFE
        if (filename.includes("transaction-lifetime-empty.any")) {
            codeChunks.push(`(function () {\n${testScript}\n})();`);
        } else {
            codeChunks.push(testScript);
        }

        // HACK: this test runs in sloppy mode and assumes `this` is the global
        if (filename.includes("delete-request-queue.any")) {
            codeChunks = codeChunks.map((chunk) => {
                return chunk.replaceAll(`this.saw =`, "saw =");
            });
        }

        makeParentDir(dest);

        fs.writeFileSync(dest, codeChunks.join("\n"));
    }
}
