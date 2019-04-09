import path from "path";

import toml from "rollup-plugin-toml";
import svelte from "rollup-plugin-svelte";
import resolve from "rollup-plugin-node-resolve";

import replace from "rollup-plugin-replace";

import json from "rollup-plugin-json";
import md from "rollup-plugin-commonmark";
import cjs from "rollup-plugin-commonjs";

import { terser } from "rollup-plugin-terser";
import uuid from "uuid/v1";

/*
 * import spritesmith from "rollup-plugin-sprite";
 * import texturePacker from "spritesmith-texturepacker";
 */

import glob from "./plugin-glob.js";
import version from "./version.js";

const CODE_VERSION = uuid();
const production = false;

let CLIENT_VERSION = uuid();

const external = [
    `express`,
    `isekai`,
    `fs`,
    `http`,
    `https`
];

const node = ({
    input,
    output,
}) => ({
    input,
    output: {
        file: output,
        format: `cjs`,
    },
    external,
    plugins: [
        glob(),
        replace({
            CODE_VERSION,
        }),
        md(),
        json(),
        toml
    ],
});

// TODO: Offer up some of these options to the Daemon files
const browser = ({
    input,
    output,
    css: cssPath = `./DATA/public/${path.basename(output, `.js`)}.css`
}) => ({
    input,
    output: {
        file: output,
        format: `iife`,
        globals: {
            "pixi.js": `PIXI`,
        },
    },
    external: [ `uuid`, `uuid/v1`, `pixi.js` ],
    plugins: [
        // // make this a reactive plugin to ".tilemap.json"
        //     spritesmith({
        //         src: {
        //             cwd: "./goblin.life/BROWSER.PIXI/
        //             glob: "**/*.png"
        //         },
        //         target: {
        //             image: "./bin/public/images/sprite.png",
        //             css: "./bin/public/art/default.json"
        //         },
        //         output: {
        //             image: "./bin/public/images/sprite.png"
        //         },
        //         spritesmithOptions: {
        //             padding: 0
        //         },
        //         customTemplate: texturePacker
        //     }),
        glob(),
        resolve(),
        cjs({
            
        }),
        json(),
        replace({
            CODE_VERSION,
            CLIENT_VERSION: () => CLIENT_VERSION
        }),
        toml,
        md(),
        svelte({
            css: (css) => {
                css.write(cssPath);
            },
        }),
        production && terser(),
        version({
            path: `./.BIN/client.version`,
            version: () => CLIENT_VERSION
        })
    ]
});

export default {
    node,
    browser
};