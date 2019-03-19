#!/usr/bin/env node

import yargs from "yargs";
import glob from "glob";

import build from "./build.js";
import start from "./start.js";

const log = (title, ...message) => 
    console.log(title, ` ⚙> `, ...message); 

const targets = glob.sync(`CLASS/*.toml`);

yargs.
    command({
        command: `build [targets..]`,
        alias: [ `b` ],
        desc: `Build a [CLASS]`,
        handler: (argv) => {
            const build_targets = argv.targets || targets;
            
            return Promise.all(build_targets.map(build));
        }
    }).

    command({
        command: `ls`,
        desc: `List available [CLASS]`,
        handler: () => {
            log(`AVAILABLE [CLASS]`, targets);
        }
    }).

    command({
        command: `start [targets..]`,
        alias: [ `s` ],
        desc: `Start a [CLASS]`,
        handler: (argv) => {
            const start_targets = argv.targets || targets;

            return Promise.all(start_targets.map(
                (target) => 
                    start(target)
            ));
        }
    }).
    argv;
