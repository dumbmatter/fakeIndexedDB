require("../support-node");

function invalid_optionalParameters(
    desc,
    params,
    exception = "InvalidAccessError",
) {
    var t = async_test(document.title + " - " + desc);

    createdb(t).onupgradeneeded = function(e) {
        assert_throws(exception, function() {
            e.target.result.createObjectStore("store", params);
        });

        this.done();
    };
}

invalid_optionalParameters("autoInc and empty keyPath", {
    autoIncrement: true,
    keyPath: "",
});
invalid_optionalParameters(
    "autoInc and keyPath array",
    { autoIncrement: true, keyPath: [] },
    "SyntaxError",
);
invalid_optionalParameters("autoInc and keyPath array 2", {
    autoIncrement: true,
    keyPath: ["hey"],
});
invalid_optionalParameters(
    "autoInc and keyPath object",
    { autoIncrement: true, keyPath: { a: "hey", b: 2 } },
    "SyntaxError",
);
