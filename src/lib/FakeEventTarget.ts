import { InvalidStateError } from "./errors";
import FakeEvent from "./FakeEvent";
import { EventCallback, EventType } from "./types";

type EventTypeProp =
    | "onabort"
    | "onblocked"
    | "oncomplete"
    | "onerror"
    | "onsuccess"
    | "onupgradeneeded"
    | "onversionchange";

interface Listener {
    callback: EventCallback;
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

    // The callback might cause obj.listeners to mutate as we traverse it.
    // Take a copy of the array so that nothing sneaks in and we don't lose
    // our place.
    for (const listener of obj.listeners.slice()) {
        if (event.type !== listener.type || stopped(event, listener)) {
            continue;
        }

        // @ts-ignore
        listener.callback.call(event.currentTarget, event);
    }

    const typeToProp: { [key in EventType]: EventTypeProp } = {
        abort: "onabort",
        blocked: "onblocked",
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
            // @ts-ignore
            listener.callback.call(event.currentTarget, event);
        }
    }
};

abstract class FakeEventTarget {
    public readonly listeners: Listener[] = [];

    // These will be overridden in individual subclasses and made not readonly
    public readonly onabort: EventCallback | null | undefined;
    public readonly onblocked: EventCallback | null | undefined;
    public readonly oncomplete: EventCallback | null | undefined;
    public readonly onerror: EventCallback | null | undefined;
    public readonly onsuccess: EventCallback | null | undefined;
    public readonly onupgradeneeded: EventCallback | null | undefined;
    public readonly onversionchange: EventCallback | null | undefined;

    public addEventListener(
        type: EventType,
        callback: EventCallback,
        capture = false,
    ) {
        this.listeners.push({
            callback,
            capture,
            type,
        });
    }

    public removeEventListener(
        type: EventType,
        callback: EventCallback,
        capture = false,
    ) {
        const i = this.listeners.findIndex(listener => {
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
