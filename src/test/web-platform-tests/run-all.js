/* global console, process */

import { test } from "node:test";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import * as fs from "node:fs";
import { parse, stringify } from "smol-toml";
import { glob } from "glob";

const execAsync = promisify(exec);

const generateManifests = process.env.GENERATE_MANIFESTS;

const __dirname = "src/test/web-platform-tests";
const testFolder = path.join(__dirname, "converted");
const manifestsFolder = path.join(__dirname, "manifests");

const nodeMajorVersion = parseInt(process.version.substring(1).split(".")[0]);

const filenames = glob.sync("/**/*.js", { root: testFolder });

function parseManifest(manifestFilename) {
    const text =
        fs.existsSync(manifestFilename) &&
        fs.readFileSync(manifestFilename, "utf-8");
    if (!text) {
        return;
    }
    const contents = parse(text);
    // we want to preserve comments, and smol-toml has no way to extract them
    const comments = [...text.matchAll(/(?:^|\n)#([^#\n]+)/g)].map((_) => _[1]);
    return { contents, comments };
}

function stringifyManifest(generatedManifest, comments) {
    return (
        (comments ? comments.map((_) => `#${_}\n`).join("") : "") +
        stringify(generatedManifest)
    );
}

let numExpectedFailures = 0;
let numUnstableTests = 0;

const timeout = 5000;

for (const absFilename of filenames) {
    const filename = path.relative(testFolder, absFilename);

    const generatedManifest = {};

    const manifestBasename = filename.replace(/\.js$/, ".toml");
    const manifestFilename = path.join(manifestsFolder, manifestBasename);
    // if any tests are failing only in older node versions, they go in the override
    const overrideManifestFilename = path.join(
        manifestsFolder,
        `overrides/node${nodeMajorVersion}`,
        manifestBasename,
    );
    const expectedManifest = fs.existsSync(overrideManifestFilename)
        ? parseManifest(overrideManifestFilename)
        : parseManifest(manifestFilename);
    const skip = expectedManifest?.contents?.skip;

    if (skip) {
        generatedManifest.skip = true;
    }

    await test(filename, { skip }, async (t) => {
        let execOutput;
        try {
            execOutput = await execAsync(`node ${filename}`, {
                cwd: testFolder,
                encoding: "utf-8",
                timeout,
            });
        } catch (error) {
            if (error.killed && error.signal === "SIGTERM") {
                // Timeout!
                generatedManifest.expectHang = true;

                // error has stdout and stderr properties containing output before the timeout, which may include some test results or error messages
                execOutput = error;
            } else {
                throw error;
            }
        }
        const { stdout, stderr } = execOutput;
        if (stderr) {
            console.error(stderr);
        }
        const results = {};
        const resultLines = stdout
            .split("\n")
            .filter((_) => _.includes("testResult"))
            .map((_) => JSON.parse(_));
        for (const resultLine of resultLines) {
            for (const name of Object.keys(resultLine.testResult)) {
                if (name in results) {
                    throw new Error(`Duplicate test results for ${name}`);
                }
            }
            Object.assign(results, resultLine.testResult);
        }
        if (!Object.keys(results).length) {
            throw new Error("Did not receive any test results from test");
        }

        try {
            for (const [name, result] of Object.entries(results)) {
                const expectation =
                    expectedManifest?.contents?.[name]?.expectation;
                const friendlyText =
                    expectation === "FAIL"
                        ? " (expected failure)"
                        : expectation === "UNSTABLE"
                          ? " (expected unstable)"
                          : "";
                await t.test(`${name}${friendlyText}`, () => {
                    if (expectation === "UNSTABLE") {
                        // if the test is unstable, make no assumptions about the pass/fail state and move on
                        generatedManifest[name] = {
                            expectation: "UNSTABLE",
                        };
                        numUnstableTests += 1;
                    } else if (result.passed) {
                        if (expectation === "FAIL") {
                            throw new Error(
                                "Expected test to fail, but it passed",
                            );
                        }
                    } else {
                        generatedManifest[name] = {
                            expectation: "FAIL",
                        };
                        if (expectation === "FAIL") {
                            numExpectedFailures += 1;
                        } else {
                            throw new Error(result.error);
                        }
                    }
                });
            }
        } finally {
            if (generateManifests) {
                fs.mkdirSync(path.dirname(manifestFilename), {
                    recursive: true,
                });
                if (Object.keys(generatedManifest).length) {
                    fs.writeFileSync(
                        manifestFilename,
                        stringifyManifest(
                            generatedManifest,
                            expectedManifest?.comments,
                        ),
                    );
                } else {
                    // absence of the manifest file means all tests should pass
                    fs.rmSync(manifestFilename, { force: true });
                }
            }
        }
    });
}

process.on("beforeExit", () => {
    // log some additional diagnostics. not attempting to match `node:test`'s output since it varies by reporter
    console.log(`Expected failures: ${numExpectedFailures}`);
    console.log(`Unstable tests: ${numUnstableTests}`);
});
