/* eslint-env node */
module.exports = {
    extends: [
        "eslint:recommended",
        "plugin:@typescript-eslint/recommended",
        "prettier",
    ],
    parser: "@typescript-eslint/parser",
    plugins: ["@typescript-eslint", "eslint-plugin-import"],
    root: true,
    rules: {
        "@typescript-eslint/consistent-type-imports": "error",
        "@typescript-eslint/ban-ts-comment": "off",
        "@typescript-eslint/no-explicit-any": "off",
        "import/extensions": ["error", "always", { checkTypeImports: true }],
        "import/order": [
            "error",
            {
                groups: [
                    "builtin",
                    "external",
                    "parent",
                    "sibling",
                    "index",
                    "type",
                ],
            },
        ],
        "no-constant-condition": ["error", { checkLoops: false }],
    },
};
