/* eslint-env node */
import fs from "node:fs";
import path from "node:path";
import { glob } from "glob";

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
        const { dir, name } = path.parse(relative);
        const dest = path.join(outFolder, dir, `${name}.js`);

        console.log(`Converting ${relative}...`);

        const testScript = fs.readFileSync(filename, "utf8");

        // TODO: what does, e.g., 'META: global=window,worker' do? Do
        // we have to care about it?

        let codeChunks = [];

        const wptRoot = path.posix.relative(
            path.posix.dirname(dest),
            __dirname,
        );
        {
            const relativeWptEnvLocation = path.posix.join(
                wptRoot,
                "wpt-env.js",
            );
            codeChunks.push(`import "${relativeWptEnvLocation}";\n`);
        }

        if (filename.includes("idlharness.any.js")) {
            codeChunks.push(
                ...["idlharness.js", "webidl2.js"].map(
                    (resource) =>
                        `import "${path.posix.join(
                            wptRoot,
                            path.posix.join("idlharness", resource),
                        )}"`,
                ),
            );
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
                        "/resources/idlharness.js",
                        "/resources/WebIDLParser.js",
                    ].includes(match[1]),
            );

        for (const match of importMatches) {
            const location = path.posix.join(
                path.posix.dirname(filename),
                match[1],
            );
            codeChunks.push(fs.readFileSync(location) + "\n");
        }

        codeChunks.push(testScript);

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
