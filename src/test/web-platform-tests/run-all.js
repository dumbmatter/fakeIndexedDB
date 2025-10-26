/* eslint-env node */
import { test } from "node:test";
import path from "node:path";
import * as fs from "node:fs";
import { readFileSync, writeFileSync } from "node:fs";
import { parse, stringify } from "smol-toml";
import { glob } from "glob";
import { runTestFile } from "./runTestFile.js";

const generateManifests = process.env.GENERATE_MANIFESTS;
const writeToReadme = process.env.WRITE_TO_README;

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
    const comments = text.split("\n").filter((line) => line.startsWith("#"));
    return { contents, comments };
}

function stringifyManifest(generatedManifest, comments) {
    return (
        (comments?.length > 0 ? comments.join("\n") + "\n" : "") +
        stringify(generatedManifest)
    );
}

let numExpectedFailures = 0;
let numExpectedTimeouts = 0;
let numUnstableTests = 0;
let numPassedTests = 0;

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
        const { stdout, stderr, timedOut } = await runTestFile(filename, {
            cwd: testFolder,
            timeout,
        });
        if (timedOut) {
            generatedManifest.expectTimeout = true;
        }
        if (stderr) {
            console.error(`stderr: ${stderr}`);
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

        // Skip this error if expectTimeout, because expectTimeout tells us something is wrong with this file. So this error only shows for files that run to completion and contain no test output.
        if (!Object.keys(results).length && !generatedManifest.expectTimeout) {
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
                        numPassedTests += 1;
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

            if (expectedManifest?.contents?.expectTimeout === "UNSTABLE") {
                // If the timeout is unstable, then don't pass/fail based on whether we actually got a timeout or not
                generatedManifest.expectTimeout = "UNSTABLE";
                numExpectedTimeouts += 1;
            } else if (generatedManifest.expectTimeout) {
                if (expectedManifest?.contents?.expectTimeout) {
                    numExpectedTimeouts += 1;
                } else {
                    throw new Error("Test file timed out before completion");
                }
            } else if (expectedManifest?.contents?.expectTimeout) {
                throw new Error(
                    "Expected test file to time out, but it didn't",
                );
            }
        } finally {
            if (generateManifests) {
                fs.mkdirSync(path.dirname(manifestFilename), {
                    recursive: true,
                });
                if (Object.keys(generatedManifest).length) {
                    // Sort to avoid issues where some tests complete before
                    // others in non-deterministic order
                    const sortedGeneratedManifest = Object.fromEntries(
                        Object.keys(generatedManifest)
                            .sort()
                            .map((key) => [key, generatedManifest[key]]),
                    );
                    fs.writeFileSync(
                        manifestFilename,
                        stringifyManifest(
                            sortedGeneratedManifest,
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
    console.log(`Expected timeouts: ${numExpectedTimeouts}`);
    console.log(`Unstable tests: ${numUnstableTests}`);
    console.log(`Passed tests: ${numPassedTests}`);

    // if WRITE_TO_README is set, then update the readme with the results
    if (writeToReadme) {
        const pkgJsonPath = path.join(
            import.meta.dirname,
            "../../../package.json",
        );
        const { version } = JSON.parse(readFileSync(pkgJsonPath, "utf-8"));

        const readmePath = path.join(import.meta.dirname, "../../../README.md");
        const readme = readFileSync(readmePath, "utf-8");
        const total = parseInt(
            readme.match(/<!-- wpt_results_total=(\d+) -->/)[1],
            10,
        );
        const markdownRow = `| fake-indexeddb | ${version} | ${numPassedTests} | ${Math.round((1000 * numPassedTests) / total) / 10}% |`;
        const newReadme = readme.replace(
            /<!-- fakeindexeddb_wpt_results -->/,
            markdownRow,
        );
        writeFileSync(readmePath, newReadme, "utf-8");
        console.log("Wrote markdown to README:");
        console.log(markdownRow);
    }
});
