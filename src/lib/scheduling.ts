export function queueTask(fn: () => void) {
    queueMicrotask(fn);
}

export function queueTaskForNextEventLoop(fn: () => void) {
    if ("setImmediate" in globalThis) {
        (globalThis as any).setImmediate(fn);
    } else {
        setTimeout(fn, 0);
    }
}
