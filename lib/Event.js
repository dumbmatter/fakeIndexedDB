module.exports = function () {
    this.type = null;
    this.target = null;

    this.timestamp = Date.now();

    this.stopPropagation = function () {};
    this.preventDefault = function () {};

    return this;
};