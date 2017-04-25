require("../../build/global");
const Event = require("../../build/lib/FakeEvent").default;
const {
    add_completion_callback,
    assert_array_equals,
    assert_equals,
    assert_false,
    assert_key_equals,
    assert_not_equals,
    assert_throws,
    assert_true,
    async_test,
    createdb,
    createdb_for_multiple_tests,
    fail,
    format_value,
    indexeddb_test,
    promise_test,
    setup,
    step_timeout,
    test,
} = require("../support-node");

const document = {};
const window = global;


    function valid_key(desc, key) {
        var db;
        var t = async_test(document.title + " - " + desc);
        var open_rq = createdb(t);

        open_rq.onupgradeneeded = function(e) {
            db = e.target.result;

            store = db.createObjectStore("store");
            assert_true(store.add('value', key) instanceof IDBRequest);

            store2 = db.createObjectStore("store2", { keyPath: ["x", "keypath"] });
            assert_true(store2.add({ x: 'v', keypath: key }) instanceof IDBRequest);
        };
        open_rq.onsuccess = function(e) {
            var rq = db.transaction("store")
                       .objectStore("store")
                       .get(key)
            rq.onsuccess = t.step_func(function(e) {
                assert_equals(e.target.result, 'value')
                var rq = db.transaction("store2")
                           .objectStore("store2")
                           .get(['v', key])
                rq.onsuccess = t.step_func(function(e) {
                    assert_equals(e.target.result.x, 'v');
                    assert_key_equals(e.target.result.keypath, key);
                    t.done()
                })
            })
        }
    }

    // Date
    valid_key( 'new Date()'    , new Date() );
    valid_key( 'new Date(0)'   , new Date(0) );

    // Array
    valid_key( '[]'            , [] );
    valid_key( 'new Array()'   , new Array() );

    valid_key( '["undefined"]' , ['undefined'] );

    // Float
    valid_key( 'Infinity'      , Infinity );
    valid_key( '-Infinity'     , -Infinity );
    valid_key( '0'             , 0 );
    valid_key( '1.5'           , 1.5 );
    valid_key( '3e38'          , 3e38 );
    valid_key( '3e-38'         , 3e38 );

    // String
    valid_key( '"foo"'         , "foo" );
    valid_key( '"\\n"'         , "\n" );
    valid_key( '""'            , "" );
    valid_key( '"\\""'         , "\"" );
    valid_key( '"\\u1234"'     , "\u1234" );
    valid_key( '"\\u0000"'     , "\u0000" );
    valid_key( '"NaN"'         , "NaN" );

