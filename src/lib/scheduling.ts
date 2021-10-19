// When running within Node.js (including jsdom), we want to use setImmediate
// (which runs immediately) rather than setTimeout (which enforces a minimum
// delay of 1ms, and on Windows only has a resolution of 15ms or so).  jsdom
// doesn't provide setImmediate (to better match the browser environment) and
// sandboxes scripts, but its sandbox is by necessity imperfect, so we can break
// out of it:
//
// - https://github.com/jsdom/jsdom#executing-scripts
// - https://github.com/jsdom/jsdom/issues/2729
// - https://github.com/scala-js/scala-js-macrotask-executor/pull/17
function getSetImmediateFromJsdom() {
    if (typeof navigator !== "undefined" && /jsdom/.test(navigator.userAgent)) {
        const outerRealmFunctionConstructor = Node.constructor as any;
        return new outerRealmFunctionConstructor("return setImmediate")();
    } else {
        return undefined;
    }
}

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/globalThis
// Remove this after dropping Node 8 support
var getGlobal = function () {
    if (typeof globalThis !== 'undefined') { return globalThis; }
    if (typeof global !== 'undefined') { return global; }
    if (typeof self !== 'undefined') { return self; }
    if (typeof window !== 'undefined') { return window; }
    throw new Error('unable to locate global object');
};

var globals = getGlobal();

// Schedules a task to run later.  Use Node.js's setImmediate if available and
// setTimeout otherwise.  Note that options like process.nextTick or
// queueMicrotask will likely not work: IndexedDB semantics require that
// transactions are marked as not active when the event loop runs. The next
// tick queue and microtask queue run within the current event loop macrotask,
// so they'd process database operations too quickly.
export const queueTask: (fn: () => void) => void =
    globals.setImmediate ||
    getSetImmediateFromJsdom() ||
    ((fn: () => void) => setTimeout(fn, 0));
