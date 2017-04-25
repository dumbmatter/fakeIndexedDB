require("../../build/global.js");
const {
    add_completion_callback,
    assert_array_equals,
    assert_equals,
    assert_false,
    assert_not_equals,
    assert_throws,
    assert_true,
    async_test,
    createdb,
    createdb_for_multiple_tests,
    fail,
    format_value,
    indexeddb_test,
    setup,
    test,
} = require("../support-node.js");

const document = {};
const window = global;


"use strict";
async_test(function(t) {
  var request = new XMLHttpRequest();
  request.open("GET", "interfaces.idl");
  request.send();
  request.onload = t.step_func(function() {
    var idlArray = new IdlArray();
    var idls = request.responseText;

    // https://html.spec.whatwg.org/multipage/browsers.html#window
    idlArray.add_untested_idls("[PrimaryGlobal] interface Window { };");

    // https://html.spec.whatwg.org/multipage/webappapis.html#windoworworkerglobalscope-mixin
    idlArray.add_untested_idls(`[NoInterfaceObject, Exposed=(Window,Worker)]
                                interface WindowOrWorkerGlobalScope {};`);
    idlArray.add_untested_idls("Window implements WindowOrWorkerGlobalScope;");

    // https://dom.spec.whatwg.org/#interface-event
    idlArray.add_untested_idls("[Exposed=(Window,Worker)] interface Event { };");

    // https://dom.spec.whatwg.org/#interface-eventtarget
    idlArray.add_untested_idls("[Exposed=(Window,Worker)] interface EventTarget { };");

    // From Indexed DB:
    idlArray.add_idls(idls);

    idlArray.add_objects({
      IDBCursor: [],
      IDBCursorWithValue: [],
      IDBDatabase: [],
      IDBFactory: ["window.indexedDB"],
      IDBIndex: [],
      IDBKeyRange: ["IDBKeyRange.only(0)"],
      IDBObjectStore: [],
      IDBOpenDBRequest: [],
      IDBRequest: [],
      IDBTransaction: [],
      IDBVersionChangeEvent: ["new IDBVersionChangeEvent('foo')"],
      DOMStringList: [],
    });

    idlArray.test();
    t.done();
  });
});
