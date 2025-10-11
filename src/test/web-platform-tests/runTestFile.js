/* global setTimeout, clearTimeout */

import { fork } from "node:child_process";

// Why use this rather than just promisifying the simpler exec function? Because when there is a timeout, exec will not actually kill the child process it creates. This will.
export const runTestFile = async (scriptPath, options = {}) => {
    const { cwd, timeout } = options;

    return new Promise((resolve, reject) => {
        const child = fork(scriptPath, [], {
            cwd,
            silent: true,
        });

        let stdout = "";
        let stderr = "";

        child.stdout.setEncoding("utf8");
        child.stderr.setEncoding("utf8");

        child.stdout.on("data", (chunk) => {
            stdout += chunk;
        });
        child.stderr.on("data", (chunk) => {
            stderr += chunk;
        });

        // This is similar to what exec does when promisified - even if there is some error or timeout, we still want to return stdout and stderror because there may be something useful there
        const augmentError = (error, timeout) => {
            error.stdout = stdout;
            error.stderr = stderr;
            if (timeout) {
                error.timeout = true;
            }
            return error;
        };

        let timeoutErrorHappened = false;

        const timer =
            timeout !== undefined
                ? setTimeout(() => {
                      timeoutErrorHappened = true;
                      child.kill("SIGKILL");
                      reject(
                          augmentError(
                              new Error(`Process timed out after ${timeout}ms`),
                              true,
                          ),
                      );
                  }, timeout)
                : undefined;

        child.on("error", (error) => {
            clearTimeout(timer);
            reject(augmentError(error));
        });

        child.on("exit", (code, signal) => {
            if (!timeoutErrorHappened) {
                clearTimeout(timer);
                if (code === 0) {
                    resolve({ stdout, stderr });
                } else {
                    reject(
                        augmentError(
                            new Error(
                                `Process exited with code ${code} and signal ${signal}`,
                            ),
                        ),
                    );
                }
            }
        });
    });
};
