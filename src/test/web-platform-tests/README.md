These tests come from [web-platform-tests](https://github.com/w3c/web-platform-tests/tree/master/IndexedDB), last copied in September 2025 from commit [`2cc8470b689fd1a9131c39bf93c84d7321c65358`](https://github.com/web-platform-tests/wpt/commit/2cc8470b689fd1a9131c39bf93c84d7321c65358).

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

Currently `skip = true` means the file is completely irreelvant (like ones using stuff that can't feasibly run in Node.js like iframes). These files will then be skipped during testing and when updating the Web Platform Tests comparison table in README.md. If we ever need to skip a file for some other reason, we will have to revisit this.

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

Then copy over the relevant IDL files:

```sh
cp path/to/wpt/interfaces/{IndexedDB,html,dom}.idl \
  path/to/fakeIndexedDB/src/test/web-platform-tests/idlharness
```

Then run the `convert.js` script:

```sh
node src/test/web-platform-tests/convert.js
```

Assuming nothing substantial has changed in the structure of the tests, that should be all you have to do.
