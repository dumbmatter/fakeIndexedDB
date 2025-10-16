# Contributing to fake-indexeddb

## Install and build

First, ensure you have [pnpm](https://pnpm.io/) installed. Then:

```sh
pnpm i
pnpm build
```

## Lint and test

```sh
pnpm run lint
pnpm test # run all the tests
pnpm run test-w3c # run just the W3C tests
pnpm run test-mocha # run just the Mocha tests
```

## W3C tests

See the [README.md](./src/test/web-platform-tests/README.md) in the `web-platform-tests` folder.

## Release

When you run `pnpm version` (e.g. `pnpm version patch`), the script `pnpm run update-wpt-results` will also run, which updates the reported browser WPT results and fake-indexedb's results in the README.