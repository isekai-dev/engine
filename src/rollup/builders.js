import toml from "rollup-plugin-toml";
import alias from 'rollup-plugin-alias';
import svelte from "rollup-plugin-svelte";
import resolve from "rollup-plugin-node-resolve";
import copy from "rollup-plugin-copy-glob";
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
const production = !process.env.ROLLUP_WATCH;

const do_copy = (copyObject) => 
    copy(Object.keys(copyObject).
        map(
            (key) => 
                ({
                    files: key,
                    dest: copyObject[key]
                })
        ));

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
    copy: copyObject = {}
}) => 
    ({
        onwarn: () => {
        },
        input,
        output: {
            sourcemap: `inline`,
            file: output,
            format: `cjs`,
        },
        external,
        plugins: [
            alias({
                isekai: `./MAGIC/isekai.js`
            }),
            glob(),
            replace({
                CODE_VERSION,
            }),
            md(),
            json(),
            do_copy(copyObject),
            toml
        ],
    });

const browser = ({
    input,
    output,
    css: cssPath,
    copy: copyObject,
}) => 
    ({
        onwarn: () => {
        },
        input,
        output: {
            file: output,
            format: `iife`,
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
            alias({
                isekai: `./MAGIC/isekai`
            }),
            glob(),
            cjs({
                include: `node_modules/**`, 
            }),
            json(),
            replace({
                CODE_VERSION,
                CLIENT_VERSION: () => 
                    CLIENT_VERSION
            }),
            toml,
            md(),
            svelte({
                css: (css) => {
                    css.write(cssPath);
                },
            }),
            resolve(),
            production && terser(),
            do_copy(copyObject),
            version({
                path: `./.MAGIC/client.version`,
                version: () => 
                    CLIENT_VERSION
            })
        ]
    });

export default {
    node,
    browser
};