import FakeEventTarget from "./FakeEventTarget";
import { EventType } from "./types";

class Event {
    public eventPath: FakeEventTarget[] = [];
    public type: EventType;

    public readonly NONE = 0;
    public readonly CAPTURING_PHASE = 1;
    public readonly AT_TARGET = 2;
    public readonly BUBBLING_PHASE = 3;

    // Flags
    public propagationStopped = false;
    public immediatePropagationStopped = false;
    public canceled = false;
    public initialized = true;
    public dispatched = false;

    public target: FakeEventTarget | null = null;
    public currentTarget: FakeEventTarget | null = null;

    public eventPhase: 0 | 1 | 2 | 3 = 0;

    public defaultPrevented = false;

    public isTrusted = false;
    public timeStamp = Date.now();

    public bubbles: boolean;
    public cancelable: boolean;

    constructor(
        type: EventType,
        eventInitDict: { bubbles?: boolean; cancelable?: boolean } = {},
    ) {
        this.type = type;

        this.bubbles =
            eventInitDict.bubbles !== undefined ? eventInitDict.bubbles : false;
        this.cancelable =
            eventInitDict.cancelable !== undefined
                ? eventInitDict.cancelable
                : false;
    }

    public preventDefault() {
        if (this.cancelable) {
            this.canceled = true;
        }
    }

    public stopPropagation() {
        this.propagationStopped = true;
    }

    public stopImmediatePropagation() {
        this.propagationStopped = true;
        this.immediatePropagationStopped = true;
    }
}

export default Event;
