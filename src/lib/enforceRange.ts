// https://heycam.github.io/webidl/#EnforceRange

const enforceRange = (
    num: number,
    type: "MAX_SAFE_INTEGER" | "unsigned long",
) => {
    const min = 0;
    const max = type === "unsigned long" ? 4294967295 : 9007199254740991;

    if (isNaN(num) || num < min || num > max) {
        throw new TypeError();
    }
    if (num >= 0) {
        return Math.floor(num);
    }
};

export default enforceRange;
