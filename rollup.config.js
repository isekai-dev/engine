import hashbang from "rollup-plugin-hashbang";
import glob from "./src/rollup/plugin-glob.js";
import json from "rollup-plugin-json";

export default [
    {
        input: `src/cli.js`,
        output: {
            sourcemap: `inline`,
            file: `.MAGIC/cli.js`,
            format: `cjs`,
        },
        plugins: [ hashbang(), glob(), json() ]
    }, {
        input: `src/isekai.js`,
        output: {
            sourcemap: `inline`,
            file: `.MAGIC/isekai.js`,
            format: `cjs`
        }
    }
];
