class Event {
    constructor(type, eventInitDict = {}) {
        this._eventPath = [];

        // Flags
        this._stopPropagation = false;
        this._stopImmediatePropagation = false;
        this._canceled = false;
        this._initialized = true;
        this._dispatch = false;

        this.type = type;
        this.target = null;
        this.currentTarget = null;

        this.NONE = 0;
        this.CAPTURING_PHASE = 1;
        this.AT_TARGET = 2;
        this.BUBBLING_PHASE = 3;
        this.eventPhase = this.NONE;

        this.bubbles = eventInitDict.bubbles !== undefined ? eventInitDict.bubbles : false;
        this.cancelable = eventInitDict.cancelable !== undefined ? eventInitDict.cancelable : false;
        this.defaultPrevented = false;

        this.isTrusted = false;
        this.timestamp = Date.now();
    }

    preventDefault() {
        if (this.cancelable) {
            this._canceled = true;
        }
    }

    stopPropagation() {
        this._stopPropagation = true;
    }

    stopImmediatePropagation() {
        this._stopPropagation = true;
        this._stopImmediatePropagation = true;
    }
}

module.exports = Event;
