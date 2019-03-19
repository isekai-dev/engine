import hashbang from "rollup-plugin-hashbang";

export default [
    {
        input: `src/cli.js`,
        output: {
            sourcemap: `inline`,
            file: `BIN/cli.js`,
            format: `cjs`,
        },
        plugins: [ hashbang() ]
    }, {
        input: `src/isekai.js`,
        output: {
            sourcemap: `inline`,
            file: `BIN/isekai.js`,
            format: `cjs`
        }
    }
];
