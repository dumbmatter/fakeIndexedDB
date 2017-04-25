require("../support-node");


var t = async_test(),
    open_rq = createdb(t)

open_rq.onupgradeneeded = function(e) {
    var db = e.target.result

    db.createObjectStore("My cool object store name")
    assert_true(
        db.objectStoreNames.contains("My cool object store name"),
        'objectStoreNames.contains')
}

open_rq.onsuccess = function(e) {
    var db = e.target.result

    assert_true(
        db.objectStoreNames.contains("My cool object store name"),
        'objectStoreNames.contains (in success)')
    t.done()
}

