import "../wpt-env.js";

test((t) => {
    assert_equals(
        self.indexedDB,
        self.indexedDB,
        "Attribute should yield the same object each time",
    );
}, "indexedDB is [SameObject]");
