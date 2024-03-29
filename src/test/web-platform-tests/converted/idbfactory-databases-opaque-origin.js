import "../wpt-env.js";

function load_iframe(src, sandbox) {
    return new Promise((resolve) => {
        const iframe = document.createElement("iframe");
        iframe.onload = () => {
            resolve(iframe);
        };
        if (sandbox) iframe.sandbox = sandbox;
        iframe.srcdoc = src;
        iframe.style.display = "none";
        document.documentElement.appendChild(iframe);
    });
}

function wait_for_message(iframe) {
    return new Promise((resolve) => {
        self.addEventListener("message", function listener(e) {
            if (e.source === iframe.contentWindow) {
                resolve(e.data);
                self.removeEventListener("message", listener);
            }
        });
    });
}

const script =
    "<script>" +
    "  window.onmessage = () => {" +
    "    indexedDB.databases().then(" +
    '      () => window.parent.postMessage({result: "no exception"}, "*"),' +
    '      ex => window.parent.postMessage({result: ex.name}, "*"));' +
    "  };" +
    "</script>";

promise_test(async (t) => {
    const iframe = await load_iframe(script);
    iframe.contentWindow.postMessage({}, "*");
    const message = await wait_for_message(iframe);
    assert_equals(
        message.result,
        "no exception",
        "IDBFactory.databases() should not reject",
    );
}, "IDBFactory.databases() in non-sandboxed iframe should not reject");

promise_test(async (t) => {
    const iframe = await load_iframe(script, "allow-scripts");
    iframe.contentWindow.postMessage({}, "*");
    const message = await wait_for_message(iframe);
    assert_equals(
        message.result,
        "SecurityError",
        "Exception should be SecurityError",
    );
}, "IDBFactory.databases() in sandboxed iframe should reject");
