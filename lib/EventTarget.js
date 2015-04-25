module.exports = function () {
    this._listeners = {};

    this.addEventListener = function (type, listener) {
        if (!this._listeners.hasOwnProperty(type)) {
            this._listeners[type] = [];
        }
        this._listeners[type].push(listener);
    };

    this.dispatchEvent = function (event) {
//console.log(event.type, this._listeners, this["on" + event.type]);
        if (this._listeners.hasOwnProperty(event.type)) {
            this._listeners[event.type].forEach(function (listener) {
                listener(event);
            });
        }
        if (this["on" + event.type]) {
            this["on" + event.type](event);
        }
    };

    return this;
};