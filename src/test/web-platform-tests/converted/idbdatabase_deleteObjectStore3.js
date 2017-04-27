require("../support-node");


var t = async_test(),
    open_rq = createdb(t);

open_rq.onupgradeneeded = function(e)
{
    var db = e.target.result;
    assert_throws('NotFoundError',
        function() { db.deleteObjectStore('whatever'); });
    t.done();
}

