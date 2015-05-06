# Fake IndexedDB [![Build Status](https://travis-ci.org/dumbmatter/fakeIndexedDB.svg?branch=master)](https://travis-ci.org/dumbmatter/fakeIndexedDB)

This is a pure JS in-memory implementation of the IndexedDB API.

It passes [the W3C IndexedDB test suite](https://github.com/w3c/web-platform-tests/tree/master/IndexedDB) plus a few extra (run `npm test` to see).

## Goals:

1. Finish implementing everything cleanly (there are still a few minor issues, see TODO).

2. Run more tests, especially in-browser tests.

3. Start working towards the potential applications listed below.

## Potential applications:

1. Use as a mock database in unit tests.

2. Use the same API in Node.js/io.js and in the browser.

3. Support IndexedDB in old or crappy browsers.

4. Somehow use it within a caching layer on top of IndexedDB in the browser, since IndexedDB can be kind of slow.

5. Abstract the core database functions out, so what is left is a shell that allows the IndexedDB API to easily sit on top of many different backends.

6. Serve as a playground for experimenting with IndexedDB.

## License

Apache 2.0
