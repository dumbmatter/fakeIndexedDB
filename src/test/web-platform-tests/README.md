These tests come from [web-platform-tests](https://github.com/w3c/web-platform-tests/tree/master/IndexedDB), last copied in August 2025 from commit [`226fbab4280e1a55cb09cd7a2ba3aa9d88fea53f`](https://github.com/web-platform-tests/wpt/commit/226fbab4280e1a55cb09cd7a2ba3aa9d88fea53f).

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

Tests can be ignored by modifying the list in `run-all.js`. Files can be skipped during conversion by modifying `convert.js`.