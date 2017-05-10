# 2.0.3 (2017-05-09)

* Fixed issue #20 related to iterating over cursors with non-unique keys

# 2.0.2 (2017-05-01)

* Include core-js by default to make it work more easily in old environments like PhantomJS

# 2.0.1 (2017-04-29)

* Minor updates to README

# 2.0.0 (2017-04-29)

* Fully implements the [IndexedDB 2.0 API](https://hacks.mozilla.org/2016/10/whats-new-in-indexeddb-2-0/) (which technically still is a draft, but is probably not going to substantially change).
* Ported to TypeScript, which hopefully means less bugs.
* Dynamically runs [the W3C web-platform-tests](https://github.com/w3c/web-platform-tests/tree/master/IndexedDB) rather than using manually ported tests. This means it's easy to run new tests, and the tests written since the original release of fake-indexeddb turned up several minor bugs which have now been fixed. See `npm run test-w3c`.
