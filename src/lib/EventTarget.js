const {InvalidStateError} = require('./errors');

const stopped = (event, listener) => {
    return event._stopImmediatePropagation ||
           (event.eventPhase === event.CAPTURING_PHASE && listener.capture === false) ||
           (event.eventPhase === event.BUBBLING_PHASE && listener.capture === true);
};

// http://www.w3.org/TR/dom/#concept-event-listener-invoke
const invokeEventListeners = (event, obj) => {
    event.currentTarget = obj;

    for (const listener of obj._listeners) {
        if (event.type !== listener.type || stopped(event, listener)) {
            continue;
        }

        listener.callback.call(event.currentTarget, event);
    }

    const callback = event.currentTarget[`on${event.type}`];
    if (callback) {
        const listener = {
            type: event.type,
            callback,
            capture: false
        };
        if (!stopped(event, listener)) {
            listener.callback.call(event.currentTarget, event);
        }
    }
};

class EventTarget {
    constructor() {
        this._listeners = [];
    }

    addEventListener(type, callback, capture) {
        if (callback === null) { return; }
        capture = capture !== undefined ? capture : false;

        this._listeners.push({
            type: type,
            callback: callback,
            capture: capture
        });
    }

    removeEventListener(type, callback, capture) {
        capture = capture !== undefined ? capture : false;

        const i = this._listeners.findIndex((listener) => {
            return listener.type === type &&
                   listener.callback === callback &&
                   listener.capture === capture;
        });

        this._listeners.splice(i, 1);
    }

    // http://www.w3.org/TR/dom/#dispatching-events
    dispatchEvent(event) {
        if (event._dispatch || !event._initialized) {
            throw new InvalidStateError('The object is in an invalid state.');
        }
        event._isTrusted = false;

        event._dispatch = true;
        event.target = this;
// NOT SURE WHEN THIS SHOULD BE SET        event._eventPath = [];

        event.eventPhase = event.CAPTURING_PHASE;
        for (const obj of event._eventPath) {
            if (!event._stopPropagation) {
                invokeEventListeners(event, obj);
            }
        }

        event.eventPhase = event.AT_TARGET;
        if (!event._stopPropagation) {
            invokeEventListeners(event, event.target);
        }

        if (event.bubbles) {
            event._eventPath.reverse();
            event.eventPhase = event.BUBBLING_PHASE;
            for (const obj of event._eventPath) {
                if (!event._stopPropagation) {
                    invokeEventListeners(event, obj);
                }
            }
        }

        event._dispatch = false;
        event.eventPhase = event.NONE;
        event.currentTarget = null;

        if (event._canceled) {
            return false;
        }
        return true;
    }
}

module.exports = EventTarget;
