import toml from "rollup-plugin-toml";
import glob from "./rollup/plugin-glob.js";

import svelte from "rollup-plugin-svelte";
import resolve from "rollup-plugin-node-resolve";
import copy from "rollup-plugin-copy-glob";
import replace from "rollup-plugin-replace";
import spritesmith from "rollup-plugin-sprite";
import json from "rollup-plugin-json";
import md from "rollup-plugin-commonmark";
import cjs from "rollup-plugin-commonjs";

import { terser } from "rollup-plugin-terser";
import uuid from "uuid/v1";
import texturePacker from "spritesmith-texturepacker";

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

const browser = ({
    input,
    output,
    css: cssPath,
    copy: copyObject,
}) => 
    ({
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
                path: `./bin/client.version`,
                version: () => 
                    CLIENT_VERSION
            })
        ]
    });

const node = ({
    input,
    output,
    copy: copyObject = {}
}) => 
    ({
        input,
        output: {
            sourcemap: `inline`,
            file: output,
            format: `cjs`,
        },
        plugins: [
            glob(),
            replace({
                CODE_VERSION,
            }),
            md(),
            do_copy(copyObject),
            toml
        ],
    });

export default {
    node,
    browser
};