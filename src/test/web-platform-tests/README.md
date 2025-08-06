These tests come from [web-platform-tests](https://github.com/w3c/web-platform-tests/tree/master/IndexedDB), last copied in March 2023 from commit [`98afc8a86461237414d32da9e6628499c0a0022a`](https://github.com/web-platform-tests/wpt/commit/98afc8a86461237414d32da9e6628499c0a0022a).

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