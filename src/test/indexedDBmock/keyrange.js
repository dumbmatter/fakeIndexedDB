
QUnit.module("KeyRange");
QUnit.test("only - number", function (assert) {
    var value = 1;
    assert.expect(4);

    var keyRange = KeyRange.only(value);

    assert.equal(keyRange.lower, value, "lower: " + keyRange.lower);
    assert.equal(keyRange.upper, value, "upper: " + keyRange.upper);
    assert.equal(keyRange.lowerOpen, false, "lowerOpen: " + keyRange.lowerOpen);
    assert.equal(keyRange.upperOpen, false, "upperOpen: " + keyRange.upperOpen);
});
QUnit.test("only - date", function (assert) {
    var value = new Date();
    assert.expect(4);

    var keyRange = KeyRange.only(value);

    assert.deepEqual(keyRange.lower, value, "lower: " + keyRange.lower);
    assert.deepEqual(keyRange.upper, value, "upper: " + keyRange.upper);
    assert.equal(keyRange.lowerOpen, false, "lowerOpen: " + keyRange.lowerOpen);
    assert.equal(keyRange.upperOpen, false, "upperOpen: " + keyRange.upperOpen);
});
QUnit.test("only - string", function (assert) {
    var value = "1";
    assert.expect(4);

    var keyRange = KeyRange.only(value);

    assert.deepEqual(keyRange.lower, value, "lower: " + keyRange.lower);
    assert.deepEqual(keyRange.upper, value, "upper: " + keyRange.upper);
    assert.equal(keyRange.lowerOpen, false, "lowerOpen: " + keyRange.lowerOpen);
    assert.equal(keyRange.upperOpen, false, "upperOpen: " + keyRange.upperOpen);
});
QUnit.test("only - array", function (assert) {
    var value = [1,"1",new Date()];
    assert.expect(4);

    var keyRange = KeyRange.only(value);

    assert.deepEqual(keyRange.lower, value, "lower: " + keyRange.lower);
    assert.deepEqual(keyRange.upper, value, "upper: " + keyRange.upper);
    assert.equal(keyRange.lowerOpen, false, "lowerOpen: " + keyRange.lowerOpen);
    assert.equal(keyRange.upperOpen, false, "upperOpen: " + keyRange.upperOpen);
});
QUnit.test("only - invalid key", function (assert) {
    var value = {};
    assert.expect(1);

    try{
        var keyRange = KeyRange.only(value);
    }
    catch(ex){
        assert.equal(ex.name, "DataError", "DataError");
    }
});
QUnit.test("lowerBound", function (assert) {
    var value = 1;
    assert.expect(4);

    var keyRange = KeyRange.lowerBound(value);

    assert.equal(keyRange.lower, value, "lower: " + keyRange.lower);
    assert.equal(keyRange.upper, undefined, "upper: " + keyRange.upper);
    assert.equal(keyRange.lowerOpen, false, "lowerOpen: " + keyRange.lowerOpen);
    assert.equal(keyRange.upperOpen, true, "upperOpen: " + keyRange.upperOpen);
});
QUnit.test("lowerBound - value inclusieve", function (assert) {
    var value = 1;
    assert.expect(4);

    var keyRange = KeyRange.lowerBound(value, false);

    assert.equal(keyRange.lower, value, "lower: " + keyRange.lower);
    assert.equal(keyRange.upper, undefined, "upper: " + keyRange.upper);
    assert.equal(keyRange.lowerOpen, false, "lowerOpen: " + keyRange.lowerOpen);
    assert.equal(keyRange.upperOpen, true, "upperOpen: " + keyRange.upperOpen);
});
QUnit.test("lowerBound - value exclusieve", function (assert) {
    var value = 1;
    assert.expect(4);

    var keyRange = KeyRange.lowerBound(value, true);

    assert.equal(keyRange.lower, value, "lower: " + keyRange.lower);
    assert.equal(keyRange.upper, undefined, "upper: " + keyRange.upper);
    assert.equal(keyRange.lowerOpen, true, "lowerOpen: " + keyRange.lowerOpen);
    assert.equal(keyRange.upperOpen, true, "upperOpen: " + keyRange.upperOpen);
});
QUnit.test("lowerBound - invalid key", function (assert) {
    var value = {};
    assert.expect(1);

    try{
        var keyRange = KeyRange.lowerBound(value);
    }
    catch(ex){
        assert.equal(ex.name, "DataError", "DataError");
    }
});
QUnit.test("upperBound", function (assert) {
    var value = 1;
    assert.expect(4);

    var keyRange = KeyRange.upperBound(value);

    assert.equal(keyRange.lower, undefined, "lower: " + keyRange.lower);
    assert.equal(keyRange.upper, value, "upper: " + keyRange.upper);
    assert.equal(keyRange.lowerOpen, true, "lowerOpen: " + keyRange.lowerOpen);
    assert.equal(keyRange.upperOpen, false, "upperOpen: " + keyRange.upperOpen);
});
QUnit.test("upperBound - value inclusieve", function (assert) {
    var value = 1;
    assert.expect(4);

    var keyRange = KeyRange.upperBound(value, false);

    assert.equal(keyRange.lower, undefined, "lower: " + keyRange.lower);
    assert.equal(keyRange.upper, value, "upper: " + keyRange.upper);
    assert.equal(keyRange.lowerOpen, true, "lowerOpen: " + keyRange.lowerOpen);
    assert.equal(keyRange.upperOpen, false, "upperOpen: " + keyRange.upperOpen);
});
QUnit.test("upperBound - value exclusieve", function (assert) {
    var value = 1;
    assert.expect(4);

    var keyRange = KeyRange.upperBound(value, true);

    assert.equal(keyRange.lower, undefined, "lower: " + keyRange.lower);
    assert.equal(keyRange.upper, value, "upper: " + keyRange.upper);
    assert.equal(keyRange.lowerOpen, true, "lowerOpen: " + keyRange.lowerOpen);
    assert.equal(keyRange.upperOpen, true, "upperOpen: " + keyRange.upperOpen);
});
QUnit.test("upperBound - invalid key", function (assert) {
    var value = {};
    assert.expect(1);

    try{
        var keyRange = KeyRange.upperBound(value);
    }
    catch(ex){
        assert.equal(ex.name, "DataError", "DataError");
    }
});
QUnit.test("bound", function (assert) {
    var lower = 1;
    var upper = 2;
    assert.expect(4);

    var keyRange = KeyRange.bound(lower, upper);

    assert.equal(keyRange.lower, lower, "lower: " + keyRange.lower);
    assert.equal(keyRange.upper, upper, "upper: " + keyRange.upper);
    assert.equal(keyRange.lowerOpen, false, "lowerOpen: " + keyRange.lowerOpen);
    assert.equal(keyRange.upperOpen, false, "upperOpen: " + keyRange.upperOpen);
});
QUnit.test("bound - lower & upper inclusieve", function (assert) {
    var lower = 1;
    var upper = 2;
    assert.expect(4);

    var keyRange = KeyRange.bound(lower, upper, true, true);

    assert.equal(keyRange.lower, lower, "lower: " + keyRange.lower);
    assert.equal(keyRange.upper, upper, "upper: " + keyRange.upper);
    assert.equal(keyRange.lowerOpen, true, "lowerOpen: " + keyRange.lowerOpen);
    assert.equal(keyRange.upperOpen, true, "upperOpen: " + keyRange.upperOpen);
});
QUnit.test("bound - lower & upper exclusieve", function (assert) {
    var lower = 1;
    var upper = 2;
    assert.expect(4);

    var keyRange = KeyRange.bound(lower, upper, false, false);

    assert.equal(keyRange.lower, lower, "lower: " + keyRange.lower);
    assert.equal(keyRange.upper, upper, "upper: " + keyRange.upper);
    assert.equal(keyRange.lowerOpen, false, "lowerOpen: " + keyRange.lowerOpen);
    assert.equal(keyRange.upperOpen, false, "upperOpen: " + keyRange.upperOpen);
});
QUnit.test("bound - lower inclusieve & upper exclusieve", function (assert) {
    var lower = 1;
    var upper = 2;
    assert.expect(4);

    var keyRange = KeyRange.bound(lower, upper, true, false);

    assert.equal(keyRange.lower, lower, "lower: " + keyRange.lower);
    assert.equal(keyRange.upper, upper, "upper: " + keyRange.upper);
    assert.equal(keyRange.lowerOpen, true, "lowerOpen: " + keyRange.lowerOpen);
    assert.equal(keyRange.upperOpen, false, "upperOpen: " + keyRange.upperOpen);
});
QUnit.test("bound - lower exclusieve & upper inclusieve", function (assert) {
    var lower = 1;
    var upper = 2;
    assert.expect(4);

    var keyRange = KeyRange.bound(lower, upper, false, true);

    assert.equal(keyRange.lower, lower, "lower: " + keyRange.lower);
    assert.equal(keyRange.upper, upper, "upper: " + keyRange.upper);
    assert.equal(keyRange.lowerOpen, false, "lowerOpen: " + keyRange.lowerOpen);
    assert.equal(keyRange.upperOpen, true, "upperOpen: " + keyRange.upperOpen);
});
QUnit.test("bound - invalid key lower", function (assert) {
    var value = {};
    assert.expect(1);

    try{
        var keyRange = KeyRange.bound(value, 1);
    }
    catch(ex){
        assert.equal(ex.name, "DataError", "DataError");
    }
});
QUnit.test("bound - invalid key upper", function (assert) {
    var value = {};
    assert.expect(1);

    try{
        var keyRange = KeyRange.bound(1,value);
    }
    catch(ex){
        assert.equal(ex.name, "DataError", "DataError");
    }
});
QUnit.test("bound - upper smaler then lower", function (assert) {
    var lower = 1;
    var upper = 2;
    assert.expect(1);

    try{
        var keyRange = KeyRange.bound(upper, lower);
    }
    catch(ex){
        assert.equal(ex.name, "DataError", "DataError");
    }
});
QUnit.test("bound - lower == upper and lower & upper exclusieve", function (assert) {
    var lower = 1;
    var upper = 2;
    assert.expect(1);

    try{
        var keyRange = KeyRange.bound(upper, lower);
    }
    catch(ex){
        assert.equal(ex.name, "DataError", "DataError");
    }
});