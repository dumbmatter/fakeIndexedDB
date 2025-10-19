import { InvalidStateError } from "./errors.js";
import type FakeEvent from "./FakeEvent.js";
import type {
    EventCallback,
    EventCallbackOrEventCallbackObject,
    EventType,
} from "./types.js";

type EventTypeProp =
    | "onabort"
    | "onblocked"
    | "onclose"
    | "oncomplete"
    | "onerror"
    | "onsuccess"
    | "onupgradeneeded"
    | "onversionchange";

interface Listener {
    callback: EventCallbackOrEventCallbackObject;
    capture: boolean;
    type: EventType;
}

const stopped = (event: FakeEvent, listener: Listener) => {
    return (
        event.immediatePropagationStopped ||
        (event.eventPhase === event.CAPTURING_PHASE &&
            listener.capture === false) ||
        (event.eventPhase === event.BUBBLING_PHASE && listener.capture === true)
    );
};

// http://www.w3.org/TR/dom/#concept-event-listener-invoke
const invokeEventListeners = (event: FakeEvent, obj: FakeEventTarget) => {
    event.currentTarget = obj;

    const errors: Error[] = [];
    const invoke = (callbackOrObject: EventCallbackOrEventCallbackObject) => {
        try {
            const callback =
                typeof callbackOrObject === "function"
                    ? callbackOrObject
                    : callbackOrObject.handleEvent;
            // @ts-expect-error EventCallback's types are not quite right here
            callback.call(event.currentTarget, event);
        } catch (err) {
            errors.push(err);
        }
    };

    // The callback might cause obj.listeners to mutate as we traverse it.
    // Take a copy of the array so that nothing sneaks in and we don't lose
    // our place.
    for (const listener of obj.listeners.slice()) {
        if (event.type !== listener.type || stopped(event, listener)) {
            continue;
        }

        invoke(listener.callback);
    }

    const typeToProp: { [key in EventType]: EventTypeProp } = {
        abort: "onabort",
        blocked: "onblocked",
        close: "onclose",
        complete: "oncomplete",
        error: "onerror",
        success: "onsuccess",
        upgradeneeded: "onupgradeneeded",
        versionchange: "onversionchange",
    };
    const prop = typeToProp[event.type];
    if (prop === undefined) {
        throw new Error(`Unknown event type: "${event.type}"`);
    }

    const callback = event.currentTarget[prop];
    if (callback) {
        const listener = {
            callback,
            capture: false,
            type: event.type,
        };
        if (!stopped(event, listener)) {
            invoke(listener.callback);
        }
    }

    // we want to execute all listeners before deciding if we want to throw, because there could be an error thrown by
    // the first listener, but the second should still be invoked
    if (errors.length) {
        throw new AggregateError(errors);
    }
};

abstract class FakeEventTarget {
    public readonly listeners: Listener[] = [];

    // These will be overridden in individual subclasses and made not readonly
    public readonly onabort: EventCallback | null | undefined;
    public readonly onblocked: EventCallback | null | undefined;
    public readonly onclose: EventCallback | null | undefined;
    public readonly oncomplete: EventCallback | null | undefined;
    public readonly onerror: EventCallback | null | undefined;
    public readonly onsuccess: EventCallback | null | undefined;
    public readonly onupgradeneeded: EventCallback | null | undefined;
    public readonly onversionchange: EventCallback | null | undefined;

    public addEventListener(
        type: EventType,
        callback: EventCallbackOrEventCallbackObject,
        options?: boolean | AddEventListenerOptions | undefined,
    ) {
        const capture = !!(typeof options === "object" && options
            ? options.capture
            : options);
        this.listeners.push({
            callback,
            capture,
            type,
        });
    }

    public removeEventListener(
        type: EventType,
        callback: EventCallbackOrEventCallbackObject,
        options?: boolean | AddEventListenerOptions | undefined,
    ) {
        const capture = !!(typeof options === "object" && options
            ? options.capture
            : options);
        const i = this.listeners.findIndex((listener) => {
            return (
                listener.type === type &&
                listener.callback === callback &&
                listener.capture === capture
            );
        });

        this.listeners.splice(i, 1);
    }

    // http://www.w3.org/TR/dom/#dispatching-events
    public dispatchEvent(event: FakeEvent) {
        if (event.dispatched || !event.initialized) {
            throw new InvalidStateError("The object is in an invalid state.");
        }
        event.isTrusted = false;

        event.dispatched = true;
        event.target = this;
        // NOT SURE WHEN THIS SHOULD BE SET        event.eventPath = [];

        event.eventPhase = event.CAPTURING_PHASE;
        for (const obj of event.eventPath) {
            if (!event.propagationStopped) {
                invokeEventListeners(event, obj);
            }
        }

        event.eventPhase = event.AT_TARGET;
        if (!event.propagationStopped) {
            invokeEventListeners(event, event.target);
        }

        if (event.bubbles) {
            event.eventPath.reverse();
            event.eventPhase = event.BUBBLING_PHASE;
            for (const obj of event.eventPath) {
                if (!event.propagationStopped) {
                    invokeEventListeners(event, obj);
                }
            }
        }

        event.dispatched = false;
        event.eventPhase = event.NONE;
        event.currentTarget = null;

        if (event.canceled) {
            return false;
        }
        return true;
    }
}

export default FakeEventTarget;
