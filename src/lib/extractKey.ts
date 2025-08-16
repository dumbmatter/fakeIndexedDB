import { Key, KeyPath, Value } from "./types.js";
import valueToKey from "./valueToKey.js";

// http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#dfn-steps-for-extracting-a-key-from-a-value-using-a-key-path
const extractKey = (
    keyPath: KeyPath,
    value: Value,
):
    | {
          type: "found";
          key: any;
      }
    | {
          type: "notFound";
          key?: undefined; // For convenience, should never be defined
      } => {
    if (Array.isArray(keyPath)) {
        const result: Key[] = [];

        for (let item of keyPath) {
            // This doesn't make sense to me based on the spec, but it is needed to pass the W3C KeyPath tests (see same
            // comment in validateKeyPath)
            if (
                item !== undefined &&
                item !== null &&
                typeof item !== "string" &&
                (item as any).toString
            ) {
                item = (item as any).toString();
            }
            const key = extractKey(item, value).key;
            result.push(valueToKey(key));
        }

        return { type: "found", key: result };
    }

    if (keyPath === "") {
        return { type: "found", key: value };
    }

    let remainingKeyPath: string | null = keyPath;
    let object = value;

    while (remainingKeyPath !== null) {
        let identifier;

        const i = remainingKeyPath.indexOf(".");
        if (i >= 0) {
            identifier = remainingKeyPath.slice(0, i);
            remainingKeyPath = remainingKeyPath.slice(i + 1);
        } else {
            identifier = remainingKeyPath;
            remainingKeyPath = null;
        }

        // special cases: https://w3c.github.io/IndexedDB/#evaluate-a-key-path-on-a-value
        const isSpecialIdentifier =
            (identifier === "length" &&
                (typeof object === "string" || Array.isArray(object))) ||
            ((identifier === "size" || identifier === "type") &&
                typeof Blob !== "undefined" &&
                object instanceof Blob) ||
            ((identifier === "name" || identifier === "lastModified") &&
                typeof File !== "undefined" &&
                object instanceof File);

        if (
            !isSpecialIdentifier &&
            (typeof object !== "object" ||
                object === null ||
                !Object.hasOwn(object, identifier))
        ) {
            return { type: "notFound" };
        }

        object = object[identifier];
    }

    return { type: "found", key: object };
};

export default extractKey;
