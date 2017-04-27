require("../support-node");


var t = async_test(),
    open_rq = createdb(t)

open_rq.onupgradeneeded = function(e) {
    var db = e.target.result
    db.createObjectStore("dupe")
    assert_throws(
        'ConstraintError',
        function() { db.createObjectStore("dupe") })

    // Bonus test creating a new objectstore after the exception
    db.createObjectStore("dupe ")
    t.done()
}

