#!/usr/bin/env node

import vorpal from "vorpal";
import commands from "./commands/*.js";
import { version } from "../package.json";

import "./lib/format.js";

import chalk from "chalk";

const v = vorpal();

Object.entries(commands).
    forEach(([
        name, {
            help,
            handler,
            autocomplete,
            hidden,
            command,
            alias = [],
            cancel = () => {}
        }
    ]) => { 
        const ist = v.command(command || name, help).
            alias(alias).
            autocomplete(autocomplete || []).
            cancel(cancel).
            action(handler);

        if(hidden) {
            ist.hidden();
        }
    });

const startup_commands = process.argv.slice(2);

// TODO: isekai create foo instead of isekai "create foo"
startup_commands.reduce((prev, cur) => 
    prev.then(() => 
        v.exec(cur)), Promise.resolve()
).
    then(() => {
        if(startup_commands.length > 0) {
            return;
        }

        process.stdout.write(`\x1Bc`);

        console.log(chalk.green(`
██╗███████╗███████╗██╗  ██╗ █████╗ ██╗      ███████╗███╗   ██╗ ██████╗ ██╗███╗   ██╗███████╗    
██║██╔════╝██╔════╝██║ ██╔╝██╔══██╗██║▄ ██╗▄██╔════╝████╗  ██║██╔════╝ ██║████╗  ██║██╔════╝    
██║███████╗█████╗  █████╔╝ ███████║██║ ████╗█████╗  ██╔██╗ ██║██║  ███╗██║██╔██╗ ██║█████╗      
██║╚════██║██╔══╝  ██╔═██╗ ██╔══██║██║▀╚██╔▀██╔══╝  ██║╚██╗██║██║   ██║██║██║╚██╗██║██╔══╝      
██║███████║███████╗██║  ██╗██║  ██║██║  ╚═╝ ███████╗██║ ╚████║╚██████╔╝██║██║ ╚████║███████╗    
╚═╝╚══════╝╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝      ╚══════╝╚═╝  ╚═══╝ ╚═════╝ ╚═╝╚═╝  ╚═══╝╚══════╝    
VERSION: ${version}                                                                                         
`));

        v.delimiter(chalk.bold.green(`>`)).
            show();
    });

