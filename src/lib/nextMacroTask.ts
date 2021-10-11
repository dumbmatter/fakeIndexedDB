// This polyfill should probably be removed on a major release.
// Projects requiring this polyfill could then set it up themselves.
import "setimmediate";

type NextMacroTask = (callback: () => void) => void;

let timingFunc: NextMacroTask = setImmediate;

export function setNextMacroTask(func: NextMacroTask) {
    timingFunc = func;
}

export function nextMacroTask(callback: () => void) {
    return timingFunc(callback);
}
