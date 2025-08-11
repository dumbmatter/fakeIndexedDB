These tests come from [web-platform-tests](https://github.com/w3c/web-platform-tests/tree/master/IndexedDB), last copied in August 2025 from commit [`226fbab4280e1a55cb09cd7a2ba3aa9d88fea53f`](https://github.com/web-platform-tests/wpt/commit/226fbab4280e1a55cb09cd7a2ba3aa9d88fea53f).

## Running the tests

To run all the tests:

```sh
pnpm run test-w3c
```

To run a subset of the tests:

```sh
node --test --test-name-pattern="name of test" \
    ./src/test/web-platform-tests/run-all.js
```

## Updating test expectations

The test expectations (pass, fail, unstable, skip) are in the `manifests` folder. As you fix tests, you can either remove the `FAIL`/`UNSTABLE`/`skip` lines from the manifest files, or delete the file entirely if the whole thing is passing.

To update all the manifest files at once based on the current test results, run:

```sh
GENERATE_MANIFESTS=1 pnpm run test-w3c
```

If the test results vary by Node version, you can add files in `overrides/node<version>` which will override the default.

## Updating the tests

To update the tests, copy over the `IndexedDB` folder and remove `converted`:

```sh
rm -fr path/to/fakeIndexedDB/src/test/web-platform-tests/IndexedDB
cp -R path/to/wpt/IndexedDB path/to/fakeIndexedDB/src/test/web-platform-tests/IndexedDB
rm -fr path/to/fakeIndexedDB/src/test/web-platform-tests/converted
```

Then run the `convert.js` script:

```sh
node src/test/web-platform-tests/convert.js
```

Assuming nothing substantial has changed in the structure of the tests, that should be all you have to do.

Completely irreelvant test files can be skipped during conversion by modifying `skip` in `convert.js`. Individual tests can be patched there as well if absolutely needed, see the `codeChunks` editing at the bottom of `convert.js`.