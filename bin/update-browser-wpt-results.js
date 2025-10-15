// Update the reported WPT results in README.md for the latest browser versions
// Skips WPT runs that are irrelevant to fake-indexeddb
/* global fetch URLSearchParams console */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import * as path from "node:path";

// These tests are skipped due to being fairly irrelevant to Node, e.g. cross-origin tests,
// iframes, workers, etc.
const manifestsDir = path.join(
    import.meta.dirname,
    "../src/test/web-platform-tests/manifests",
);
const skippedTests = new Set(
    readdirSync(manifestsDir, { recursive: true })
        .filter(
            (filename) =>
                filename.endsWith(".toml") &&
                readFileSync(
                    path.join(manifestsDir, filename),
                    "utf-8",
                ).includes("skip = true"),
        )
        .map((filename) => filename.replace(/\.toml$/, ".js")),
);

const runs = await (
    await fetch(
        "https://wpt.fyi/api/runs?" +
            new URLSearchParams(
                Object.entries({
                    labels: "master",
                    product: ["chrome", "firefox", "safari", "ladybird"],
                    max_count: 1,
                })
                    // flatMap to allow for multiple product=foo pairs
                    .flatMap(([key, value]) =>
                        Array.isArray(value)
                            ? value.map((v) => [key, v])
                            : [[key, value]],
                    ),
            ),
    )
).json();

const browsers = runs.map((_) => ({
    name:
        // capitalize
        _.browser_name.substring(0, 1).toUpperCase() +
        _.browser_name.substring(1),
    version: _.browser_version,
}));

const { results: testResults } = await (
    await fetch("https://wpt.fyi/api/search", {
        method: "POST",
        body: JSON.stringify({
            run_ids: runs.map((_) => _.id),
            query: {
                path: "/IndexedDB",
            },
        }),
    })
).json();

const filteredTestResults = testResults
    .filter(({ test }) => {
        // filter tests that are just worker/serviceworker/sharedworker variants of the `.any.html` tests
        return !/\.(worker|serviceworker|sharedworker)\.html$/.test(test);
    })
    .map((result) => {
        // convert to our test naming format
        return {
            ...result,
            test: result.test
                .replace(/^\/IndexedDB\//, "")
                .replace(/\.html$/, ".js"),
        };
    })
    // now that filenames are formatted, filter based on tests we skip
    .filter(({ test }) => !skippedTests.has(test))
    .sort((a, b) => (a.test < b.test ? -1 : 1));

const browserResultsSummaries = browsers.map(({ name, version }, i) => {
    const passed = filteredTestResults
        .map((_) => _.legacy_status[i].passes)
        .reduce((a, b) => a + b, 0);
    const total = filteredTestResults
        .map((_) => _.legacy_status[i].total)
        .reduce((a, b) => a + b, 0);
    return {
        name,
        version,
        passed,
        total,
    };
});

// Each browser might not all have the same number of "total" test passes,
// because some browsers (e.g. Ladybird) crash in certain tests. So use the max
const total = Math.max(...browserResultsSummaries.map((_) => _.total));

let markdownTable =
    "| Implementation | Version | Passed | % |\n" + "| --- ".repeat(4) + " |\n";
for (const { name, version, passed } of browserResultsSummaries) {
    markdownTable += `| ${name} | ${version} | ${passed} | ${Math.round((1000 * passed) / total) / 10}% |\n`;
}

// write markdown table with a placeholder for our results
const readmePath = path.join(import.meta.dirname, "../README.md");
const readme = readFileSync(readmePath, "utf-8")
    .replace(
        /<!-- wpt_results_start -->.*<!-- wpt_results_end -->/s,
        `
<!-- wpt_results_start -->
<!-- wpt_results_total=${total} -->
${markdownTable.trim()}
<!-- fakeindexeddb_wpt_results -->
<!-- wpt_results_end -->
    `.trim(),
    )
    .replace(
        /<!-- last_updated_date_start -->.*?<!-- last_updated_date_end -->/s,
        `
<!-- last_updated_date_start -->${new Date().toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
        })}<!-- last_updated_date_end -->
        `.trim(),
    );
writeFileSync(readmePath, readme, "utf-8");
console.log("Updated README.md with browser test results:");
console.log(markdownTable);
