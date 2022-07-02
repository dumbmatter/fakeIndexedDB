# 4.0.0 (beta)

- #23 - TypeScript support! As of version 4, fake-indexeddb includes TypeScript types. As you can see in types.d.ts, it's just using TypeScript's built-in IndexedDB types, rather than generating types from the fake-indexeddb code base. The reason I did this is for compatibility with your application code that may already be using TypeScript's IndexedDB types, so if I used something different for fake-indexeddb, it could lead to spurious type errors. In theory this could lead to other errors if there are differences between Typescript's IndexedDB types and fake-indexeddb's API, but currently I'm not aware of any difference.

- Added support for ES modules in addition to CommonJS modules. That means you can `import` or `require` and it should just work.

- **Breaking change:** The easiest way to use this module is still to import/require `"fake-indexeddb/auto"`. If instead you want to import an individual variable rather than populate the global scope with all of them, previously you would do `const indexedDB = require("fake-indexeddb");` for the main `indexedDB` variable and `const IDBKeyRange = require("fake-indexeddb/lib/FDBKeyRange");` for any of the other IndexedDB variables. In this release, I made everything a named export of the main package, so you can do:

   ```js
   import { indexedDB, IDBKeyRange } from "fake-indexeddb";
   ```

   or

   ```js
   const { indexedDB, IDBKeyRange } from require("fake-indexeddb");
   ```

   For backwards compatibility, the `require("fake-indexeddb/lib/FDBKeyRange")` syntax still is supported, but the new exports of the main module are a breaking change. `indexedDB` is still the default export, but in CommonJS you can't have both default and named exports, so the default export is really just an export named `"default"`. Depending on how you're using it, some tools may be smart enough to figure that out, but some would require you to either switch to a named export or switch to the ES module version.

   Another common issue - if you're using Jest 27 or earlier (latest version as of right now is 28) and include `"fake-indexeddb/auto"` in your `setupFiles` like described in the README here, that may pick up the ESM version of fake-indexeddb, which Jest does not support without [some extra configuration](https://jestjs.io/docs/ecmascript-modules). Change it to `"fake-indexeddb/auto.cjs"` and it will work. Please note that this is only for `setupFiles` config - if you were `require`ing fake-indexeddb directly, that should continue to work fine, except possibly for the aforementioned default export change.

- **Breaking change:** Dropped support for versions of Node.js older than Node 12.

- **Breaking change:** #66 - Removed `Array` properties (like `includes`, `sort`, etc.) from the internal `FakeDOMStringList` class, which is used for parts of IndexedDB that return a `DOMStringList` which is a weird old thing that is kind of like an array but has many fewer properties. As described in #66, leaving that extra `Array` stuff led to the possibility your tests would pass but your application would crash. If you were relying on these non-standard properties in your tests but carefully not using them in your application code, this is a breaking change. This likely affects very few people.

- **Breaking change:** For environments with a built-in `structuredClone` function (such as Node.js 17+), that is used rather than the `realistic-structured-clone` NPM module. There are some differences between the two implementations of the structured cloning algorithm, but probably nothing noticable, and probably all is in the direction of better spec compliance such as [this](https://github.com/dumbmatter/realistic-structured-clone/issues/8) or [this](https://github.com/dumbmatter/realistic-structured-clone/issues/10#issuecomment-966629946). There is also a minor performance increase with the built-in function - the test suite of fake-indexeddb runs about 5% faster.

# 3.1.8 (2022-06-08)

- #74 - Fixed error when adding undefined or null children in indexed objects, by @lukebrody

# 3.1.7 (2021-10-19)

- #71 - Fixed an error when used with jest/jsdom introduced in version 3.1.6.

# 3.1.6 (2021-10-19)

- #70 - Fixed performance regression in the previous version. Thank you @joshkel for figuring this out!

# 3.1.4 (2021-10-11)

- #67 - Fixed compatibility with jsdom by replacing all uses of `setImmedaite` with `setTimeout`.

# 3.1.3 (2021-06-19)

- #65 - Got rid of constructor.name usage, since minifying can break it.

# 3.1.2 (2020-07-21)

- #54 - Fixed a bug where multiple transactions started at the same time could result in a transaction never resolving, if one of the transactions had no database operations inside it. Thank you @medmunds for both finding and fixing this bug!

# 3.1.1 (2020-07-15)

- #53 - Fixed a bug introduced in v3.1.0 where `FDBObjectStore.delete` resulted in an error when given a key range. Possibly a couple other situations with key ranges produced similar errors too.

# 3.1.0 (2020-07-02)

- #52 - Significant performance improvement. 5.5x faster on a real use case. Thank you @nolanlawson for this speed up!

# 3.0.2 (2020-06-10)

- #45 - Fix synchronous event firing in a transaction, which led to a stack overflow when used with Dexie's waitFor function.

# 3.0.1 (2020-05-25)

- #41 - Correctly roll back a record added to a store when an index constraint error occurs.

# 3.0.0 (2019-11-15)

- Stopped importing core-js by default. This means that, for people using fake-indexeddb in really old environments like PhantomJS, they will now need to import core-js like `require("core-js/stable");` (or something similar) before importing fake-indexeddb.

# 2.1.1 (2019-06-05)

- #30 - Fixed typo in the name of the `Event.timeStamp` property.

# 2.1.0 (2019-03-18)

- Added the ability to include `fake-indexeddb/auto` and have it populate all the global variables.
- Added support for `IDBTransaction.commit()` and `IDBFactory.databases()`.
- Fixed a couple minor edge cases to improve performance on the web platform tests from 85% to 87%.

# 2.0.6 (2019-03-14)

- Fixed issue #26, where event handlers were inappropriately not being called if they added or removed other handlers to the invoking listener in their callbacks.

# 2.0.5 (2019-02-07)

- Fixed issue #25 by importing core-js/shim rather than all of core-js.

# 2.0.4 (2018-02-22)

- Improved structured cloning, which fixes bugs when used with strange objects like https://github.com/dumbmatter/realistic-structured-clone/issues/5

# 2.0.3 (2017-05-09)

- Fixed issue #20 related to iterating over cursors with non-unique keys

# 2.0.2 (2017-05-01)

- Include core-js by default to make it work more easily in old environments like PhantomJS

# 2.0.1 (2017-04-29)

- Minor updates to README

# 2.0.0 (2017-04-29)

- Fully implements the [IndexedDB 2.0 API](https://hacks.mozilla.org/2016/10/whats-new-in-indexeddb-2-0/) (which technically still is a draft, but is probably not going to substantially change).
- Ported to TypeScript, which hopefully means less bugs.
- Dynamically runs [the W3C web-platform-tests](https://github.com/w3c/web-platform-tests/tree/master/IndexedDB) rather than using manually ported tests. This means it's easy to run new tests, and the tests written since the original release of fake-indexeddb turned up several minor bugs which have now been fixed. See `npm run test-w3c`.
