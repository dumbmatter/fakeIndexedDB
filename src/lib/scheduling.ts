function getSetImmediateFromJsdom() {
    if (typeof navigator !== "undefined" && /jsdom/.test(navigator.userAgent)) {
        const outerRealmFunctionConstructor = Node.constructor as any;
        return new outerRealmFunctionConstructor("return setImmediate")();
    } else {
        return undefined;
    }
}

export const queueTask: (fn: () => void) => void =
    globalThis.setImmediate ||
    getSetImmediateFromJsdom() ||
    ((fn: () => void) => setTimeout(fn, 0));
