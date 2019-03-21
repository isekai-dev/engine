#!/usr/bin/env node

import vorpal from "vorpal";
import commands from "./commands/*.js";
import { version } from "../package.json";

import "./lib/format.js";

import chalk from "chalk";

const v = vorpal();
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

Object.entries(commands).
    forEach(([
        name, {
            help,
            handler,
            autocomplete,
            hidden,
            alias = [],
            cancel = () => {}
        }
    ]) => { 
        const command = v.command(name, help).
            alias(alias).
            autocomplete(autocomplete || []).
            cancel(cancel).
            action(handler);

        if(hidden) {
            command.hidden();
        }
    });

v.delimiter(chalk.bold.green(`>`)).
    show();