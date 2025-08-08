export default function isSharedArrayBuffer(
    input: any,
): input is SharedArrayBuffer {
    return (
        typeof SharedArrayBuffer !== "undefined" &&
        input instanceof SharedArrayBuffer
    );
}
