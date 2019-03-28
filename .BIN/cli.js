#!/usr/bin/env node
'use strict';

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var vorpal = _interopDefault(require('vorpal'));
var fs = _interopDefault(require('fs'));
var path = _interopDefault(require('path'));
var c = _interopDefault(require('chalk'));
var toml = _interopDefault(require('rollup-plugin-toml'));
var svelte = _interopDefault(require('rollup-plugin-svelte'));
var resolve = _interopDefault(require('rollup-plugin-node-resolve'));
var replace = _interopDefault(require('rollup-plugin-replace'));
var json = _interopDefault(require('rollup-plugin-json'));
var md = _interopDefault(require('rollup-plugin-commonmark'));
var cjs = _interopDefault(require('rollup-plugin-commonjs'));
var rollupPluginTerser = require('rollup-plugin-terser');
var uuid = _interopDefault(require('uuid/v1'));
var os = _interopDefault(require('os'));
var glob$1 = _interopDefault(require('glob'));
var md5 = _interopDefault(require('md5'));
var rollupPluginutils = require('rollup-pluginutils');
var toml$1 = _interopDefault(require('toml'));
var rollup = _interopDefault(require('rollup'));
var Git = _interopDefault(require('simple-git/promise'));
var degit = _interopDefault(require('degit'));
var child_process = require('child_process');
var fetch = _interopDefault(require('node-fetch'));
var pm2$1 = _interopDefault(require('pm2'));
var chokidar = _interopDefault(require('chokidar'));

const getFSPrefix = (prefix = process.cwd()) => {
    const parent = path.join(prefix, `..`);
    if (parent === prefix) {
        return prefix;
    }
    
    return getFSPrefix(parent);
};

const fsPrefix = getFSPrefix();
const rootPath = path.join(`/`);

const toURLString = (filePath) => {
    const pathFragments = path.join(filePath).
        replace(fsPrefix, rootPath).
        split(path.sep);
    if (!path.isAbsolute(filePath)) {
        pathFragments.unshift(`.`);
    }
    
    return pathFragments.join(`/`);
};

const resolveName = (from) => 
    from.split(`/`).
        pop().
        split(`.`).
        shift();

var glob = ({ 
    include, 
    exclude 
} = false) => {
    const filter = rollupPluginutils.createFilter(include, exclude);
    
    return {
        name: `rollup-glob`,
        load: (id) => {
            const srcFile = path.join(os.tmpdir(), id);

            let options;
            try {
                options = JSON.parse(fs.readFileSync(srcFile));
            } catch(err) {
                return;
            }

            const { importee, importer } = options;

            const importeeIsAbsolute = path.isAbsolute(importee);
            const cwd = path.dirname(importer);
            const globPattern = importee;

            const files = glob$1.sync(globPattern, {
                cwd
            });

            let code = [ `const res = {};` ];

            files.forEach((file, i) => {
                let from;
                if (importeeIsAbsolute) {
                    from = toURLString(file);
                } else {
                    from = toURLString(path.resolve(cwd, file));
                }
                code.push(`import f${i} from "${from}";`);
                code.push(`res["${resolveName(from)}"] = f${i};`);
            });

            code.push(`export default res;`);

            code = code.join(`\n`);
        
            return code;

        },
        resolveId: (importee, importer) => {
            if (!filter(importee) || !importee.includes(`*`)) {
                return;
            }

            const hash = md5(importee + importer);

            fs.writeFileSync(path.join(os.tmpdir(), hash), JSON.stringify({
                importee,
                importer
            }));

            return hash;
        }
    };
};

var version = ({
    path,
    version
}) => 
    ({
        name: `rollup-write`,
        buildStart: () => {
            fs.writeFileSync(path, version());
        }
    });

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
        sourcemap: `inline`,
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
        production && rollupPluginTerser.terser(),
        version({
            path: `./.BIN/client.version`,
            version: () => CLIENT_VERSION
        })
    ]
});

var builders = {
    node,
    browser
};

// don't really support overrides
const glob_obj = (obj = {}, glob_path) => glob$1.sync(glob_path).
    reduce((obj, equip_path) => {
        const project_name = path.basename(path.resolve(equip_path, `..`, `..`));
        const skill_name = path.basename(equip_path);

        if(obj[skill_name]) {
        // prevents hijacking
            throw new Error(`${skill_name} from ${project_name} overlaps ${obj[skill_name]}`);
        }
    
        return { 
            [skill_name]: path.relative(process.cwd(), path.resolve(equip_path, `..`, `..`)),
            ...obj 
        };
    }, obj);

var get_skills = () => ({
    SKILLS: [
        `./SKILLS/*/`, 
        `./node_modules/*/SKILLS/*/`,
        `./node_modules/@*/*/SKILLS/*/`
    ].reduce(glob_obj, {})
});

const get_config = (configFile) => {
    // verify toml exists
    let raw;

    try {
        raw = fs.readFileSync(configFile, `utf-8`);
    } catch (exception) {
        throw new Error(`Couldn't read ${configFile}. Are you sure this path is correct?`);
    }

    const config = toml$1.parse(raw);

    // has implemented
    if(config.has) {
        return {
            ...config.has.reduce((obj, other_file) => ({
                ...get_config(`./DAEMONS/${other_file}.toml`),
                ...obj
            }), {}), 
            ...config
        };
    }
    
    return config;
};

// Mix Config File in and run these in order
var toml_to_js = (configFile) => Object.values({
    get_skills,

    get_config: ({ configFile }) => ({
        config: get_config(configFile)
    }),
    
    set_names: ({
        configFile,
    }) => {
        const name = path.basename(configFile, `.toml`);

        const package_path = path.dirname(path.resolve(configFile));
        const package_name = package_path.
            split(path.sep).
            pop();

        return {
            package_path,
            package_name,
            name,
        };
    },

    write_entry: ({
        config,
        name,
        SKILLS
    }) => {
        // WRITE OUT FILE
        let entry = ``;
        const type = config.NODE 
            ? `node` 
            : `browser`;

        const write = (data) => {
            entry += `${data}\r\n`;
        };
        
        write(`import isekai from "isekai";`);
        write(`isekai.SET(${JSON.stringify(config)});`);
        write(``);
            
        const fails = [];
        const equiped = Object.keys(config).
            filter((key) => {
                const is_upper = key === key.toUpperCase();
                if(!is_upper) {
                    return false;
                }

                const has_skill = SKILLS[key] !== undefined;

                const is_target = [ `BROWSER`, `NODE` ].indexOf(key) !== -1;

                if(!has_skill && !is_target) {
                    fails.push(key);
                }

                return is_upper && has_skill;
            }).
            map((key) => {
                const where = SKILLS[key] === ``
                    ? `..`
                    : `../${SKILLS[key].split(path.sep).
                        join(`/`)}`;

                write(`import ${key} from "${where}/SKILLS/${key}/${type}.js";`);
            
                return key;
            });
            
        const failed = fails.length > 0
            ? `FAILED TO FIND\r\n${fails.map((f) => `[${f}]`).
                join(` x `)}`
            : ``;

        const keys = equiped.reduce((output, key) => `${output}    ${key},\r\n`, ``);

        write(`
isekai.EQUIP({\r\n${keys}});`);

        const BIN = `.BIN`;
        const input = path.join(BIN, `${name}.entry.js`);
            
        if (!fs.existsSync(BIN)) {
            console.log(`CREATING ${BIN}`);
            fs.mkdirSync(BIN);
        }
        // write out their index.js
        fs.writeFileSync(input, entry, `utf-8`);
            
        console.log(`
[${name}][${type}]

SKILLS
${c.blueBright(equiped.map((e) => `[${e}]`).
        join(` + `))}

${c.red(failed)}
`);

        return {
            input
        };
    },

    run_builders: ({
        input,
        name,
        config,
    }) => {
        if(config.NODE && config.BROWSER) {
            throw new Error(`You cannot target both [NODE] and [BROWSER]`);
        }

        if(config.NODE) {
            const output = `.BIN/${name}.js`;               
            
            return {
                output,
                build_info: builders.node({
                    input,
                    output
                })
            };
        }
        
        if(config.BROWSER) {
            const output = `DATA/public/${name}.js`;

            return {
                output,
                build_info: builders.browser({
                    input,
                    output
                })
            };
        }

        throw new Error(`You must specify either [NODE] or [BROWSER] for your target in your [DAEMON] toml`);
    }
}).
    reduce((state, fn) => ({
        ...state,
        ...fn(state)
    }), { configFile });

var get_list = (exclude = false) => {
    if(!exclude) {
        return glob$1.sync(`./DAEMONS/*.toml`).
            map((class_path) => path.basename(class_path, `.toml`));
    }


    return glob$1.sync(`./DAEMONS/*.toml`).
        filter((daemon) => get_config(daemon).NODE).
        map((class_path) => path.basename(class_path, `.toml`));
};

var filter_list = (classes) => classes.filter((target) => {
    const is_okay = get_list().
        indexOf(target) !== -1;

    if(!is_okay) {
        console.log(`${target} is not an available [DAEMON]`);
    }
        
    return is_okay;
});

var prompt_daemons = ({
    cmd,
    DAEMONS
}) => {
    if(!DAEMONS) {
        return cmd.prompt({
            type: `list`,
            name: `DAEMON`,
            message: `Which [DAEMON]?`,
            choices: [ `all`, ...get_list() ]
        }).
            then(({ DAEMON }) => DAEMON === `all` 
                ? get_list() 
                : filter_list([ DAEMON ]));
    }
    
    if(DAEMONS[0] === `all`) {
        return get_list();
    }

    return filter_list(DAEMONS);
};

var f0 = ({
    command: `build [DAEMONS...]`,
    help: `build all [DAEMON] save(s).`,
    hidden: true,
    async handler({ DAEMONS }) {
        const DAEMONs = await prompt_daemons({ 
            cmd: this,
            DAEMONS 
        });

        const built = await Promise.all(DAEMONs.map(async (target) => {
            const { build_info, name } = await toml_to_js(`./DAEMONS/${target}.toml`);
            const bundle = await rollup.rollup(build_info);

            await bundle.write(build_info.output);
            console.log(`[${name}] Build Complete.\r\n`);
        }));

        console.log(`Built ${built.length} [DAEMON](s).`);
    }
});

const git = Git();

var f1 = ({
    command: `commit [message...]`,
    help: `commit current files to source control`,
    handler: ({
        message = [ `Update, no commit message` ]
    }) => git.add([ `.` ]).
        then(() => git.commit(message.join(` `))).
        then(() => git.push(`origin`, `master`)).
        then(() => console.log(`Commited with message ${message.join(` `)}`))
});

const git$1 = Git();

var f2 = ({
    command: `create [template] [name]`,
    help: `Create a new isekai project from [template] or @isekai/template`,
    alias: [ `init` ],
    options: {
        "-f, --force": `force overwrite from template`
    },
    handler: ({
        template = `isekai-dev/template`,
        name = `.`,
        options: {
            force = false
        } = false
    }) => degit(template, { force }).
        clone(name).
        then(() => git$1.init()).
        then(() => new Promise((resolve, reject) => {
            console.log(`${template} copied to ${name}`);
            console.log(`INSTALLING: THIS MAY TAKE AWHILE`);
            child_process.exec(`npm install`, (err) => {
                if(err) {
                    reject(err);
                }
                resolve();
            });
        })).
        then(() => {
            console.log(`COMPLETE: [run] to start your DAEMONs.`);
        })
});

var f3 = ({
    help: `Show available [DAEMON] saves.`,
    alias: [ `ls`, `saves` ],
    handler: (args, cb) => {
        console.log(get_list().
            map((i) => `[${i}]`).
            join(` - `), `\r\n`);    
            
        cb();
    }
});

// pipe out to pm2

const pm2_path = path.dirname(require.resolve(`pm2`));

var pm2 = ({ commands }) => {
    let node = child_process.spawn(`node`, `${pm2_path}/bin/pm2 ${commands.join(` `)}`.split(` `), {
        cwd: process.cwd(),
        env: process.env,
        stdio: `inherit`
    });

    return {
        done: new Promise((resolve) => {
            node.on(`close`, () => {
                resolve();
                node = false;
            });
        }),

        cancel: () => {
            if(!node) {
                return;
            }
    
            node.kill();
        }   
    };
};

var f4 = ({
    command: `logs [DAEMONS...]`,
    help: `follow the active [DAEMON] logs`,
    handler: ({ DAEMONS = [] }) => pm2({
        commands: [ `logs`, ...DAEMONS ]
    }).done
    
});

const git$2 = Git();

var f5 = ({
    command: `pull`,
    help: `get current files from source control`,
    handler: () => git$2.pull(`origin`, `master`).
        then(() => new Promise((resolve, reject) => {
            child_process.exec(`npm install`, (err) => {
                if(err) {
                    reject(err);
                }
                resolve();
            });
        })).
        then(() => console.log(`Pulled latest from source control.`))
});

// TODO: This should really be exposed by isekai core some how. Like a way to add in tools
var f6 = ({
    command: `push`,
    alias: [ `publish` ],
    async handler() {
        await Promise.all(glob$1.sync(`./DAEMONS/*.toml`).
            map((DAEMON) => {
                const { ADMIN } = get_config(DAEMON);
                if(ADMIN && ADMIN.zalgo) {
                    const { 
                        url = `http://localhost:8080`,
                        zalgo 
                    } = ADMIN;
                    console.log(`PUSHING [${path.basename(DAEMON, `.toml`)}] - ${url}`);

                    return fetch(`${url}/zalgo`, {
                        method: `POST`,
                        cache: `no-cache`,
                        headers: {
                            "Content-Type": `application/json`
                        },
                        body: JSON.stringify({
                            zalgo
                        })
                    });
                }

                return Promise.resolve();
            }));

    }
});

var f7 = ({
    command: `skills`,
    help: `List available skills`,

    handler: () => {
        const {
            SHOP,
            SKILLS
        } = get_skills();

        console.log(`
SHOP
${Object.keys(SHOP).
        map((s) => `[${s}]`).
        join(` = `)}

SKILLS
${Object.keys(SKILLS).
        map((s) => `[${s}]`).
        join(` o `)}
`);
    }
});

var f8 = ({
    commander: `spawn [DAEMONS...]`,
    help: `spawn [DAEMONS] files`,
    hidden: true,
    async handler({ DAEMONS }) {
        const daemons = await prompt_daemons({
            cmd: this,
            DAEMONS
        });

        daemons.forEach((DAEMON) => {
            const {
                output,
            } = toml_to_js(`./DAEMONS/${DAEMON}.toml`);

            // HACK: could name the file of the TOML something gnarly
            pm2$1.start({
                name: DAEMON,
                script: output,
                watch: `./${output}`,
                force: true,
                watch_options: {
                    // yup PM2 was setting a default ignore
                    ignored: ``,
                    usePolling: true
                },
                max_restart: 0
            });
        });

        console.log(`Spawned ${daemons.join(` - `)}`);
    }
});

var action = (
    action_map, 
    reducer = (i) => i
) => (input) => {
    const key = reducer(input);

    if(!action_map[key]) {
        return;
    }

    return action_map[key](input);
};

var f13 = ({
    command: `load [DAEMONS...]`,
    help: `load [DAEMON] saves`,
    alias: [ `regenerate`, `recreate`, `watch` ],
    hidden: true,
    cancel () {
        this.watchers.forEach((watcher) => watcher.close());
        console.log(`YOUR WATCH HAS ENDED`);
    },
    async handler({ DAEMONS }) {
        this.watchers = [];
            
        const DAEMONs = await prompt_daemons({
            cmd: this,
            DAEMONS
        });
        
        DAEMONs.forEach((target) => {
            const file_path = `./DAEMONS/${target}.toml`;

            const data = toml_to_js(file_path);

            const { build_info } = data;
        
            // rebuild on file chagne
            const watcher = chokidar.watch(file_path);
                
            watcher.on(`change`, () => {
                toml_to_js(file_path);
            });
                
            this.watchers.push(watcher);

            const rollup_watcher = rollup.watch({
                ...build_info,
                watch: {
                    clearScreen: true
                }   
            }).
                on(`event`, action({
                    BUNDLE_END: () => {
                        console.log(`[${target}][WATCH] Built.`);
                    },
                    ERROR: (e) => {
                        console.log(e);
                    },
                    FATAL: ({ error }) => {
                        console.error(c.red.bold(error));
                    }
                }, ({ code }) => code 
                ));

            this.watchers.push(rollup_watcher);
        });
    }
});

var f11 = ({
    command: `slay [DAEMONS...]`,
    help: `slay active [DAEMONS]`, 
    alias: [ `unsummon`, `kill`, `slay`, `stop` ],
    cancel() {
        this.canceler();
    },
    
    handler({ DAEMONS = get_list() } = false) {
        const whom = DAEMONS.map((char) => `[${char}]`).
            join(` - `);

        console.log(`SLAYING ${whom}`);

        const { cancel, done } = pm2({
            commands: [ `delete`, `all` ]
        });

        this.canceler = cancel;

        return done;
    }
});

const run_daemons = ({ DAEMONS }) => {
    f13.handler({ DAEMONS });
    f8.handler({ DAEMONS });

    return pm2({
        commands: [ `logs` ]
    }).done;
};

var f9 = ({
    command: `summon [DAEMONS...]`,
    help: `summon and watch [DAEMONS...]`,
    alias: [ `dev`, `start`, `run` ],
    async handler({ DAEMONS }) {
        const DAEMONs = await prompt_daemons({
            cmd: this,
            DAEMONS
        });

        await f11.handler();
        
        return run_daemons({ DAEMONS: DAEMONs });
    },

    cancel() {
        f13.cancel();
    }
});

var f10 = ({
    command: `status [DAEMON]`,
    help: `status of active [DAEMON]s.`,
    alias: [ `ps`, `active`, `stats` ],
    handler: () => pm2({
        commands: [ `ps` ]
    }).done
});

var version$1 = "0.0.13";

var f12 = ({
    command: `version`,
    help: `Version is ${version$1}`,
    handler: () => {
        console.log(version$1);
    }
});

const res = {};
res["build"] = f0;
res["commit"] = f1;
res["create"] = f2;
res["daemons"] = f3;
res["logs"] = f4;
res["pull"] = f5;
res["push"] = f6;
res["skills"] = f7;
res["spawn"] = f8;
res["start"] = f9;
res["status"] = f10;
res["stop"] = f11;
res["version"] = f12;
res["watch"] = f13;

const { log } = console;

console.log = (...args) => log(
    ...args.map(
        (item) => typeof item === `string`
            ? c.green(
                item.replace(/(\[.[^\]\[]*\])/ug, c.bold.white(`$1`))
            )
            : item
    )
);

const v = vorpal();

Object.entries(res).
    forEach(([
        name, {
            help,
            handler,
            autocomplete,
            hidden,
            command,
            alias = [],
            options = {},
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

        Object.entries(options).
            forEach(([ option, option_help ]) => {
                ist.option(option, option_help);
            });
    });

const startup_commands = process.argv.slice(2);

if(startup_commands.length > 0) {
    v.exec(startup_commands.join(` `));
} else {

    process.stdout.write(`\x1Bc`);

    console.log(c.green(`
██╗███████╗███████╗██╗  ██╗ █████╗ ██╗      ███████╗███╗   ██╗ ██████╗ ██╗███╗   ██╗███████╗    
██║██╔════╝██╔════╝██║ ██╔╝██╔══██╗██║▄ ██╗▄██╔════╝████╗  ██║██╔════╝ ██║████╗  ██║██╔════╝    
██║███████╗█████╗  █████╔╝ ███████║██║ ████╗█████╗  ██╔██╗ ██║██║  ███╗██║██╔██╗ ██║█████╗      
██║╚════██║██╔══╝  ██╔═██╗ ██╔══██║██║▀╚██╔▀██╔══╝  ██║╚██╗██║██║   ██║██║██║╚██╗██║██╔══╝      
██║███████║███████╗██║  ██╗██║  ██║██║  ╚═╝ ███████╗██║ ╚████║╚██████╔╝██║██║ ╚████║███████╗    
╚═╝╚══════╝╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝      ╚══════╝╚═╝  ╚═══╝ ╚═════╝ ╚═╝╚═╝  ╚═══╝╚══════╝    
VERSION: ${version$1}                                                                                         
`));

    v.delimiter(c.bold.green(`>`)).
        show();
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2xpLmpzIiwic291cmNlcyI6WyIuLi9zcmMvcm9sbHVwL3BsdWdpbi1nbG9iLmpzIiwiLi4vc3JjL3JvbGx1cC92ZXJzaW9uLmpzIiwiLi4vc3JjL3JvbGx1cC9idWlsZGVycy5qcyIsIi4uL3NyYy9saWIvZ2V0X3NraWxscy5qcyIsIi4uL3NyYy9saWIvZ2V0X2NvbmZpZy5qcyIsIi4uL3NyYy90cmFuc2Zvcm1zL3RvbWxfdG9fanMuanMiLCIuLi9zcmMvbGliL2dldF9saXN0LmpzIiwiLi4vc3JjL2xpYi9maWx0ZXJfbGlzdC5qcyIsIi4uL3NyYy9saWIvcHJvbXB0X2RhZW1vbnMuanMiLCIuLi9zcmMvY29tbWFuZHMvYnVpbGQuanMiLCIuLi9zcmMvY29tbWFuZHMvY29tbWl0LmpzIiwiLi4vc3JjL2NvbW1hbmRzL2NyZWF0ZS5qcyIsIi4uL3NyYy9jb21tYW5kcy9kYWVtb25zLmpzIiwiLi4vc3JjL2xpYi9wbTIuanMiLCIuLi9zcmMvY29tbWFuZHMvbG9ncy5qcyIsIi4uL3NyYy9jb21tYW5kcy9wdWxsLmpzIiwiLi4vc3JjL2NvbW1hbmRzL3B1c2guanMiLCIuLi9zcmMvY29tbWFuZHMvc2tpbGxzLmpzIiwiLi4vc3JjL2NvbW1hbmRzL3NwYXduLmpzIiwiLi4vc3JjL2xpYi9hY3Rpb24uanMiLCIuLi9zcmMvY29tbWFuZHMvd2F0Y2guanMiLCIuLi9zcmMvY29tbWFuZHMvc3RvcC5qcyIsIi4uL3NyYy9jb21tYW5kcy9zdGFydC5qcyIsIi4uL3NyYy9jb21tYW5kcy9zdGF0dXMuanMiLCIuLi9zcmMvY29tbWFuZHMvdmVyc2lvbi5qcyIsIi4uLzRlZTQ5NWZiMTgwZTJiNGE2NWE3YzE1MjYwOThiYjBkIiwiLi4vc3JjL2xpYi9mb3JtYXQuanMiLCIuLi9zcmMvY2xpLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIlxyXG5pbXBvcnQgZnMgZnJvbSBcImZzXCI7XHJcbmltcG9ydCBvcyBmcm9tIFwib3NcIjtcclxuaW1wb3J0IGdsb2IgZnJvbSBcImdsb2JcIjtcclxuaW1wb3J0IHBhdGggZnJvbSBcInBhdGhcIjtcclxuaW1wb3J0IG1kNSBmcm9tIFwibWQ1XCI7XHJcblxyXG5pbXBvcnQgeyBjcmVhdGVGaWx0ZXIgfSBmcm9tIFwicm9sbHVwLXBsdWdpbnV0aWxzXCI7XHJcblxyXG5jb25zdCBnZXRGU1ByZWZpeCA9IChwcmVmaXggPSBwcm9jZXNzLmN3ZCgpKSA9PiB7XHJcbiAgICBjb25zdCBwYXJlbnQgPSBwYXRoLmpvaW4ocHJlZml4LCBgLi5gKTtcclxuICAgIGlmIChwYXJlbnQgPT09IHByZWZpeCkge1xyXG4gICAgICAgIHJldHVybiBwcmVmaXg7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIHJldHVybiBnZXRGU1ByZWZpeChwYXJlbnQpO1xyXG59O1xyXG5cclxuY29uc3QgZnNQcmVmaXggPSBnZXRGU1ByZWZpeCgpO1xyXG5jb25zdCByb290UGF0aCA9IHBhdGguam9pbihgL2ApO1xyXG5cclxuY29uc3QgdG9VUkxTdHJpbmcgPSAoZmlsZVBhdGgpID0+IHtcclxuICAgIGNvbnN0IHBhdGhGcmFnbWVudHMgPSBwYXRoLmpvaW4oZmlsZVBhdGgpLlxyXG4gICAgICAgIHJlcGxhY2UoZnNQcmVmaXgsIHJvb3RQYXRoKS5cclxuICAgICAgICBzcGxpdChwYXRoLnNlcCk7XHJcbiAgICBpZiAoIXBhdGguaXNBYnNvbHV0ZShmaWxlUGF0aCkpIHtcclxuICAgICAgICBwYXRoRnJhZ21lbnRzLnVuc2hpZnQoYC5gKTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgcmV0dXJuIHBhdGhGcmFnbWVudHMuam9pbihgL2ApO1xyXG59O1xyXG5cclxuY29uc3QgcmVzb2x2ZU5hbWUgPSAoZnJvbSkgPT4gXHJcbiAgICBmcm9tLnNwbGl0KGAvYCkuXHJcbiAgICAgICAgcG9wKCkuXHJcbiAgICAgICAgc3BsaXQoYC5gKS5cclxuICAgICAgICBzaGlmdCgpO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgKHsgXHJcbiAgICBpbmNsdWRlLCBcclxuICAgIGV4Y2x1ZGUgXHJcbn0gPSBmYWxzZSkgPT4ge1xyXG4gICAgY29uc3QgZmlsdGVyID0gY3JlYXRlRmlsdGVyKGluY2x1ZGUsIGV4Y2x1ZGUpO1xyXG4gICAgXHJcbiAgICByZXR1cm4ge1xyXG4gICAgICAgIG5hbWU6IGByb2xsdXAtZ2xvYmAsXHJcbiAgICAgICAgbG9hZDogKGlkKSA9PiB7XHJcbiAgICAgICAgICAgIGNvbnN0IHNyY0ZpbGUgPSBwYXRoLmpvaW4ob3MudG1wZGlyKCksIGlkKTtcclxuXHJcbiAgICAgICAgICAgIGxldCBvcHRpb25zO1xyXG4gICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgb3B0aW9ucyA9IEpTT04ucGFyc2UoZnMucmVhZEZpbGVTeW5jKHNyY0ZpbGUpKTtcclxuICAgICAgICAgICAgfSBjYXRjaChlcnIpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgY29uc3QgeyBpbXBvcnRlZSwgaW1wb3J0ZXIgfSA9IG9wdGlvbnM7XHJcblxyXG4gICAgICAgICAgICBjb25zdCBpbXBvcnRlZUlzQWJzb2x1dGUgPSBwYXRoLmlzQWJzb2x1dGUoaW1wb3J0ZWUpO1xyXG4gICAgICAgICAgICBjb25zdCBjd2QgPSBwYXRoLmRpcm5hbWUoaW1wb3J0ZXIpO1xyXG4gICAgICAgICAgICBjb25zdCBnbG9iUGF0dGVybiA9IGltcG9ydGVlO1xyXG5cclxuICAgICAgICAgICAgY29uc3QgZmlsZXMgPSBnbG9iLnN5bmMoZ2xvYlBhdHRlcm4sIHtcclxuICAgICAgICAgICAgICAgIGN3ZFxyXG4gICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgIGxldCBjb2RlID0gWyBgY29uc3QgcmVzID0ge307YCBdO1xyXG4gICAgICAgICAgICBsZXQgaW1wb3J0QXJyYXkgPSBbXTtcclxuXHJcbiAgICAgICAgICAgIGZpbGVzLmZvckVhY2goKGZpbGUsIGkpID0+IHtcclxuICAgICAgICAgICAgICAgIGxldCBmcm9tO1xyXG4gICAgICAgICAgICAgICAgaWYgKGltcG9ydGVlSXNBYnNvbHV0ZSkge1xyXG4gICAgICAgICAgICAgICAgICAgIGZyb20gPSB0b1VSTFN0cmluZyhmaWxlKTtcclxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgZnJvbSA9IHRvVVJMU3RyaW5nKHBhdGgucmVzb2x2ZShjd2QsIGZpbGUpKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGNvZGUucHVzaChgaW1wb3J0IGYke2l9IGZyb20gXCIke2Zyb219XCI7YCk7XHJcbiAgICAgICAgICAgICAgICBjb2RlLnB1c2goYHJlc1tcIiR7cmVzb2x2ZU5hbWUoZnJvbSl9XCJdID0gZiR7aX07YCk7XHJcbiAgICAgICAgICAgICAgICBpbXBvcnRBcnJheS5wdXNoKGZyb20pO1xyXG4gICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgIGNvZGUucHVzaChgZXhwb3J0IGRlZmF1bHQgcmVzO2ApO1xyXG5cclxuICAgICAgICAgICAgY29kZSA9IGNvZGUuam9pbihgXFxuYCk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgICAgIHJldHVybiBjb2RlO1xyXG5cclxuICAgICAgICB9LFxyXG4gICAgICAgIHJlc29sdmVJZDogKGltcG9ydGVlLCBpbXBvcnRlcikgPT4ge1xyXG4gICAgICAgICAgICBpZiAoIWZpbHRlcihpbXBvcnRlZSkgfHwgIWltcG9ydGVlLmluY2x1ZGVzKGAqYCkpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgY29uc3QgaGFzaCA9IG1kNShpbXBvcnRlZSArIGltcG9ydGVyKTtcclxuXHJcbiAgICAgICAgICAgIGZzLndyaXRlRmlsZVN5bmMocGF0aC5qb2luKG9zLnRtcGRpcigpLCBoYXNoKSwgSlNPTi5zdHJpbmdpZnkoe1xyXG4gICAgICAgICAgICAgICAgaW1wb3J0ZWUsXHJcbiAgICAgICAgICAgICAgICBpbXBvcnRlclxyXG4gICAgICAgICAgICB9KSk7XHJcblxyXG4gICAgICAgICAgICByZXR1cm4gaGFzaDtcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG59OyIsImltcG9ydCBmcyBmcm9tIFwiZnNcIjtcclxuXHJcbmV4cG9ydCBkZWZhdWx0ICh7XHJcbiAgICBwYXRoLFxyXG4gICAgdmVyc2lvblxyXG59KSA9PiBcclxuICAgICh7XHJcbiAgICAgICAgbmFtZTogYHJvbGx1cC13cml0ZWAsXHJcbiAgICAgICAgYnVpbGRTdGFydDogKCkgPT4ge1xyXG4gICAgICAgICAgICBmcy53cml0ZUZpbGVTeW5jKHBhdGgsIHZlcnNpb24oKSk7XHJcbiAgICAgICAgfVxyXG4gICAgfSk7IiwiaW1wb3J0IHBhdGggZnJvbSBcInBhdGhcIjtcclxuXHJcbmltcG9ydCB0b21sIGZyb20gXCJyb2xsdXAtcGx1Z2luLXRvbWxcIjtcclxuaW1wb3J0IHN2ZWx0ZSBmcm9tIFwicm9sbHVwLXBsdWdpbi1zdmVsdGVcIjtcclxuaW1wb3J0IHJlc29sdmUgZnJvbSBcInJvbGx1cC1wbHVnaW4tbm9kZS1yZXNvbHZlXCI7XHJcblxyXG5pbXBvcnQgcmVwbGFjZSBmcm9tIFwicm9sbHVwLXBsdWdpbi1yZXBsYWNlXCI7XHJcblxyXG5pbXBvcnQganNvbiBmcm9tIFwicm9sbHVwLXBsdWdpbi1qc29uXCI7XHJcbmltcG9ydCBtZCBmcm9tIFwicm9sbHVwLXBsdWdpbi1jb21tb25tYXJrXCI7XHJcbmltcG9ydCBjanMgZnJvbSBcInJvbGx1cC1wbHVnaW4tY29tbW9uanNcIjtcclxuXHJcbmltcG9ydCB7IHRlcnNlciB9IGZyb20gXCJyb2xsdXAtcGx1Z2luLXRlcnNlclwiO1xyXG5pbXBvcnQgdXVpZCBmcm9tIFwidXVpZC92MVwiO1xyXG5cclxuLypcclxuICogaW1wb3J0IHNwcml0ZXNtaXRoIGZyb20gXCJyb2xsdXAtcGx1Z2luLXNwcml0ZVwiO1xyXG4gKiBpbXBvcnQgdGV4dHVyZVBhY2tlciBmcm9tIFwic3ByaXRlc21pdGgtdGV4dHVyZXBhY2tlclwiO1xyXG4gKi9cclxuXHJcbmltcG9ydCBnbG9iIGZyb20gXCIuL3BsdWdpbi1nbG9iLmpzXCI7XHJcbmltcG9ydCB2ZXJzaW9uIGZyb20gXCIuL3ZlcnNpb24uanNcIjtcclxuXHJcbmNvbnN0IENPREVfVkVSU0lPTiA9IHV1aWQoKTtcclxuY29uc3QgcHJvZHVjdGlvbiA9IGZhbHNlO1xyXG5cclxubGV0IENMSUVOVF9WRVJTSU9OID0gdXVpZCgpO1xyXG5cclxuY29uc3QgZXh0ZXJuYWwgPSBbXHJcbiAgICBgZXhwcmVzc2AsXHJcbiAgICBgaXNla2FpYCxcclxuICAgIGBmc2AsXHJcbiAgICBgaHR0cGAsXHJcbiAgICBgaHR0cHNgXHJcbl07XHJcblxyXG5jb25zdCBub2RlID0gKHtcclxuICAgIGlucHV0LFxyXG4gICAgb3V0cHV0LFxyXG59KSA9PiAoe1xyXG4gICAgaW5wdXQsXHJcbiAgICBvdXRwdXQ6IHtcclxuICAgICAgICBzb3VyY2VtYXA6IGBpbmxpbmVgLFxyXG4gICAgICAgIGZpbGU6IG91dHB1dCxcclxuICAgICAgICBmb3JtYXQ6IGBjanNgLFxyXG4gICAgfSxcclxuICAgIGV4dGVybmFsLFxyXG4gICAgcGx1Z2luczogW1xyXG4gICAgICAgIGdsb2IoKSxcclxuICAgICAgICByZXBsYWNlKHtcclxuICAgICAgICAgICAgQ09ERV9WRVJTSU9OLFxyXG4gICAgICAgIH0pLFxyXG4gICAgICAgIG1kKCksXHJcbiAgICAgICAganNvbigpLFxyXG4gICAgICAgIHRvbWxcclxuICAgIF0sXHJcbn0pO1xyXG5cclxuLy8gVE9ETzogT2ZmZXIgdXAgc29tZSBvZiB0aGVzZSBvcHRpb25zIHRvIHRoZSBEYWVtb24gZmlsZXNcclxuY29uc3QgYnJvd3NlciA9ICh7XHJcbiAgICBpbnB1dCxcclxuICAgIG91dHB1dCxcclxuICAgIGNzczogY3NzUGF0aCA9IGAuL0RBVEEvcHVibGljLyR7cGF0aC5iYXNlbmFtZShvdXRwdXQsIGAuanNgKX0uY3NzYFxyXG59KSA9PiAoe1xyXG4gICAgaW5wdXQsXHJcbiAgICBvdXRwdXQ6IHtcclxuICAgICAgICBmaWxlOiBvdXRwdXQsXHJcbiAgICAgICAgZm9ybWF0OiBgaWlmZWAsXHJcbiAgICAgICAgZ2xvYmFsczoge1xyXG4gICAgICAgICAgICBcInBpeGkuanNcIjogYFBJWElgLFxyXG4gICAgICAgIH0sXHJcbiAgICB9LFxyXG4gICAgZXh0ZXJuYWw6IFsgYHV1aWRgLCBgdXVpZC92MWAsIGBwaXhpLmpzYCBdLFxyXG4gICAgcGx1Z2luczogW1xyXG4gICAgICAgIC8vIC8vIG1ha2UgdGhpcyBhIHJlYWN0aXZlIHBsdWdpbiB0byBcIi50aWxlbWFwLmpzb25cIlxyXG4gICAgICAgIC8vICAgICBzcHJpdGVzbWl0aCh7XHJcbiAgICAgICAgLy8gICAgICAgICBzcmM6IHtcclxuICAgICAgICAvLyAgICAgICAgICAgICBjd2Q6IFwiLi9nb2JsaW4ubGlmZS9CUk9XU0VSLlBJWEkvXHJcbiAgICAgICAgLy8gICAgICAgICAgICAgZ2xvYjogXCIqKi8qLnBuZ1wiXHJcbiAgICAgICAgLy8gICAgICAgICB9LFxyXG4gICAgICAgIC8vICAgICAgICAgdGFyZ2V0OiB7XHJcbiAgICAgICAgLy8gICAgICAgICAgICAgaW1hZ2U6IFwiLi9iaW4vcHVibGljL2ltYWdlcy9zcHJpdGUucG5nXCIsXHJcbiAgICAgICAgLy8gICAgICAgICAgICAgY3NzOiBcIi4vYmluL3B1YmxpYy9hcnQvZGVmYXVsdC5qc29uXCJcclxuICAgICAgICAvLyAgICAgICAgIH0sXHJcbiAgICAgICAgLy8gICAgICAgICBvdXRwdXQ6IHtcclxuICAgICAgICAvLyAgICAgICAgICAgICBpbWFnZTogXCIuL2Jpbi9wdWJsaWMvaW1hZ2VzL3Nwcml0ZS5wbmdcIlxyXG4gICAgICAgIC8vICAgICAgICAgfSxcclxuICAgICAgICAvLyAgICAgICAgIHNwcml0ZXNtaXRoT3B0aW9uczoge1xyXG4gICAgICAgIC8vICAgICAgICAgICAgIHBhZGRpbmc6IDBcclxuICAgICAgICAvLyAgICAgICAgIH0sXHJcbiAgICAgICAgLy8gICAgICAgICBjdXN0b21UZW1wbGF0ZTogdGV4dHVyZVBhY2tlclxyXG4gICAgICAgIC8vICAgICB9KSxcclxuICAgICAgICBnbG9iKCksXHJcbiAgICAgICAgcmVzb2x2ZSgpLFxyXG4gICAgICAgIGNqcyh7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgIH0pLFxyXG4gICAgICAgIGpzb24oKSxcclxuICAgICAgICByZXBsYWNlKHtcclxuICAgICAgICAgICAgQ09ERV9WRVJTSU9OLFxyXG4gICAgICAgICAgICBDTElFTlRfVkVSU0lPTjogKCkgPT4gQ0xJRU5UX1ZFUlNJT05cclxuICAgICAgICB9KSxcclxuICAgICAgICB0b21sLFxyXG4gICAgICAgIG1kKCksXHJcbiAgICAgICAgc3ZlbHRlKHtcclxuICAgICAgICAgICAgY3NzOiAoY3NzKSA9PiB7XHJcbiAgICAgICAgICAgICAgICBjc3Mud3JpdGUoY3NzUGF0aCk7XHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgfSksXHJcbiAgICAgICAgcHJvZHVjdGlvbiAmJiB0ZXJzZXIoKSxcclxuICAgICAgICB2ZXJzaW9uKHtcclxuICAgICAgICAgICAgcGF0aDogYC4vLkJJTi9jbGllbnQudmVyc2lvbmAsXHJcbiAgICAgICAgICAgIHZlcnNpb246ICgpID0+IENMSUVOVF9WRVJTSU9OXHJcbiAgICAgICAgfSlcclxuICAgIF1cclxufSk7XHJcblxyXG5leHBvcnQgZGVmYXVsdCB7XHJcbiAgICBub2RlLFxyXG4gICAgYnJvd3NlclxyXG59OyIsImltcG9ydCBwYXRoIGZyb20gXCJwYXRoXCI7XHJcbmltcG9ydCBnbG9iIGZyb20gXCJnbG9iXCI7XHJcblxyXG4vLyBkb24ndCByZWFsbHkgc3VwcG9ydCBvdmVycmlkZXNcclxuY29uc3QgZ2xvYl9vYmogPSAob2JqID0ge30sIGdsb2JfcGF0aCkgPT4gZ2xvYi5zeW5jKGdsb2JfcGF0aCkuXHJcbiAgICByZWR1Y2UoKG9iaiwgZXF1aXBfcGF0aCkgPT4ge1xyXG4gICAgICAgIGNvbnN0IHByb2plY3RfbmFtZSA9IHBhdGguYmFzZW5hbWUocGF0aC5yZXNvbHZlKGVxdWlwX3BhdGgsIGAuLmAsIGAuLmApKTtcclxuICAgICAgICBjb25zdCBza2lsbF9uYW1lID0gcGF0aC5iYXNlbmFtZShlcXVpcF9wYXRoKTtcclxuXHJcbiAgICAgICAgaWYob2JqW3NraWxsX25hbWVdKSB7XHJcbiAgICAgICAgLy8gcHJldmVudHMgaGlqYWNraW5nXHJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgJHtza2lsbF9uYW1lfSBmcm9tICR7cHJvamVjdF9uYW1lfSBvdmVybGFwcyAke29ialtza2lsbF9uYW1lXX1gKTtcclxuICAgICAgICB9XHJcbiAgICBcclxuICAgICAgICByZXR1cm4geyBcclxuICAgICAgICAgICAgW3NraWxsX25hbWVdOiBwYXRoLnJlbGF0aXZlKHByb2Nlc3MuY3dkKCksIHBhdGgucmVzb2x2ZShlcXVpcF9wYXRoLCBgLi5gLCBgLi5gKSksXHJcbiAgICAgICAgICAgIC4uLm9iaiBcclxuICAgICAgICB9O1xyXG4gICAgfSwgb2JqKTtcclxuXHJcbmV4cG9ydCBkZWZhdWx0ICgpID0+ICh7XHJcbiAgICBTS0lMTFM6IFtcclxuICAgICAgICBgLi9TS0lMTFMvKi9gLCBcclxuICAgICAgICBgLi9ub2RlX21vZHVsZXMvKi9TS0lMTFMvKi9gLFxyXG4gICAgICAgIGAuL25vZGVfbW9kdWxlcy9AKi8qL1NLSUxMUy8qL2BcclxuICAgIF0ucmVkdWNlKGdsb2Jfb2JqLCB7fSlcclxufSk7XHJcbiIsImltcG9ydCB0b21sIGZyb20gXCJ0b21sXCI7XHJcbmltcG9ydCBmcyBmcm9tIFwiZnNcIjtcclxuXHJcbmNvbnN0IGdldF9jb25maWcgPSAoY29uZmlnRmlsZSkgPT4ge1xyXG4gICAgLy8gdmVyaWZ5IHRvbWwgZXhpc3RzXHJcbiAgICBsZXQgcmF3O1xyXG5cclxuICAgIHRyeSB7XHJcbiAgICAgICAgcmF3ID0gZnMucmVhZEZpbGVTeW5jKGNvbmZpZ0ZpbGUsIGB1dGYtOGApO1xyXG4gICAgfSBjYXRjaCAoZXhjZXB0aW9uKSB7XHJcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBDb3VsZG4ndCByZWFkICR7Y29uZmlnRmlsZX0uIEFyZSB5b3Ugc3VyZSB0aGlzIHBhdGggaXMgY29ycmVjdD9gKTtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBjb25maWcgPSB0b21sLnBhcnNlKHJhdyk7XHJcblxyXG4gICAgLy8gaGFzIGltcGxlbWVudGVkXHJcbiAgICBpZihjb25maWcuaGFzKSB7XHJcbiAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgLi4uY29uZmlnLmhhcy5yZWR1Y2UoKG9iaiwgb3RoZXJfZmlsZSkgPT4gKHtcclxuICAgICAgICAgICAgICAgIC4uLmdldF9jb25maWcoYC4vREFFTU9OUy8ke290aGVyX2ZpbGV9LnRvbWxgKSxcclxuICAgICAgICAgICAgICAgIC4uLm9ialxyXG4gICAgICAgICAgICB9KSwge30pLCBcclxuICAgICAgICAgICAgLi4uY29uZmlnXHJcbiAgICAgICAgfTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgcmV0dXJuIGNvbmZpZztcclxufTtcclxuXHJcbmV4cG9ydCBkZWZhdWx0IGdldF9jb25maWc7XHJcbiIsImltcG9ydCBmcyBmcm9tIFwiZnNcIjtcclxuaW1wb3J0IHBhdGggZnJvbSBcInBhdGhcIjtcclxuXHJcbmltcG9ydCBjIGZyb20gXCJjaGFsa1wiO1xyXG5pbXBvcnQgYnVpbGRlcnMgZnJvbSBcIi4uL3JvbGx1cC9idWlsZGVycy5qc1wiO1xyXG5pbXBvcnQgZ2V0X3NraWxscyBmcm9tIFwiLi4vbGliL2dldF9za2lsbHMuanNcIjtcclxuaW1wb3J0IGdldF9jb25maWcgZnJvbSBcIi4uL2xpYi9nZXRfY29uZmlnLmpzXCI7XHJcblxyXG4vLyBNaXggQ29uZmlnIEZpbGUgaW4gYW5kIHJ1biB0aGVzZSBpbiBvcmRlclxyXG5leHBvcnQgZGVmYXVsdCAoY29uZmlnRmlsZSkgPT4gT2JqZWN0LnZhbHVlcyh7XHJcbiAgICBnZXRfc2tpbGxzLFxyXG5cclxuICAgIGdldF9jb25maWc6ICh7IGNvbmZpZ0ZpbGUgfSkgPT4gKHtcclxuICAgICAgICBjb25maWc6IGdldF9jb25maWcoY29uZmlnRmlsZSlcclxuICAgIH0pLFxyXG4gICAgXHJcbiAgICBzZXRfbmFtZXM6ICh7XHJcbiAgICAgICAgY29uZmlnRmlsZSxcclxuICAgIH0pID0+IHtcclxuICAgICAgICBjb25zdCBuYW1lID0gcGF0aC5iYXNlbmFtZShjb25maWdGaWxlLCBgLnRvbWxgKTtcclxuXHJcbiAgICAgICAgY29uc3QgcGFja2FnZV9wYXRoID0gcGF0aC5kaXJuYW1lKHBhdGgucmVzb2x2ZShjb25maWdGaWxlKSk7XHJcbiAgICAgICAgY29uc3QgcGFja2FnZV9uYW1lID0gcGFja2FnZV9wYXRoLlxyXG4gICAgICAgICAgICBzcGxpdChwYXRoLnNlcCkuXHJcbiAgICAgICAgICAgIHBvcCgpO1xyXG5cclxuICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICBwYWNrYWdlX3BhdGgsXHJcbiAgICAgICAgICAgIHBhY2thZ2VfbmFtZSxcclxuICAgICAgICAgICAgbmFtZSxcclxuICAgICAgICB9O1xyXG4gICAgfSxcclxuXHJcbiAgICB3cml0ZV9lbnRyeTogKHtcclxuICAgICAgICBjb25maWcsXHJcbiAgICAgICAgbmFtZSxcclxuICAgICAgICBTS0lMTFNcclxuICAgIH0pID0+IHtcclxuICAgICAgICAvLyBXUklURSBPVVQgRklMRVxyXG4gICAgICAgIGxldCBlbnRyeSA9IGBgO1xyXG4gICAgICAgIGNvbnN0IHR5cGUgPSBjb25maWcuTk9ERSBcclxuICAgICAgICAgICAgPyBgbm9kZWAgXHJcbiAgICAgICAgICAgIDogYGJyb3dzZXJgO1xyXG5cclxuICAgICAgICBjb25zdCB3cml0ZSA9IChkYXRhKSA9PiB7XHJcbiAgICAgICAgICAgIGVudHJ5ICs9IGAke2RhdGF9XFxyXFxuYDtcclxuICAgICAgICB9O1xyXG4gICAgICAgIFxyXG4gICAgICAgIHdyaXRlKGBpbXBvcnQgaXNla2FpIGZyb20gXCJpc2VrYWlcIjtgKTtcclxuICAgICAgICB3cml0ZShgaXNla2FpLlNFVCgke0pTT04uc3RyaW5naWZ5KGNvbmZpZyl9KTtgKTtcclxuICAgICAgICB3cml0ZShgYCk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgIGNvbnN0IGZhaWxzID0gW107XHJcbiAgICAgICAgY29uc3QgZXF1aXBlZCA9IE9iamVjdC5rZXlzKGNvbmZpZykuXHJcbiAgICAgICAgICAgIGZpbHRlcigoa2V5KSA9PiB7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBpc191cHBlciA9IGtleSA9PT0ga2V5LnRvVXBwZXJDYXNlKCk7XHJcbiAgICAgICAgICAgICAgICBpZighaXNfdXBwZXIpIHtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgY29uc3QgaGFzX3NraWxsID0gU0tJTExTW2tleV0gIT09IHVuZGVmaW5lZDtcclxuXHJcbiAgICAgICAgICAgICAgICBjb25zdCBpc190YXJnZXQgPSBbIGBCUk9XU0VSYCwgYE5PREVgIF0uaW5kZXhPZihrZXkpICE9PSAtMTtcclxuXHJcbiAgICAgICAgICAgICAgICBpZighaGFzX3NraWxsICYmICFpc190YXJnZXQpIHtcclxuICAgICAgICAgICAgICAgICAgICBmYWlscy5wdXNoKGtleSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGlzX3VwcGVyICYmIGhhc19za2lsbDtcclxuICAgICAgICAgICAgfSkuXHJcbiAgICAgICAgICAgIG1hcCgoa2V5KSA9PiB7XHJcbiAgICAgICAgICAgICAgICBjb25zdCB3aGVyZSA9IFNLSUxMU1trZXldID09PSBgYFxyXG4gICAgICAgICAgICAgICAgICAgID8gYC4uYFxyXG4gICAgICAgICAgICAgICAgICAgIDogYC4uLyR7U0tJTExTW2tleV0uc3BsaXQocGF0aC5zZXApLlxyXG4gICAgICAgICAgICAgICAgICAgICAgICBqb2luKGAvYCl9YDtcclxuXHJcbiAgICAgICAgICAgICAgICB3cml0ZShgaW1wb3J0ICR7a2V5fSBmcm9tIFwiJHt3aGVyZX0vU0tJTExTLyR7a2V5fS8ke3R5cGV9LmpzXCI7YCk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGtleTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgIGNvbnN0IGZhaWxlZCA9IGZhaWxzLmxlbmd0aCA+IDBcclxuICAgICAgICAgICAgPyBgRkFJTEVEIFRPIEZJTkRcXHJcXG4ke2ZhaWxzLm1hcCgoZikgPT4gYFske2Z9XWApLlxyXG4gICAgICAgICAgICAgICAgam9pbihgIHggYCl9YFxyXG4gICAgICAgICAgICA6IGBgO1xyXG5cclxuICAgICAgICBjb25zdCBrZXlzID0gZXF1aXBlZC5yZWR1Y2UoKG91dHB1dCwga2V5KSA9PiBgJHtvdXRwdXR9ICAgICR7a2V5fSxcXHJcXG5gLCBgYCk7XHJcblxyXG4gICAgICAgIHdyaXRlKGBcclxuaXNla2FpLkVRVUlQKHtcXHJcXG4ke2tleXN9fSk7YCk7XHJcblxyXG4gICAgICAgIGNvbnN0IEJJTiA9IGAuQklOYDtcclxuICAgICAgICBjb25zdCBpbnB1dCA9IHBhdGguam9pbihCSU4sIGAke25hbWV9LmVudHJ5LmpzYCk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgIGlmICghZnMuZXhpc3RzU3luYyhCSU4pKSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGBDUkVBVElORyAke0JJTn1gKTtcclxuICAgICAgICAgICAgZnMubWtkaXJTeW5jKEJJTik7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIC8vIHdyaXRlIG91dCB0aGVpciBpbmRleC5qc1xyXG4gICAgICAgIGZzLndyaXRlRmlsZVN5bmMoaW5wdXQsIGVudHJ5LCBgdXRmLThgKTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgY29uc29sZS5sb2coYFxyXG5bJHtuYW1lfV1bJHt0eXBlfV1cclxuXHJcblNLSUxMU1xyXG4ke2MuYmx1ZUJyaWdodChlcXVpcGVkLm1hcCgoZSkgPT4gYFske2V9XWApLlxyXG4gICAgICAgIGpvaW4oYCArIGApKX1cclxuXHJcbiR7Yy5yZWQoZmFpbGVkKX1cclxuYCk7XHJcblxyXG4gICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgIGlucHV0XHJcbiAgICAgICAgfTtcclxuICAgIH0sXHJcblxyXG4gICAgcnVuX2J1aWxkZXJzOiAoe1xyXG4gICAgICAgIGlucHV0LFxyXG4gICAgICAgIG5hbWUsXHJcbiAgICAgICAgY29uZmlnLFxyXG4gICAgfSkgPT4ge1xyXG4gICAgICAgIGlmKGNvbmZpZy5OT0RFICYmIGNvbmZpZy5CUk9XU0VSKSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgWW91IGNhbm5vdCB0YXJnZXQgYm90aCBbTk9ERV0gYW5kIFtCUk9XU0VSXWApO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYoY29uZmlnLk5PREUpIHtcclxuICAgICAgICAgICAgY29uc3Qgb3V0cHV0ID0gYC5CSU4vJHtuYW1lfS5qc2A7ICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICAgICAgb3V0cHV0LFxyXG4gICAgICAgICAgICAgICAgYnVpbGRfaW5mbzogYnVpbGRlcnMubm9kZSh7XHJcbiAgICAgICAgICAgICAgICAgICAgaW5wdXQsXHJcbiAgICAgICAgICAgICAgICAgICAgb3V0cHV0XHJcbiAgICAgICAgICAgICAgICB9KVxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICBpZihjb25maWcuQlJPV1NFUikge1xyXG4gICAgICAgICAgICBjb25zdCBvdXRwdXQgPSBgREFUQS9wdWJsaWMvJHtuYW1lfS5qc2A7XHJcblxyXG4gICAgICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICAgICAgb3V0cHV0LFxyXG4gICAgICAgICAgICAgICAgYnVpbGRfaW5mbzogYnVpbGRlcnMuYnJvd3Nlcih7XHJcbiAgICAgICAgICAgICAgICAgICAgaW5wdXQsXHJcbiAgICAgICAgICAgICAgICAgICAgb3V0cHV0XHJcbiAgICAgICAgICAgICAgICB9KVxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBZb3UgbXVzdCBzcGVjaWZ5IGVpdGhlciBbTk9ERV0gb3IgW0JST1dTRVJdIGZvciB5b3VyIHRhcmdldCBpbiB5b3VyIFtEQUVNT05dIHRvbWxgKTtcclxuICAgIH1cclxufSkuXHJcbiAgICByZWR1Y2UoKHN0YXRlLCBmbikgPT4gKHtcclxuICAgICAgICAuLi5zdGF0ZSxcclxuICAgICAgICAuLi5mbihzdGF0ZSlcclxuICAgIH0pLCB7IGNvbmZpZ0ZpbGUgfSk7XHJcbiIsImltcG9ydCBnbG9iIGZyb20gXCJnbG9iXCI7XHJcbmltcG9ydCBwYXRoIGZyb20gXCJwYXRoXCI7XHJcbmltcG9ydCBnZXRfY29uZmlnIGZyb20gXCIuL2dldF9jb25maWcuanNcIjtcclxuXHJcbmV4cG9ydCBkZWZhdWx0IChleGNsdWRlID0gZmFsc2UpID0+IHtcclxuICAgIGlmKCFleGNsdWRlKSB7XHJcbiAgICAgICAgcmV0dXJuIGdsb2Iuc3luYyhgLi9EQUVNT05TLyoudG9tbGApLlxyXG4gICAgICAgICAgICBtYXAoKGNsYXNzX3BhdGgpID0+IHBhdGguYmFzZW5hbWUoY2xhc3NfcGF0aCwgYC50b21sYCkpO1xyXG4gICAgfVxyXG5cclxuXHJcbiAgICByZXR1cm4gZ2xvYi5zeW5jKGAuL0RBRU1PTlMvKi50b21sYCkuXHJcbiAgICAgICAgZmlsdGVyKChkYWVtb24pID0+IGdldF9jb25maWcoZGFlbW9uKS5OT0RFKS5cclxuICAgICAgICBtYXAoKGNsYXNzX3BhdGgpID0+IHBhdGguYmFzZW5hbWUoY2xhc3NfcGF0aCwgYC50b21sYCkpO1xyXG59OyIsImltcG9ydCBnZXRfbGlzdCBmcm9tIFwiLi9nZXRfbGlzdC5qc1wiO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgKGNsYXNzZXMpID0+IGNsYXNzZXMuZmlsdGVyKCh0YXJnZXQpID0+IHtcclxuICAgIGNvbnN0IGlzX29rYXkgPSBnZXRfbGlzdCgpLlxyXG4gICAgICAgIGluZGV4T2YodGFyZ2V0KSAhPT0gLTE7XHJcblxyXG4gICAgaWYoIWlzX29rYXkpIHtcclxuICAgICAgICBjb25zb2xlLmxvZyhgJHt0YXJnZXR9IGlzIG5vdCBhbiBhdmFpbGFibGUgW0RBRU1PTl1gKTtcclxuICAgIH1cclxuICAgICAgICBcclxuICAgIHJldHVybiBpc19va2F5O1xyXG59KTtcclxuIiwiaW1wb3J0IGdldF9saXN0IGZyb20gXCIuL2dldF9saXN0LmpzXCI7XHJcbmltcG9ydCBmaWx0ZXJfbGlzdCBmcm9tIFwiLi9maWx0ZXJfbGlzdC5qc1wiO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgKHtcclxuICAgIGNtZCxcclxuICAgIERBRU1PTlNcclxufSkgPT4ge1xyXG4gICAgaWYoIURBRU1PTlMpIHtcclxuICAgICAgICByZXR1cm4gY21kLnByb21wdCh7XHJcbiAgICAgICAgICAgIHR5cGU6IGBsaXN0YCxcclxuICAgICAgICAgICAgbmFtZTogYERBRU1PTmAsXHJcbiAgICAgICAgICAgIG1lc3NhZ2U6IGBXaGljaCBbREFFTU9OXT9gLFxyXG4gICAgICAgICAgICBjaG9pY2VzOiBbIGBhbGxgLCAuLi5nZXRfbGlzdCgpIF1cclxuICAgICAgICB9KS5cclxuICAgICAgICAgICAgdGhlbigoeyBEQUVNT04gfSkgPT4gREFFTU9OID09PSBgYWxsYCBcclxuICAgICAgICAgICAgICAgID8gZ2V0X2xpc3QoKSBcclxuICAgICAgICAgICAgICAgIDogZmlsdGVyX2xpc3QoWyBEQUVNT04gXSkpO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICBpZihEQUVNT05TWzBdID09PSBgYWxsYCkge1xyXG4gICAgICAgIHJldHVybiBnZXRfbGlzdCgpO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiBmaWx0ZXJfbGlzdChEQUVNT05TKTtcclxufTsiLCJpbXBvcnQgdG9tbF90b19qcyBmcm9tIFwiLi4vdHJhbnNmb3Jtcy90b21sX3RvX2pzLmpzXCI7XHJcbmltcG9ydCByb2xsdXAgZnJvbSBcInJvbGx1cFwiO1xyXG5cclxuaW1wb3J0IHByb21wdF9kYWVtb25zIGZyb20gXCIuLi9saWIvcHJvbXB0X2RhZW1vbnMuanNcIjtcclxuXHJcbmV4cG9ydCBkZWZhdWx0ICh7XHJcbiAgICBjb21tYW5kOiBgYnVpbGQgW0RBRU1PTlMuLi5dYCxcclxuICAgIGhlbHA6IGBidWlsZCBhbGwgW0RBRU1PTl0gc2F2ZShzKS5gLFxyXG4gICAgaGlkZGVuOiB0cnVlLFxyXG4gICAgYXN5bmMgaGFuZGxlcih7IERBRU1PTlMgfSkge1xyXG4gICAgICAgIGNvbnN0IERBRU1PTnMgPSBhd2FpdCBwcm9tcHRfZGFlbW9ucyh7IFxyXG4gICAgICAgICAgICBjbWQ6IHRoaXMsXHJcbiAgICAgICAgICAgIERBRU1PTlMgXHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIGNvbnN0IGJ1aWx0ID0gYXdhaXQgUHJvbWlzZS5hbGwoREFFTU9Ocy5tYXAoYXN5bmMgKHRhcmdldCkgPT4ge1xyXG4gICAgICAgICAgICBjb25zdCB7IGJ1aWxkX2luZm8sIG5hbWUgfSA9IGF3YWl0IHRvbWxfdG9fanMoYC4vREFFTU9OUy8ke3RhcmdldH0udG9tbGApO1xyXG4gICAgICAgICAgICBjb25zdCBidW5kbGUgPSBhd2FpdCByb2xsdXAucm9sbHVwKGJ1aWxkX2luZm8pO1xyXG5cclxuICAgICAgICAgICAgYXdhaXQgYnVuZGxlLndyaXRlKGJ1aWxkX2luZm8ub3V0cHV0KTtcclxuICAgICAgICAgICAgY29uc29sZS5sb2coYFske25hbWV9XSBCdWlsZCBDb21wbGV0ZS5cXHJcXG5gKTtcclxuICAgICAgICB9KSk7XHJcblxyXG4gICAgICAgIGNvbnNvbGUubG9nKGBCdWlsdCAke2J1aWx0Lmxlbmd0aH0gW0RBRU1PTl0ocykuYCk7XHJcbiAgICB9XHJcbn0pOyIsImltcG9ydCBHaXQgZnJvbSBcInNpbXBsZS1naXQvcHJvbWlzZVwiO1xyXG5cclxuY29uc3QgZ2l0ID0gR2l0KCk7XHJcblxyXG5leHBvcnQgZGVmYXVsdCAoe1xyXG4gICAgY29tbWFuZDogYGNvbW1pdCBbbWVzc2FnZS4uLl1gLFxyXG4gICAgaGVscDogYGNvbW1pdCBjdXJyZW50IGZpbGVzIHRvIHNvdXJjZSBjb250cm9sYCxcclxuICAgIGhhbmRsZXI6ICh7XHJcbiAgICAgICAgbWVzc2FnZSA9IFsgYFVwZGF0ZSwgbm8gY29tbWl0IG1lc3NhZ2VgIF1cclxuICAgIH0pID0+IGdpdC5hZGQoWyBgLmAgXSkuXHJcbiAgICAgICAgdGhlbigoKSA9PiBnaXQuY29tbWl0KG1lc3NhZ2Uuam9pbihgIGApKSkuXHJcbiAgICAgICAgdGhlbigoKSA9PiBnaXQucHVzaChgb3JpZ2luYCwgYG1hc3RlcmApKS5cclxuICAgICAgICB0aGVuKCgpID0+IGNvbnNvbGUubG9nKGBDb21taXRlZCB3aXRoIG1lc3NhZ2UgJHttZXNzYWdlLmpvaW4oYCBgKX1gKSlcclxufSk7XHJcbiIsImltcG9ydCBkZWdpdCBmcm9tIFwiZGVnaXRcIjtcclxuaW1wb3J0IHsgZXhlYyB9IGZyb20gXCJjaGlsZF9wcm9jZXNzXCI7XHJcbmltcG9ydCBHaXQgZnJvbSBcInNpbXBsZS1naXQvcHJvbWlzZVwiO1xyXG5cclxuY29uc3QgZ2l0ID0gR2l0KCk7XHJcblxyXG5leHBvcnQgZGVmYXVsdCAoe1xyXG4gICAgY29tbWFuZDogYGNyZWF0ZSBbdGVtcGxhdGVdIFtuYW1lXWAsXHJcbiAgICBoZWxwOiBgQ3JlYXRlIGEgbmV3IGlzZWthaSBwcm9qZWN0IGZyb20gW3RlbXBsYXRlXSBvciBAaXNla2FpL3RlbXBsYXRlYCxcclxuICAgIGFsaWFzOiBbIGBpbml0YCBdLFxyXG4gICAgb3B0aW9uczoge1xyXG4gICAgICAgIFwiLWYsIC0tZm9yY2VcIjogYGZvcmNlIG92ZXJ3cml0ZSBmcm9tIHRlbXBsYXRlYFxyXG4gICAgfSxcclxuICAgIGhhbmRsZXI6ICh7XHJcbiAgICAgICAgdGVtcGxhdGUgPSBgaXNla2FpLWRldi90ZW1wbGF0ZWAsXHJcbiAgICAgICAgbmFtZSA9IGAuYCxcclxuICAgICAgICBvcHRpb25zOiB7XHJcbiAgICAgICAgICAgIGZvcmNlID0gZmFsc2VcclxuICAgICAgICB9ID0gZmFsc2VcclxuICAgIH0pID0+IGRlZ2l0KHRlbXBsYXRlLCB7IGZvcmNlIH0pLlxyXG4gICAgICAgIGNsb25lKG5hbWUpLlxyXG4gICAgICAgIHRoZW4oKCkgPT4gZ2l0LmluaXQoKSkuXHJcbiAgICAgICAgdGhlbigoKSA9PiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGAke3RlbXBsYXRlfSBjb3BpZWQgdG8gJHtuYW1lfWApO1xyXG4gICAgICAgICAgICBjb25zb2xlLmxvZyhgSU5TVEFMTElORzogVEhJUyBNQVkgVEFLRSBBV0hJTEVgKTtcclxuICAgICAgICAgICAgZXhlYyhgbnBtIGluc3RhbGxgLCAoZXJyKSA9PiB7XHJcbiAgICAgICAgICAgICAgICBpZihlcnIpIHtcclxuICAgICAgICAgICAgICAgICAgICByZWplY3QoZXJyKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIHJlc29sdmUoKTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfSkpLlxyXG4gICAgICAgIHRoZW4oKCkgPT4ge1xyXG4gICAgICAgICAgICBjb25zb2xlLmxvZyhgQ09NUExFVEU6IFtydW5dIHRvIHN0YXJ0IHlvdXIgREFFTU9Ocy5gKTtcclxuICAgICAgICB9KVxyXG59KTsiLCJpbXBvcnQgZ2V0X2xpc3QgZnJvbSBcIi4uL2xpYi9nZXRfbGlzdC5qc1wiO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgKHtcclxuICAgIGhlbHA6IGBTaG93IGF2YWlsYWJsZSBbREFFTU9OXSBzYXZlcy5gLFxyXG4gICAgYWxpYXM6IFsgYGxzYCwgYHNhdmVzYCBdLFxyXG4gICAgaGFuZGxlcjogKGFyZ3MsIGNiKSA9PiB7XHJcbiAgICAgICAgY29uc29sZS5sb2coZ2V0X2xpc3QoKS5cclxuICAgICAgICAgICAgbWFwKChpKSA9PiBgWyR7aX1dYCkuXHJcbiAgICAgICAgICAgIGpvaW4oYCAtIGApLCBgXFxyXFxuYCk7ICAgIFxyXG4gICAgICAgICAgICBcclxuICAgICAgICBjYigpO1xyXG4gICAgfVxyXG59KTsiLCIvLyBwaXBlIG91dCB0byBwbTJcclxuaW1wb3J0IHsgc3Bhd24gfSBmcm9tIFwiY2hpbGRfcHJvY2Vzc1wiO1xyXG5pbXBvcnQgcGF0aCBmcm9tIFwicGF0aFwiO1xyXG5cclxuY29uc3QgcG0yX3BhdGggPSBwYXRoLmRpcm5hbWUocmVxdWlyZS5yZXNvbHZlKGBwbTJgKSk7XHJcblxyXG5leHBvcnQgZGVmYXVsdCAoeyBjb21tYW5kcyB9KSA9PiB7XHJcbiAgICBsZXQgbm9kZSA9IHNwYXduKGBub2RlYCwgYCR7cG0yX3BhdGh9L2Jpbi9wbTIgJHtjb21tYW5kcy5qb2luKGAgYCl9YC5zcGxpdChgIGApLCB7XHJcbiAgICAgICAgY3dkOiBwcm9jZXNzLmN3ZCgpLFxyXG4gICAgICAgIGVudjogcHJvY2Vzcy5lbnYsXHJcbiAgICAgICAgc3RkaW86IGBpbmhlcml0YFxyXG4gICAgfSk7XHJcblxyXG4gICAgcmV0dXJuIHtcclxuICAgICAgICBkb25lOiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xyXG4gICAgICAgICAgICBub2RlLm9uKGBjbG9zZWAsICgpID0+IHtcclxuICAgICAgICAgICAgICAgIHJlc29sdmUoKTtcclxuICAgICAgICAgICAgICAgIG5vZGUgPSBmYWxzZTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfSksXHJcblxyXG4gICAgICAgIGNhbmNlbDogKCkgPT4ge1xyXG4gICAgICAgICAgICBpZighbm9kZSkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICB9XHJcbiAgICBcclxuICAgICAgICAgICAgbm9kZS5raWxsKCk7XHJcbiAgICAgICAgfSAgIFxyXG4gICAgfTtcclxufTtcclxuIiwiaW1wb3J0IHBtMiBmcm9tIFwiLi4vbGliL3BtMi5qc1wiO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgKHtcclxuICAgIGNvbW1hbmQ6IGBsb2dzIFtEQUVNT05TLi4uXWAsXHJcbiAgICBoZWxwOiBgZm9sbG93IHRoZSBhY3RpdmUgW0RBRU1PTl0gbG9nc2AsXHJcbiAgICBoYW5kbGVyOiAoeyBEQUVNT05TID0gW10gfSkgPT4gcG0yKHtcclxuICAgICAgICBjb21tYW5kczogWyBgbG9nc2AsIC4uLkRBRU1PTlMgXVxyXG4gICAgfSkuZG9uZVxyXG4gICAgXHJcbn0pOyIsImltcG9ydCBHaXQgZnJvbSBcInNpbXBsZS1naXQvcHJvbWlzZVwiO1xyXG5pbXBvcnQgeyBleGVjIH0gZnJvbSBcImNoaWxkX3Byb2Nlc3NcIjtcclxuXHJcbmNvbnN0IGdpdCA9IEdpdCgpO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgKHtcclxuICAgIGNvbW1hbmQ6IGBwdWxsYCxcclxuICAgIGhlbHA6IGBnZXQgY3VycmVudCBmaWxlcyBmcm9tIHNvdXJjZSBjb250cm9sYCxcclxuICAgIGhhbmRsZXI6ICgpID0+IGdpdC5wdWxsKGBvcmlnaW5gLCBgbWFzdGVyYCkuXHJcbiAgICAgICAgdGhlbigoKSA9PiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XHJcbiAgICAgICAgICAgIGV4ZWMoYG5wbSBpbnN0YWxsYCwgKGVycikgPT4ge1xyXG4gICAgICAgICAgICAgICAgaWYoZXJyKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmVqZWN0KGVycik7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICByZXNvbHZlKCk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0pKS5cclxuICAgICAgICB0aGVuKCgpID0+IGNvbnNvbGUubG9nKGBQdWxsZWQgbGF0ZXN0IGZyb20gc291cmNlIGNvbnRyb2wuYCkpXHJcbn0pO1xyXG4iLCJpbXBvcnQgZmV0Y2ggZnJvbSBcIm5vZGUtZmV0Y2hcIjtcclxuaW1wb3J0IGdsb2IgZnJvbSBcImdsb2JcIjtcclxuaW1wb3J0IGdldF9jb25maWcgZnJvbSBcIi4uL2xpYi9nZXRfY29uZmlnLmpzXCI7XHJcbmltcG9ydCBwYXRoIGZyb20gXCJwYXRoXCI7XHJcblxyXG4vLyBUT0RPOiBUaGlzIHNob3VsZCByZWFsbHkgYmUgZXhwb3NlZCBieSBpc2VrYWkgY29yZSBzb21lIGhvdy4gTGlrZSBhIHdheSB0byBhZGQgaW4gdG9vbHNcclxuZXhwb3J0IGRlZmF1bHQgKHtcclxuICAgIGNvbW1hbmQ6IGBwdXNoYCxcclxuICAgIGFsaWFzOiBbIGBwdWJsaXNoYCBdLFxyXG4gICAgYXN5bmMgaGFuZGxlcigpIHtcclxuICAgICAgICBhd2FpdCBQcm9taXNlLmFsbChnbG9iLnN5bmMoYC4vREFFTU9OUy8qLnRvbWxgKS5cclxuICAgICAgICAgICAgbWFwKChEQUVNT04pID0+IHtcclxuICAgICAgICAgICAgICAgIGNvbnN0IHsgQURNSU4gfSA9IGdldF9jb25maWcoREFFTU9OKTtcclxuICAgICAgICAgICAgICAgIGlmKEFETUlOICYmIEFETUlOLnphbGdvKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgeyBcclxuICAgICAgICAgICAgICAgICAgICAgICAgdXJsID0gYGh0dHA6Ly9sb2NhbGhvc3Q6ODA4MGAsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHphbGdvIFxyXG4gICAgICAgICAgICAgICAgICAgIH0gPSBBRE1JTjtcclxuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgUFVTSElORyBbJHtwYXRoLmJhc2VuYW1lKERBRU1PTiwgYC50b21sYCl9XSAtICR7dXJsfWApO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmV0Y2goYCR7dXJsfS96YWxnb2AsIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgbWV0aG9kOiBgUE9TVGAsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhY2hlOiBgbm8tY2FjaGVgLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBoZWFkZXJzOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBcIkNvbnRlbnQtVHlwZVwiOiBgYXBwbGljYXRpb24vanNvbmBcclxuICAgICAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoe1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgemFsZ29cclxuICAgICAgICAgICAgICAgICAgICAgICAgfSlcclxuICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XHJcbiAgICAgICAgICAgIH0pKTtcclxuXHJcbiAgICB9XHJcbn0pOyIsImltcG9ydCBnZXRfc2tpbGxzIGZyb20gXCIuLi9saWIvZ2V0X3NraWxscy5qc1wiO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgKHtcclxuICAgIGNvbW1hbmQ6IGBza2lsbHNgLFxyXG4gICAgaGVscDogYExpc3QgYXZhaWxhYmxlIHNraWxsc2AsXHJcblxyXG4gICAgaGFuZGxlcjogKCkgPT4ge1xyXG4gICAgICAgIGNvbnN0IHtcclxuICAgICAgICAgICAgU0hPUCxcclxuICAgICAgICAgICAgU0tJTExTXHJcbiAgICAgICAgfSA9IGdldF9za2lsbHMoKTtcclxuXHJcbiAgICAgICAgY29uc29sZS5sb2coYFxyXG5TSE9QXHJcbiR7T2JqZWN0LmtleXMoU0hPUCkuXHJcbiAgICAgICAgbWFwKChzKSA9PiBgWyR7c31dYCkuXHJcbiAgICAgICAgam9pbihgID0gYCl9XHJcblxyXG5TS0lMTFNcclxuJHtPYmplY3Qua2V5cyhTS0lMTFMpLlxyXG4gICAgICAgIG1hcCgocykgPT4gYFske3N9XWApLlxyXG4gICAgICAgIGpvaW4oYCBvIGApfVxyXG5gKTtcclxuICAgIH1cclxufSk7IiwiaW1wb3J0IHBtMiBmcm9tIFwicG0yXCI7XHJcblxyXG5pbXBvcnQgdG9tbF90b19qcyBmcm9tIFwiLi4vdHJhbnNmb3Jtcy90b21sX3RvX2pzLmpzXCI7XHJcblxyXG5pbXBvcnQgcHJvbXB0X2RhZW1vbnMgZnJvbSBcIi4uL2xpYi9wcm9tcHRfZGFlbW9ucy5qc1wiO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgKHtcclxuICAgIGNvbW1hbmRlcjogYHNwYXduIFtEQUVNT05TLi4uXWAsXHJcbiAgICBoZWxwOiBgc3Bhd24gW0RBRU1PTlNdIGZpbGVzYCxcclxuICAgIGhpZGRlbjogdHJ1ZSxcclxuICAgIGFzeW5jIGhhbmRsZXIoeyBEQUVNT05TIH0pIHtcclxuICAgICAgICBjb25zdCBkYWVtb25zID0gYXdhaXQgcHJvbXB0X2RhZW1vbnMoe1xyXG4gICAgICAgICAgICBjbWQ6IHRoaXMsXHJcbiAgICAgICAgICAgIERBRU1PTlNcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgZGFlbW9ucy5mb3JFYWNoKChEQUVNT04pID0+IHtcclxuICAgICAgICAgICAgY29uc3Qge1xyXG4gICAgICAgICAgICAgICAgb3V0cHV0LFxyXG4gICAgICAgICAgICB9ID0gdG9tbF90b19qcyhgLi9EQUVNT05TLyR7REFFTU9OfS50b21sYCk7XHJcblxyXG4gICAgICAgICAgICAvLyBIQUNLOiBjb3VsZCBuYW1lIHRoZSBmaWxlIG9mIHRoZSBUT01MIHNvbWV0aGluZyBnbmFybHlcclxuICAgICAgICAgICAgcG0yLnN0YXJ0KHtcclxuICAgICAgICAgICAgICAgIG5hbWU6IERBRU1PTixcclxuICAgICAgICAgICAgICAgIHNjcmlwdDogb3V0cHV0LFxyXG4gICAgICAgICAgICAgICAgd2F0Y2g6IGAuLyR7b3V0cHV0fWAsXHJcbiAgICAgICAgICAgICAgICBmb3JjZTogdHJ1ZSxcclxuICAgICAgICAgICAgICAgIHdhdGNoX29wdGlvbnM6IHtcclxuICAgICAgICAgICAgICAgICAgICAvLyB5dXAgUE0yIHdhcyBzZXR0aW5nIGEgZGVmYXVsdCBpZ25vcmVcclxuICAgICAgICAgICAgICAgICAgICBpZ25vcmVkOiBgYCxcclxuICAgICAgICAgICAgICAgICAgICB1c2VQb2xsaW5nOiB0cnVlXHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgbWF4X3Jlc3RhcnQ6IDBcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIGNvbnNvbGUubG9nKGBTcGF3bmVkICR7ZGFlbW9ucy5qb2luKGAgLSBgKX1gKTtcclxuICAgIH1cclxufSk7XHJcbiIsImV4cG9ydCBkZWZhdWx0IChcclxuICAgIGFjdGlvbl9tYXAsIFxyXG4gICAgcmVkdWNlciA9IChpKSA9PiBpXHJcbikgPT4gKGlucHV0KSA9PiB7XHJcbiAgICBjb25zdCBrZXkgPSByZWR1Y2VyKGlucHV0KTtcclxuXHJcbiAgICBpZighYWN0aW9uX21hcFtrZXldKSB7XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiBhY3Rpb25fbWFwW2tleV0oaW5wdXQpO1xyXG59OyIsImltcG9ydCBjaG9raWRhciBmcm9tIFwiY2hva2lkYXJcIjtcclxuaW1wb3J0IHJvbGx1cCBmcm9tIFwicm9sbHVwXCI7XHJcbmltcG9ydCBjIGZyb20gXCJjaGFsa1wiO1xyXG5cclxuaW1wb3J0IHRvbWxfdG9fanMgZnJvbSBcIi4uL3RyYW5zZm9ybXMvdG9tbF90b19qcy5qc1wiO1xyXG5cclxuaW1wb3J0IGFjdGlvbiBmcm9tIFwiLi4vbGliL2FjdGlvbi5qc1wiO1xyXG5pbXBvcnQgcHJvbXB0X2RhZW1vbnMgZnJvbSBcIi4uL2xpYi9wcm9tcHRfZGFlbW9ucy5qc1wiO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgKHtcclxuICAgIGNvbW1hbmQ6IGBsb2FkIFtEQUVNT05TLi4uXWAsXHJcbiAgICBoZWxwOiBgbG9hZCBbREFFTU9OXSBzYXZlc2AsXHJcbiAgICBhbGlhczogWyBgcmVnZW5lcmF0ZWAsIGByZWNyZWF0ZWAsIGB3YXRjaGAgXSxcclxuICAgIGhpZGRlbjogdHJ1ZSxcclxuICAgIGNhbmNlbCAoKSB7XHJcbiAgICAgICAgdGhpcy53YXRjaGVycy5mb3JFYWNoKCh3YXRjaGVyKSA9PiB3YXRjaGVyLmNsb3NlKCkpO1xyXG4gICAgICAgIGNvbnNvbGUubG9nKGBZT1VSIFdBVENIIEhBUyBFTkRFRGApO1xyXG4gICAgfSxcclxuICAgIGFzeW5jIGhhbmRsZXIoeyBEQUVNT05TIH0pIHtcclxuICAgICAgICB0aGlzLndhdGNoZXJzID0gW107XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgIGNvbnN0IERBRU1PTnMgPSBhd2FpdCBwcm9tcHRfZGFlbW9ucyh7XHJcbiAgICAgICAgICAgIGNtZDogdGhpcyxcclxuICAgICAgICAgICAgREFFTU9OU1xyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIFxyXG4gICAgICAgIERBRU1PTnMuZm9yRWFjaCgodGFyZ2V0KSA9PiB7XHJcbiAgICAgICAgICAgIGNvbnN0IGZpbGVfcGF0aCA9IGAuL0RBRU1PTlMvJHt0YXJnZXR9LnRvbWxgO1xyXG5cclxuICAgICAgICAgICAgY29uc3QgZGF0YSA9IHRvbWxfdG9fanMoZmlsZV9wYXRoKTtcclxuXHJcbiAgICAgICAgICAgIGNvbnN0IHsgYnVpbGRfaW5mbyB9ID0gZGF0YTtcclxuICAgICAgICBcclxuICAgICAgICAgICAgLy8gcmVidWlsZCBvbiBmaWxlIGNoYWduZVxyXG4gICAgICAgICAgICBjb25zdCB3YXRjaGVyID0gY2hva2lkYXIud2F0Y2goZmlsZV9wYXRoKTtcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICB3YXRjaGVyLm9uKGBjaGFuZ2VgLCAoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICB0b21sX3RvX2pzKGZpbGVfcGF0aCk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHRoaXMud2F0Y2hlcnMucHVzaCh3YXRjaGVyKTtcclxuXHJcbiAgICAgICAgICAgIGNvbnN0IHJvbGx1cF93YXRjaGVyID0gcm9sbHVwLndhdGNoKHtcclxuICAgICAgICAgICAgICAgIC4uLmJ1aWxkX2luZm8sXHJcbiAgICAgICAgICAgICAgICB3YXRjaDoge1xyXG4gICAgICAgICAgICAgICAgICAgIGNsZWFyU2NyZWVuOiB0cnVlXHJcbiAgICAgICAgICAgICAgICB9ICAgXHJcbiAgICAgICAgICAgIH0pLlxyXG4gICAgICAgICAgICAgICAgb24oYGV2ZW50YCwgYWN0aW9uKHtcclxuICAgICAgICAgICAgICAgICAgICBCVU5ETEVfRU5EOiAoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbJHt0YXJnZXR9XVtXQVRDSF0gQnVpbHQuYCk7XHJcbiAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICBFUlJPUjogKGUpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coZSk7XHJcbiAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICBGQVRBTDogKHsgZXJyb3IgfSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKGMucmVkLmJvbGQoZXJyb3IpKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9LCAoeyBjb2RlIH0pID0+IGNvZGUgXHJcbiAgICAgICAgICAgICAgICApKTtcclxuXHJcbiAgICAgICAgICAgIHRoaXMud2F0Y2hlcnMucHVzaChyb2xsdXBfd2F0Y2hlcik7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcbn0pO1xyXG4iLCJpbXBvcnQgcG0yIGZyb20gXCIuLi9saWIvcG0yLmpzXCI7XHJcbmltcG9ydCBnZXRfbGlzdCBmcm9tIFwiLi4vbGliL2dldF9saXN0LmpzXCI7XHJcblxyXG5leHBvcnQgZGVmYXVsdCAoe1xyXG4gICAgY29tbWFuZDogYHNsYXkgW0RBRU1PTlMuLi5dYCxcclxuICAgIGhlbHA6IGBzbGF5IGFjdGl2ZSBbREFFTU9OU11gLCBcclxuICAgIGFsaWFzOiBbIGB1bnN1bW1vbmAsIGBraWxsYCwgYHNsYXlgLCBgc3RvcGAgXSxcclxuICAgIGNhbmNlbCgpIHtcclxuICAgICAgICB0aGlzLmNhbmNlbGVyKCk7XHJcbiAgICB9LFxyXG4gICAgXHJcbiAgICBoYW5kbGVyKHsgREFFTU9OUyA9IGdldF9saXN0KCkgfSA9IGZhbHNlKSB7XHJcbiAgICAgICAgY29uc3Qgd2hvbSA9IERBRU1PTlMubWFwKChjaGFyKSA9PiBgWyR7Y2hhcn1dYCkuXHJcbiAgICAgICAgICAgIGpvaW4oYCAtIGApO1xyXG5cclxuICAgICAgICBjb25zb2xlLmxvZyhgU0xBWUlORyAke3dob219YCk7XHJcblxyXG4gICAgICAgIGNvbnN0IHsgY2FuY2VsLCBkb25lIH0gPSBwbTIoe1xyXG4gICAgICAgICAgICBjb21tYW5kczogWyBgZGVsZXRlYCwgYGFsbGAgXVxyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICB0aGlzLmNhbmNlbGVyID0gY2FuY2VsO1xyXG5cclxuICAgICAgICByZXR1cm4gZG9uZTtcclxuICAgIH1cclxufSk7XHJcblxyXG4iLCJpbXBvcnQgd2F0Y2ggZnJvbSBcIi4vd2F0Y2guanNcIjtcclxuaW1wb3J0IHNwYXduIGZyb20gXCIuL3NwYXduLmpzXCI7XHJcbmltcG9ydCBwbTIgZnJvbSBcIi4uL2xpYi9wbTIuanNcIjtcclxuXHJcbmltcG9ydCBzdG9wIGZyb20gXCIuL3N0b3AuanNcIjtcclxuaW1wb3J0IHByb21wdF9kYWVtb25zIGZyb20gXCIuLi9saWIvcHJvbXB0X2RhZW1vbnMuanNcIjtcclxuXHJcbmNvbnN0IHJ1bl9kYWVtb25zID0gKHsgREFFTU9OUyB9KSA9PiB7XHJcbiAgICB3YXRjaC5oYW5kbGVyKHsgREFFTU9OUyB9KTtcclxuICAgIHNwYXduLmhhbmRsZXIoeyBEQUVNT05TIH0pO1xyXG5cclxuICAgIHJldHVybiBwbTIoe1xyXG4gICAgICAgIGNvbW1hbmRzOiBbIGBsb2dzYCBdXHJcbiAgICB9KS5kb25lO1xyXG59O1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgKHtcclxuICAgIGNvbW1hbmQ6IGBzdW1tb24gW0RBRU1PTlMuLi5dYCxcclxuICAgIGhlbHA6IGBzdW1tb24gYW5kIHdhdGNoIFtEQUVNT05TLi4uXWAsXHJcbiAgICBhbGlhczogWyBgZGV2YCwgYHN0YXJ0YCwgYHJ1bmAgXSxcclxuICAgIGFzeW5jIGhhbmRsZXIoeyBEQUVNT05TIH0pIHtcclxuICAgICAgICBjb25zdCBEQUVNT05zID0gYXdhaXQgcHJvbXB0X2RhZW1vbnMoe1xyXG4gICAgICAgICAgICBjbWQ6IHRoaXMsXHJcbiAgICAgICAgICAgIERBRU1PTlNcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgYXdhaXQgc3RvcC5oYW5kbGVyKCk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgcmV0dXJuIHJ1bl9kYWVtb25zKHsgREFFTU9OUzogREFFTU9OcyB9KTtcclxuICAgIH0sXHJcblxyXG4gICAgY2FuY2VsKCkge1xyXG4gICAgICAgIHdhdGNoLmNhbmNlbCgpO1xyXG4gICAgfVxyXG59KTtcclxuXHJcbiIsImltcG9ydCBwbTIgZnJvbSBcIi4uL2xpYi9wbTIuanNcIjtcclxuXHJcbmV4cG9ydCBkZWZhdWx0KHtcclxuICAgIGNvbW1hbmQ6IGBzdGF0dXMgW0RBRU1PTl1gLFxyXG4gICAgaGVscDogYHN0YXR1cyBvZiBhY3RpdmUgW0RBRU1PTl1zLmAsXHJcbiAgICBhbGlhczogWyBgcHNgLCBgYWN0aXZlYCwgYHN0YXRzYCBdLFxyXG4gICAgaGFuZGxlcjogKCkgPT4gcG0yKHtcclxuICAgICAgICBjb21tYW5kczogWyBgcHNgIF1cclxuICAgIH0pLmRvbmVcclxufSk7IiwiaW1wb3J0IHsgdmVyc2lvbiB9IGZyb20gXCIuLi8uLi9wYWNrYWdlLmpzb25cIjtcclxuXHJcbmV4cG9ydCBkZWZhdWx0ICh7XHJcbiAgICBjb21tYW5kOiBgdmVyc2lvbmAsXHJcbiAgICBoZWxwOiBgVmVyc2lvbiBpcyAke3ZlcnNpb259YCxcclxuICAgIGhhbmRsZXI6ICgpID0+IHtcclxuICAgICAgICBjb25zb2xlLmxvZyh2ZXJzaW9uKTtcclxuICAgIH1cclxufSk7IiwiY29uc3QgcmVzID0ge307XG5pbXBvcnQgZjAgZnJvbSBcIi9Vc2Vycy9HYW1lcy9Qcm9qZWN0cy9JU0VLQUkvc3JjL2NvbW1hbmRzL2J1aWxkLmpzXCI7XG5yZXNbXCJidWlsZFwiXSA9IGYwO1xuaW1wb3J0IGYxIGZyb20gXCIvVXNlcnMvR2FtZXMvUHJvamVjdHMvSVNFS0FJL3NyYy9jb21tYW5kcy9jb21taXQuanNcIjtcbnJlc1tcImNvbW1pdFwiXSA9IGYxO1xuaW1wb3J0IGYyIGZyb20gXCIvVXNlcnMvR2FtZXMvUHJvamVjdHMvSVNFS0FJL3NyYy9jb21tYW5kcy9jcmVhdGUuanNcIjtcbnJlc1tcImNyZWF0ZVwiXSA9IGYyO1xuaW1wb3J0IGYzIGZyb20gXCIvVXNlcnMvR2FtZXMvUHJvamVjdHMvSVNFS0FJL3NyYy9jb21tYW5kcy9kYWVtb25zLmpzXCI7XG5yZXNbXCJkYWVtb25zXCJdID0gZjM7XG5pbXBvcnQgZjQgZnJvbSBcIi9Vc2Vycy9HYW1lcy9Qcm9qZWN0cy9JU0VLQUkvc3JjL2NvbW1hbmRzL2xvZ3MuanNcIjtcbnJlc1tcImxvZ3NcIl0gPSBmNDtcbmltcG9ydCBmNSBmcm9tIFwiL1VzZXJzL0dhbWVzL1Byb2plY3RzL0lTRUtBSS9zcmMvY29tbWFuZHMvcHVsbC5qc1wiO1xucmVzW1wicHVsbFwiXSA9IGY1O1xuaW1wb3J0IGY2IGZyb20gXCIvVXNlcnMvR2FtZXMvUHJvamVjdHMvSVNFS0FJL3NyYy9jb21tYW5kcy9wdXNoLmpzXCI7XG5yZXNbXCJwdXNoXCJdID0gZjY7XG5pbXBvcnQgZjcgZnJvbSBcIi9Vc2Vycy9HYW1lcy9Qcm9qZWN0cy9JU0VLQUkvc3JjL2NvbW1hbmRzL3NraWxscy5qc1wiO1xucmVzW1wic2tpbGxzXCJdID0gZjc7XG5pbXBvcnQgZjggZnJvbSBcIi9Vc2Vycy9HYW1lcy9Qcm9qZWN0cy9JU0VLQUkvc3JjL2NvbW1hbmRzL3NwYXduLmpzXCI7XG5yZXNbXCJzcGF3blwiXSA9IGY4O1xuaW1wb3J0IGY5IGZyb20gXCIvVXNlcnMvR2FtZXMvUHJvamVjdHMvSVNFS0FJL3NyYy9jb21tYW5kcy9zdGFydC5qc1wiO1xucmVzW1wic3RhcnRcIl0gPSBmOTtcbmltcG9ydCBmMTAgZnJvbSBcIi9Vc2Vycy9HYW1lcy9Qcm9qZWN0cy9JU0VLQUkvc3JjL2NvbW1hbmRzL3N0YXR1cy5qc1wiO1xucmVzW1wic3RhdHVzXCJdID0gZjEwO1xuaW1wb3J0IGYxMSBmcm9tIFwiL1VzZXJzL0dhbWVzL1Byb2plY3RzL0lTRUtBSS9zcmMvY29tbWFuZHMvc3RvcC5qc1wiO1xucmVzW1wic3RvcFwiXSA9IGYxMTtcbmltcG9ydCBmMTIgZnJvbSBcIi9Vc2Vycy9HYW1lcy9Qcm9qZWN0cy9JU0VLQUkvc3JjL2NvbW1hbmRzL3ZlcnNpb24uanNcIjtcbnJlc1tcInZlcnNpb25cIl0gPSBmMTI7XG5pbXBvcnQgZjEzIGZyb20gXCIvVXNlcnMvR2FtZXMvUHJvamVjdHMvSVNFS0FJL3NyYy9jb21tYW5kcy93YXRjaC5qc1wiO1xucmVzW1wid2F0Y2hcIl0gPSBmMTM7XG5leHBvcnQgZGVmYXVsdCByZXM7IiwiaW1wb3J0IGMgZnJvbSBcImNoYWxrXCI7XHJcblxyXG5jb25zdCB7IGxvZyB9ID0gY29uc29sZTtcclxuXHJcbmNvbnNvbGUubG9nID0gKC4uLmFyZ3MpID0+IGxvZyhcclxuICAgIC4uLmFyZ3MubWFwKFxyXG4gICAgICAgIChpdGVtKSA9PiB0eXBlb2YgaXRlbSA9PT0gYHN0cmluZ2BcclxuICAgICAgICAgICAgPyBjLmdyZWVuKFxyXG4gICAgICAgICAgICAgICAgaXRlbS5yZXBsYWNlKC8oXFxbLlteXFxdXFxbXSpcXF0pL3VnLCBjLmJvbGQud2hpdGUoYCQxYCkpXHJcbiAgICAgICAgICAgIClcclxuICAgICAgICAgICAgOiBpdGVtXHJcbiAgICApXHJcbik7XHJcbiIsIiMhL3Vzci9iaW4vZW52IG5vZGVcclxuXHJcbmltcG9ydCB2b3JwYWwgZnJvbSBcInZvcnBhbFwiO1xyXG5pbXBvcnQgY29tbWFuZHMgZnJvbSBcIi4vY29tbWFuZHMvKi5qc1wiO1xyXG5pbXBvcnQgeyB2ZXJzaW9uIH0gZnJvbSBcIi4uL3BhY2thZ2UuanNvblwiO1xyXG5cclxuaW1wb3J0IFwiLi9saWIvZm9ybWF0LmpzXCI7XHJcblxyXG5pbXBvcnQgY2hhbGsgZnJvbSBcImNoYWxrXCI7XHJcblxyXG5jb25zdCB2ID0gdm9ycGFsKCk7XHJcblxyXG5PYmplY3QuZW50cmllcyhjb21tYW5kcykuXHJcbiAgICBmb3JFYWNoKChbXHJcbiAgICAgICAgbmFtZSwge1xyXG4gICAgICAgICAgICBoZWxwLFxyXG4gICAgICAgICAgICBoYW5kbGVyLFxyXG4gICAgICAgICAgICBhdXRvY29tcGxldGUsXHJcbiAgICAgICAgICAgIGhpZGRlbixcclxuICAgICAgICAgICAgY29tbWFuZCxcclxuICAgICAgICAgICAgYWxpYXMgPSBbXSxcclxuICAgICAgICAgICAgb3B0aW9ucyA9IHt9LFxyXG4gICAgICAgICAgICBjYW5jZWwgPSAoKSA9PiB7fVxyXG4gICAgICAgIH1cclxuICAgIF0pID0+IHsgXHJcbiAgICAgICAgY29uc3QgaXN0ID0gdi5jb21tYW5kKGNvbW1hbmQgfHwgbmFtZSwgaGVscCkuXHJcbiAgICAgICAgICAgIGFsaWFzKGFsaWFzKS5cclxuICAgICAgICAgICAgYXV0b2NvbXBsZXRlKGF1dG9jb21wbGV0ZSB8fCBbXSkuXHJcbiAgICAgICAgICAgIGNhbmNlbChjYW5jZWwpLlxyXG4gICAgICAgICAgICBhY3Rpb24oaGFuZGxlcik7XHJcblxyXG4gICAgICAgIGlmKGhpZGRlbikge1xyXG4gICAgICAgICAgICBpc3QuaGlkZGVuKCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBPYmplY3QuZW50cmllcyhvcHRpb25zKS5cclxuICAgICAgICAgICAgZm9yRWFjaCgoWyBvcHRpb24sIG9wdGlvbl9oZWxwIF0pID0+IHtcclxuICAgICAgICAgICAgICAgIGlzdC5vcHRpb24ob3B0aW9uLCBvcHRpb25faGVscCk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgfSk7XHJcblxyXG5jb25zdCBzdGFydHVwX2NvbW1hbmRzID0gcHJvY2Vzcy5hcmd2LnNsaWNlKDIpO1xyXG5cclxuaWYoc3RhcnR1cF9jb21tYW5kcy5sZW5ndGggPiAwKSB7XHJcbiAgICB2LmV4ZWMoc3RhcnR1cF9jb21tYW5kcy5qb2luKGAgYCkpO1xyXG59IGVsc2Uge1xyXG5cclxuICAgIHByb2Nlc3Muc3Rkb3V0LndyaXRlKGBcXHgxQmNgKTtcclxuXHJcbiAgICBjb25zb2xlLmxvZyhjaGFsay5ncmVlbihgXHJcbuKWiOKWiOKVl+KWiOKWiOKWiOKWiOKWiOKWiOKWiOKVl+KWiOKWiOKWiOKWiOKWiOKWiOKWiOKVl+KWiOKWiOKVlyAg4paI4paI4pWXIOKWiOKWiOKWiOKWiOKWiOKVlyDilojilojilZcgICAgICDilojilojilojilojilojilojilojilZfilojilojilojilZcgICDilojilojilZcg4paI4paI4paI4paI4paI4paI4pWXIOKWiOKWiOKVl+KWiOKWiOKWiOKVlyAgIOKWiOKWiOKVl+KWiOKWiOKWiOKWiOKWiOKWiOKWiOKVlyAgICBcclxu4paI4paI4pWR4paI4paI4pWU4pWQ4pWQ4pWQ4pWQ4pWd4paI4paI4pWU4pWQ4pWQ4pWQ4pWQ4pWd4paI4paI4pWRIOKWiOKWiOKVlOKVneKWiOKWiOKVlOKVkOKVkOKWiOKWiOKVl+KWiOKWiOKVkeKWhCDilojilojilZfiloTilojilojilZTilZDilZDilZDilZDilZ3ilojilojilojilojilZcgIOKWiOKWiOKVkeKWiOKWiOKVlOKVkOKVkOKVkOKVkOKVnSDilojilojilZHilojilojilojilojilZcgIOKWiOKWiOKVkeKWiOKWiOKVlOKVkOKVkOKVkOKVkOKVnSAgICBcclxu4paI4paI4pWR4paI4paI4paI4paI4paI4paI4paI4pWX4paI4paI4paI4paI4paI4pWXICDilojilojilojilojilojilZTilZ0g4paI4paI4paI4paI4paI4paI4paI4pWR4paI4paI4pWRIOKWiOKWiOKWiOKWiOKVl+KWiOKWiOKWiOKWiOKWiOKVlyAg4paI4paI4pWU4paI4paI4pWXIOKWiOKWiOKVkeKWiOKWiOKVkSAg4paI4paI4paI4pWX4paI4paI4pWR4paI4paI4pWU4paI4paI4pWXIOKWiOKWiOKVkeKWiOKWiOKWiOKWiOKWiOKVlyAgICAgIFxyXG7ilojilojilZHilZrilZDilZDilZDilZDilojilojilZHilojilojilZTilZDilZDilZ0gIOKWiOKWiOKVlOKVkOKWiOKWiOKVlyDilojilojilZTilZDilZDilojilojilZHilojilojilZHiloDilZrilojilojilZTiloDilojilojilZTilZDilZDilZ0gIOKWiOKWiOKVkeKVmuKWiOKWiOKVl+KWiOKWiOKVkeKWiOKWiOKVkSAgIOKWiOKWiOKVkeKWiOKWiOKVkeKWiOKWiOKVkeKVmuKWiOKWiOKVl+KWiOKWiOKVkeKWiOKWiOKVlOKVkOKVkOKVnSAgICAgIFxyXG7ilojilojilZHilojilojilojilojilojilojilojilZHilojilojilojilojilojilojilojilZfilojilojilZEgIOKWiOKWiOKVl+KWiOKWiOKVkSAg4paI4paI4pWR4paI4paI4pWRICDilZrilZDilZ0g4paI4paI4paI4paI4paI4paI4paI4pWX4paI4paI4pWRIOKVmuKWiOKWiOKWiOKWiOKVkeKVmuKWiOKWiOKWiOKWiOKWiOKWiOKVlOKVneKWiOKWiOKVkeKWiOKWiOKVkSDilZrilojilojilojilojilZHilojilojilojilojilojilojilojilZcgICAgXHJcbuKVmuKVkOKVneKVmuKVkOKVkOKVkOKVkOKVkOKVkOKVneKVmuKVkOKVkOKVkOKVkOKVkOKVkOKVneKVmuKVkOKVnSAg4pWa4pWQ4pWd4pWa4pWQ4pWdICDilZrilZDilZ3ilZrilZDilZ0gICAgICDilZrilZDilZDilZDilZDilZDilZDilZ3ilZrilZDilZ0gIOKVmuKVkOKVkOKVkOKVnSDilZrilZDilZDilZDilZDilZDilZ0g4pWa4pWQ4pWd4pWa4pWQ4pWdICDilZrilZDilZDilZDilZ3ilZrilZDilZDilZDilZDilZDilZDilZ0gICAgXHJcblZFUlNJT046ICR7dmVyc2lvbn0gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxyXG5gKSk7XHJcblxyXG4gICAgdi5kZWxpbWl0ZXIoY2hhbGsuYm9sZC5ncmVlbihgPmApKS5cclxuICAgICAgICBzaG93KCk7XHJcbn0iXSwibmFtZXMiOlsiY3JlYXRlRmlsdGVyIiwiZ2xvYiIsInRlcnNlciIsInRvbWwiLCJnaXQiLCJleGVjIiwic3Bhd24iLCJwbTIiLCJ3YXRjaCIsInN0b3AiLCJ2ZXJzaW9uIiwiY29tbWFuZHMiLCJjaGFsayJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQVNBLE1BQU0sV0FBVyxHQUFHLENBQUMsTUFBTSxHQUFHLE9BQU8sQ0FBQyxHQUFHLEVBQUUsS0FBSztJQUM1QyxNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFDdkMsSUFBSSxNQUFNLEtBQUssTUFBTSxFQUFFO1FBQ25CLE9BQU8sTUFBTSxDQUFDO0tBQ2pCOztJQUVELE9BQU8sV0FBVyxDQUFDLE1BQU0sQ0FBQyxDQUFDO0NBQzlCLENBQUM7O0FBRUYsTUFBTSxRQUFRLEdBQUcsV0FBVyxFQUFFLENBQUM7QUFDL0IsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7O0FBRWhDLE1BQU0sV0FBVyxHQUFHLENBQUMsUUFBUSxLQUFLO0lBQzlCLE1BQU0sYUFBYSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDO1FBQ3JDLE9BQU8sQ0FBQyxRQUFRLEVBQUUsUUFBUSxDQUFDO1FBQzNCLEtBQUssQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDcEIsSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsUUFBUSxDQUFDLEVBQUU7UUFDNUIsYUFBYSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7S0FDOUI7O0lBRUQsT0FBTyxhQUFhLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztDQUNsQyxDQUFDOztBQUVGLE1BQU0sV0FBVyxHQUFHLENBQUMsSUFBSTtJQUNyQixJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDWCxHQUFHLEVBQUU7UUFDTCxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNWLEtBQUssRUFBRSxDQUFDOztBQUVoQixXQUFlLENBQUM7SUFDWixPQUFPO0lBQ1AsT0FBTztDQUNWLEdBQUcsS0FBSyxLQUFLO0lBQ1YsTUFBTSxNQUFNLEdBQUdBLDhCQUFZLENBQUMsT0FBTyxFQUFFLE9BQU8sQ0FBQyxDQUFDOztJQUU5QyxPQUFPO1FBQ0gsSUFBSSxFQUFFLENBQUMsV0FBVyxDQUFDO1FBQ25CLElBQUksRUFBRSxDQUFDLEVBQUUsS0FBSztZQUNWLE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLE1BQU0sRUFBRSxFQUFFLEVBQUUsQ0FBQyxDQUFDOztZQUUzQyxJQUFJLE9BQU8sQ0FBQztZQUNaLElBQUk7Z0JBQ0EsT0FBTyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLFlBQVksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO2FBQ2xELENBQUMsTUFBTSxHQUFHLEVBQUU7Z0JBQ1QsT0FBTzthQUNWOztZQUVELE1BQU0sRUFBRSxRQUFRLEVBQUUsUUFBUSxFQUFFLEdBQUcsT0FBTyxDQUFDOztZQUV2QyxNQUFNLGtCQUFrQixHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsUUFBUSxDQUFDLENBQUM7WUFDckQsTUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQztZQUNuQyxNQUFNLFdBQVcsR0FBRyxRQUFRLENBQUM7O1lBRTdCLE1BQU0sS0FBSyxHQUFHQyxNQUFJLENBQUMsSUFBSSxDQUFDLFdBQVcsRUFBRTtnQkFDakMsR0FBRzthQUNOLENBQUMsQ0FBQzs7WUFFSCxJQUFJLElBQUksR0FBRyxFQUFFLENBQUMsZUFBZSxDQUFDLEVBQUUsQ0FBQztBQUM3QztZQUVZLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxLQUFLO2dCQUN2QixJQUFJLElBQUksQ0FBQztnQkFDVCxJQUFJLGtCQUFrQixFQUFFO29CQUNwQixJQUFJLEdBQUcsV0FBVyxDQUFDLElBQUksQ0FBQyxDQUFDO2lCQUM1QixNQUFNO29CQUNILElBQUksR0FBRyxXQUFXLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQztpQkFDL0M7Z0JBQ0QsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUMsT0FBTyxFQUFFLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO2dCQUMxQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsS0FBSyxFQUFFLFdBQVcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDbEUsYUFDYSxDQUFDLENBQUM7O1lBRUgsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLG1CQUFtQixDQUFDLENBQUMsQ0FBQzs7WUFFakMsSUFBSSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDOztZQUV2QixPQUFPLElBQUksQ0FBQzs7U0FFZjtRQUNELFNBQVMsRUFBRSxDQUFDLFFBQVEsRUFBRSxRQUFRLEtBQUs7WUFDL0IsSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFO2dCQUM5QyxPQUFPO2FBQ1Y7O1lBRUQsTUFBTSxJQUFJLEdBQUcsR0FBRyxDQUFDLFFBQVEsR0FBRyxRQUFRLENBQUMsQ0FBQzs7WUFFdEMsRUFBRSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxNQUFNLEVBQUUsRUFBRSxJQUFJLENBQUMsRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDO2dCQUMxRCxRQUFRO2dCQUNSLFFBQVE7YUFDWCxDQUFDLENBQUMsQ0FBQzs7WUFFSixPQUFPLElBQUksQ0FBQztTQUNmO0tBQ0osQ0FBQztDQUNMOztBQ3JHRCxjQUFlLENBQUM7SUFDWixJQUFJO0lBQ0osT0FBTztDQUNWO0tBQ0k7UUFDRyxJQUFJLEVBQUUsQ0FBQyxZQUFZLENBQUM7UUFDcEIsVUFBVSxFQUFFLE1BQU07WUFDZCxFQUFFLENBQUMsYUFBYSxDQUFDLElBQUksRUFBRSxPQUFPLEVBQUUsQ0FBQyxDQUFDO1NBQ3JDO0tBQ0osQ0FBQzs7QUNZTixNQUFNLFlBQVksR0FBRyxJQUFJLEVBQUUsQ0FBQztBQUM1QixNQUFNLFVBQVUsR0FBRyxLQUFLLENBQUM7O0FBRXpCLElBQUksY0FBYyxHQUFHLElBQUksRUFBRSxDQUFDOztBQUU1QixNQUFNLFFBQVEsR0FBRztJQUNiLENBQUMsT0FBTyxDQUFDO0lBQ1QsQ0FBQyxNQUFNLENBQUM7SUFDUixDQUFDLEVBQUUsQ0FBQztJQUNKLENBQUMsSUFBSSxDQUFDO0lBQ04sQ0FBQyxLQUFLLENBQUM7Q0FDVixDQUFDOztBQUVGLE1BQU0sSUFBSSxHQUFHLENBQUM7SUFDVixLQUFLO0lBQ0wsTUFBTTtDQUNULE1BQU07SUFDSCxLQUFLO0lBQ0wsTUFBTSxFQUFFO1FBQ0osU0FBUyxFQUFFLENBQUMsTUFBTSxDQUFDO1FBQ25CLElBQUksRUFBRSxNQUFNO1FBQ1osTUFBTSxFQUFFLENBQUMsR0FBRyxDQUFDO0tBQ2hCO0lBQ0QsUUFBUTtJQUNSLE9BQU8sRUFBRTtRQUNMLElBQUksRUFBRTtRQUNOLE9BQU8sQ0FBQztZQUNKLFlBQVk7U0FDZixDQUFDO1FBQ0YsRUFBRSxFQUFFO1FBQ0osSUFBSSxFQUFFO1FBQ04sSUFBSTtLQUNQO0NBQ0osQ0FBQyxDQUFDOzs7QUFHSCxNQUFNLE9BQU8sR0FBRyxDQUFDO0lBQ2IsS0FBSztJQUNMLE1BQU07SUFDTixHQUFHLEVBQUUsT0FBTyxHQUFHLENBQUMsY0FBYyxFQUFFLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTSxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUM7Q0FDckUsTUFBTTtJQUNILEtBQUs7SUFDTCxNQUFNLEVBQUU7UUFDSixJQUFJLEVBQUUsTUFBTTtRQUNaLE1BQU0sRUFBRSxDQUFDLElBQUksQ0FBQztRQUNkLE9BQU8sRUFBRTtZQUNMLFNBQVMsRUFBRSxDQUFDLElBQUksQ0FBQztTQUNwQjtLQUNKO0lBQ0QsUUFBUSxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsT0FBTyxDQUFDLEVBQUU7SUFDMUMsT0FBTyxFQUFFOzs7Ozs7Ozs7Ozs7Ozs7Ozs7O1FBbUJMLElBQUksRUFBRTtRQUNOLE9BQU8sRUFBRTtRQUNULEdBQUcsQ0FBQzs7U0FFSCxDQUFDO1FBQ0YsSUFBSSxFQUFFO1FBQ04sT0FBTyxDQUFDO1lBQ0osWUFBWTtZQUNaLGNBQWMsRUFBRSxNQUFNLGNBQWM7U0FDdkMsQ0FBQztRQUNGLElBQUk7UUFDSixFQUFFLEVBQUU7UUFDSixNQUFNLENBQUM7WUFDSCxHQUFHLEVBQUUsQ0FBQyxHQUFHLEtBQUs7Z0JBQ1YsR0FBRyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQzthQUN0QjtTQUNKLENBQUM7UUFDRixVQUFVLElBQUlDLHlCQUFNLEVBQUU7UUFDdEIsT0FBTyxDQUFDO1lBQ0osSUFBSSxFQUFFLENBQUMscUJBQXFCLENBQUM7WUFDN0IsT0FBTyxFQUFFLE1BQU0sY0FBYztTQUNoQyxDQUFDO0tBQ0w7Q0FDSixDQUFDLENBQUM7O0FBRUgsZUFBZTtJQUNYLElBQUk7SUFDSixPQUFPO0NBQ1Y7O0VBQUM7QUNwSEYsTUFBTSxRQUFRLEdBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRSxFQUFFLFNBQVMsS0FBS0QsTUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUM7SUFDMUQsTUFBTSxDQUFDLENBQUMsR0FBRyxFQUFFLFVBQVUsS0FBSztRQUN4QixNQUFNLFlBQVksR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsVUFBVSxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDekUsTUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsQ0FBQzs7UUFFN0MsR0FBRyxHQUFHLENBQUMsVUFBVSxDQUFDLEVBQUU7O1lBRWhCLE1BQU0sSUFBSSxLQUFLLENBQUMsQ0FBQyxFQUFFLFVBQVUsQ0FBQyxNQUFNLEVBQUUsWUFBWSxDQUFDLFVBQVUsRUFBRSxHQUFHLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7U0FDckY7O1FBRUQsT0FBTztZQUNILENBQUMsVUFBVSxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRSxFQUFFLElBQUksQ0FBQyxPQUFPLENBQUMsVUFBVSxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO1lBQ2hGLEdBQUcsR0FBRztTQUNULENBQUM7S0FDTCxFQUFFLEdBQUcsQ0FBQyxDQUFDOztBQUVaLGlCQUFlLE9BQU87SUFDbEIsTUFBTSxFQUFFO1FBQ0osQ0FBQyxXQUFXLENBQUM7UUFDYixDQUFDLDBCQUEwQixDQUFDO1FBQzVCLENBQUMsNkJBQTZCLENBQUM7S0FDbEMsQ0FBQyxNQUFNLENBQUMsUUFBUSxFQUFFLEVBQUUsQ0FBQztDQUN6QixDQUFDLENBQUM7O0FDdkJILE1BQU0sVUFBVSxHQUFHLENBQUMsVUFBVSxLQUFLOztJQUUvQixJQUFJLEdBQUcsQ0FBQzs7SUFFUixJQUFJO1FBQ0EsR0FBRyxHQUFHLEVBQUUsQ0FBQyxZQUFZLENBQUMsVUFBVSxFQUFFLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztLQUM5QyxDQUFDLE9BQU8sU0FBUyxFQUFFO1FBQ2hCLE1BQU0sSUFBSSxLQUFLLENBQUMsQ0FBQyxjQUFjLEVBQUUsVUFBVSxDQUFDLG9DQUFvQyxDQUFDLENBQUMsQ0FBQztLQUN0Rjs7SUFFRCxNQUFNLE1BQU0sR0FBR0UsTUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQzs7O0lBRy9CLEdBQUcsTUFBTSxDQUFDLEdBQUcsRUFBRTtRQUNYLE9BQU87WUFDSCxHQUFHLE1BQU0sQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUMsR0FBRyxFQUFFLFVBQVUsTUFBTTtnQkFDdkMsR0FBRyxVQUFVLENBQUMsQ0FBQyxVQUFVLEVBQUUsVUFBVSxDQUFDLEtBQUssQ0FBQyxDQUFDO2dCQUM3QyxHQUFHLEdBQUc7YUFDVCxDQUFDLEVBQUUsRUFBRSxDQUFDO1lBQ1AsR0FBRyxNQUFNO1NBQ1osQ0FBQztLQUNMOztJQUVELE9BQU8sTUFBTSxDQUFDO0NBQ2pCLENBQUM7O0FDbkJGO0FBQ0EsaUJBQWUsQ0FBQyxVQUFVLEtBQUssTUFBTSxDQUFDLE1BQU0sQ0FBQztJQUN6QyxVQUFVOztJQUVWLFVBQVUsRUFBRSxDQUFDLEVBQUUsVUFBVSxFQUFFLE1BQU07UUFDN0IsTUFBTSxFQUFFLFVBQVUsQ0FBQyxVQUFVLENBQUM7S0FDakMsQ0FBQzs7SUFFRixTQUFTLEVBQUUsQ0FBQztRQUNSLFVBQVU7S0FDYixLQUFLO1FBQ0YsTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxVQUFVLEVBQUUsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDOztRQUVoRCxNQUFNLFlBQVksR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQztRQUM1RCxNQUFNLFlBQVksR0FBRyxZQUFZO1lBQzdCLEtBQUssQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDO1lBQ2YsR0FBRyxFQUFFLENBQUM7O1FBRVYsT0FBTztZQUNILFlBQVk7WUFDWixZQUFZO1lBQ1osSUFBSTtTQUNQLENBQUM7S0FDTDs7SUFFRCxXQUFXLEVBQUUsQ0FBQztRQUNWLE1BQU07UUFDTixJQUFJO1FBQ0osTUFBTTtLQUNULEtBQUs7O1FBRUYsSUFBSSxLQUFLLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFDZixNQUFNLElBQUksR0FBRyxNQUFNLENBQUMsSUFBSTtjQUNsQixDQUFDLElBQUksQ0FBQztjQUNOLENBQUMsT0FBTyxDQUFDLENBQUM7O1FBRWhCLE1BQU0sS0FBSyxHQUFHLENBQUMsSUFBSSxLQUFLO1lBQ3BCLEtBQUssSUFBSSxDQUFDLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO1NBQzFCLENBQUM7O1FBRUYsS0FBSyxDQUFDLENBQUMsNEJBQTRCLENBQUMsQ0FBQyxDQUFDO1FBQ3RDLEtBQUssQ0FBQyxDQUFDLFdBQVcsRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDaEQsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7O1FBRVYsTUFBTSxLQUFLLEdBQUcsRUFBRSxDQUFDO1FBQ2pCLE1BQU0sT0FBTyxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDO1lBQy9CLE1BQU0sQ0FBQyxDQUFDLEdBQUcsS0FBSztnQkFDWixNQUFNLFFBQVEsR0FBRyxHQUFHLEtBQUssR0FBRyxDQUFDLFdBQVcsRUFBRSxDQUFDO2dCQUMzQyxHQUFHLENBQUMsUUFBUSxFQUFFO29CQUNWLE9BQU8sS0FBSyxDQUFDO2lCQUNoQjs7Z0JBRUQsTUFBTSxTQUFTLEdBQUcsTUFBTSxDQUFDLEdBQUcsQ0FBQyxLQUFLLFNBQVMsQ0FBQzs7Z0JBRTVDLE1BQU0sU0FBUyxHQUFHLEVBQUUsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDOztnQkFFNUQsR0FBRyxDQUFDLFNBQVMsSUFBSSxDQUFDLFNBQVMsRUFBRTtvQkFDekIsS0FBSyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztpQkFDbkI7O2dCQUVELE9BQU8sUUFBUSxJQUFJLFNBQVMsQ0FBQzthQUNoQyxDQUFDO1lBQ0YsR0FBRyxDQUFDLENBQUMsR0FBRyxLQUFLO2dCQUNULE1BQU0sS0FBSyxHQUFHLE1BQU0sQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUM7c0JBQzFCLENBQUMsRUFBRSxDQUFDO3NCQUNKLENBQUMsR0FBRyxFQUFFLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQzt3QkFDL0IsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7O2dCQUVwQixLQUFLLENBQUMsQ0FBQyxPQUFPLEVBQUUsR0FBRyxDQUFDLE9BQU8sRUFBRSxLQUFLLENBQUMsUUFBUSxFQUFFLEdBQUcsQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7O2dCQUVqRSxPQUFPLEdBQUcsQ0FBQzthQUNkLENBQUMsQ0FBQzs7UUFFUCxNQUFNLE1BQU0sR0FBRyxLQUFLLENBQUMsTUFBTSxHQUFHLENBQUM7Y0FDekIsQ0FBQyxrQkFBa0IsRUFBRSxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDN0MsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO2NBQ2YsQ0FBQyxDQUFDLENBQUM7O1FBRVQsTUFBTSxJQUFJLEdBQUcsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDLE1BQU0sRUFBRSxHQUFHLEtBQUssQ0FBQyxFQUFFLE1BQU0sQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7O1FBRTdFLEtBQUssQ0FBQyxDQUFDO2tCQUNHLEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7O1FBRXZCLE1BQU0sR0FBRyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDbkIsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQyxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDOztRQUVqRCxJQUFJLENBQUMsRUFBRSxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsRUFBRTtZQUNyQixPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsU0FBUyxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUMvQixFQUFFLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1NBQ3JCOztRQUVELEVBQUUsQ0FBQyxhQUFhLENBQUMsS0FBSyxFQUFFLEtBQUssRUFBRSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7O1FBRXhDLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQztDQUNwQixFQUFFLElBQUksQ0FBQyxFQUFFLEVBQUUsSUFBSSxDQUFDOzs7QUFHakIsRUFBRSxDQUFDLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ25DLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQzs7QUFFckIsRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDO0FBQ2hCLENBQUMsQ0FBQyxDQUFDOztRQUVLLE9BQU87WUFDSCxLQUFLO1NBQ1IsQ0FBQztLQUNMOztJQUVELFlBQVksRUFBRSxDQUFDO1FBQ1gsS0FBSztRQUNMLElBQUk7UUFDSixNQUFNO0tBQ1QsS0FBSztRQUNGLEdBQUcsTUFBTSxDQUFDLElBQUksSUFBSSxNQUFNLENBQUMsT0FBTyxFQUFFO1lBQzlCLE1BQU0sSUFBSSxLQUFLLENBQUMsQ0FBQywyQ0FBMkMsQ0FBQyxDQUFDLENBQUM7U0FDbEU7O1FBRUQsR0FBRyxNQUFNLENBQUMsSUFBSSxFQUFFO1lBQ1osTUFBTSxNQUFNLEdBQUcsQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDOztZQUVqQyxPQUFPO2dCQUNILE1BQU07Z0JBQ04sVUFBVSxFQUFFLFFBQVEsQ0FBQyxJQUFJLENBQUM7b0JBQ3RCLEtBQUs7b0JBQ0wsTUFBTTtpQkFDVCxDQUFDO2FBQ0wsQ0FBQztTQUNMOztRQUVELEdBQUcsTUFBTSxDQUFDLE9BQU8sRUFBRTtZQUNmLE1BQU0sTUFBTSxHQUFHLENBQUMsWUFBWSxFQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQzs7WUFFeEMsT0FBTztnQkFDSCxNQUFNO2dCQUNOLFVBQVUsRUFBRSxRQUFRLENBQUMsT0FBTyxDQUFDO29CQUN6QixLQUFLO29CQUNMLE1BQU07aUJBQ1QsQ0FBQzthQUNMLENBQUM7U0FDTDs7UUFFRCxNQUFNLElBQUksS0FBSyxDQUFDLENBQUMsaUZBQWlGLENBQUMsQ0FBQyxDQUFDO0tBQ3hHO0NBQ0osQ0FBQztJQUNFLE1BQU0sQ0FBQyxDQUFDLEtBQUssRUFBRSxFQUFFLE1BQU07UUFDbkIsR0FBRyxLQUFLO1FBQ1IsR0FBRyxFQUFFLENBQUMsS0FBSyxDQUFDO0tBQ2YsQ0FBQyxFQUFFLEVBQUUsVUFBVSxFQUFFLENBQUMsQ0FBQzs7QUN2SnhCLGVBQWUsQ0FBQyxPQUFPLEdBQUcsS0FBSyxLQUFLO0lBQ2hDLEdBQUcsQ0FBQyxPQUFPLEVBQUU7UUFDVCxPQUFPRixNQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztZQUNoQyxHQUFHLENBQUMsQ0FBQyxVQUFVLEtBQUssSUFBSSxDQUFDLFFBQVEsQ0FBQyxVQUFVLEVBQUUsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7S0FDL0Q7OztJQUdELE9BQU9BLE1BQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO1FBQ2hDLE1BQU0sQ0FBQyxDQUFDLE1BQU0sS0FBSyxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDO1FBQzNDLEdBQUcsQ0FBQyxDQUFDLFVBQVUsS0FBSyxJQUFJLENBQUMsUUFBUSxDQUFDLFVBQVUsRUFBRSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztDQUMvRDs7RUFBQyxnQkNaYSxDQUFDLE9BQU8sS0FBSyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUMsTUFBTSxLQUFLO0lBQ25ELE1BQU0sT0FBTyxHQUFHLFFBQVEsRUFBRTtRQUN0QixPQUFPLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7O0lBRTNCLEdBQUcsQ0FBQyxPQUFPLEVBQUU7UUFDVCxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxNQUFNLENBQUMsNkJBQTZCLENBQUMsQ0FBQyxDQUFDO0tBQ3pEOztJQUVELE9BQU8sT0FBTyxDQUFDO0NBQ2xCLENBQUMsQ0FBQzs7QUNSSCxxQkFBZSxDQUFDO0lBQ1osR0FBRztJQUNILE9BQU87Q0FDVixLQUFLO0lBQ0YsR0FBRyxDQUFDLE9BQU8sRUFBRTtRQUNULE9BQU8sR0FBRyxDQUFDLE1BQU0sQ0FBQztZQUNkLElBQUksRUFBRSxDQUFDLElBQUksQ0FBQztZQUNaLElBQUksRUFBRSxDQUFDLE1BQU0sQ0FBQztZQUNkLE9BQU8sRUFBRSxDQUFDLGVBQWUsQ0FBQztZQUMxQixPQUFPLEVBQUUsRUFBRSxDQUFDLEdBQUcsQ0FBQyxFQUFFLEdBQUcsUUFBUSxFQUFFLEVBQUU7U0FDcEMsQ0FBQztZQUNFLElBQUksQ0FBQyxDQUFDLEVBQUUsTUFBTSxFQUFFLEtBQUssTUFBTSxLQUFLLENBQUMsR0FBRyxDQUFDO2tCQUMvQixRQUFRLEVBQUU7a0JBQ1YsV0FBVyxDQUFDLEVBQUUsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDO0tBQ3RDOztJQUVELEdBQUcsT0FBTyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLEVBQUU7UUFDckIsT0FBTyxRQUFRLEVBQUUsQ0FBQztLQUNyQjs7SUFFRCxPQUFPLFdBQVcsQ0FBQyxPQUFPLENBQUMsQ0FBQztDQUMvQjs7QUNuQkQsU0FBZSxDQUFDO0lBQ1osT0FBTyxFQUFFLENBQUMsa0JBQWtCLENBQUM7SUFDN0IsSUFBSSxFQUFFLENBQUMsMkJBQTJCLENBQUM7SUFDbkMsTUFBTSxFQUFFLElBQUk7SUFDWixNQUFNLE9BQU8sQ0FBQyxFQUFFLE9BQU8sRUFBRSxFQUFFO1FBQ3ZCLE1BQU0sT0FBTyxHQUFHLE1BQU0sY0FBYyxDQUFDO1lBQ2pDLEdBQUcsRUFBRSxJQUFJO1lBQ1QsT0FBTztTQUNWLENBQUMsQ0FBQzs7UUFFSCxNQUFNLEtBQUssR0FBRyxNQUFNLE9BQU8sQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxPQUFPLE1BQU0sS0FBSztZQUMxRCxNQUFNLEVBQUUsVUFBVSxFQUFFLElBQUksRUFBRSxHQUFHLE1BQU0sVUFBVSxDQUFDLENBQUMsVUFBVSxFQUFFLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO1lBQzFFLE1BQU0sTUFBTSxHQUFHLE1BQU0sTUFBTSxDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQUMsQ0FBQzs7WUFFL0MsTUFBTSxNQUFNLENBQUMsS0FBSyxDQUFDLFVBQVUsQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUN0QyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDLENBQUM7U0FDaEQsQ0FBQyxDQUFDLENBQUM7O1FBRUosT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQU0sRUFBRSxLQUFLLENBQUMsTUFBTSxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUM7S0FDckQ7Q0FDSjs7QUN2QkQsTUFBTSxHQUFHLEdBQUcsR0FBRyxFQUFFLENBQUM7O0FBRWxCLFNBQWUsQ0FBQztJQUNaLE9BQU8sRUFBRSxDQUFDLG1CQUFtQixDQUFDO0lBQzlCLElBQUksRUFBRSxDQUFDLHNDQUFzQyxDQUFDO0lBQzlDLE9BQU8sRUFBRSxDQUFDO1FBQ04sT0FBTyxHQUFHLEVBQUUsQ0FBQyx5QkFBeUIsQ0FBQyxFQUFFO0tBQzVDLEtBQUssR0FBRyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztRQUNsQixJQUFJLENBQUMsTUFBTSxHQUFHLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDekMsSUFBSSxDQUFDLE1BQU0sR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQztRQUN4QyxJQUFJLENBQUMsTUFBTSxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsc0JBQXNCLEVBQUUsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7Q0FDNUUsRUFBRTs7QUNUSCxNQUFNRyxLQUFHLEdBQUcsR0FBRyxFQUFFLENBQUM7O0FBRWxCLFNBQWUsQ0FBQztJQUNaLE9BQU8sRUFBRSxDQUFDLHdCQUF3QixDQUFDO0lBQ25DLElBQUksRUFBRSxDQUFDLCtEQUErRCxDQUFDO0lBQ3ZFLEtBQUssRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLEVBQUU7SUFDakIsT0FBTyxFQUFFO1FBQ0wsYUFBYSxFQUFFLENBQUMsNkJBQTZCLENBQUM7S0FDakQ7SUFDRCxPQUFPLEVBQUUsQ0FBQztRQUNOLFFBQVEsR0FBRyxDQUFDLG1CQUFtQixDQUFDO1FBQ2hDLElBQUksR0FBRyxDQUFDLENBQUMsQ0FBQztRQUNWLE9BQU8sRUFBRTtZQUNMLEtBQUssR0FBRyxLQUFLO1NBQ2hCLEdBQUcsS0FBSztLQUNaLEtBQUssS0FBSyxDQUFDLFFBQVEsRUFBRSxFQUFFLEtBQUssRUFBRSxDQUFDO1FBQzVCLEtBQUssQ0FBQyxJQUFJLENBQUM7UUFDWCxJQUFJLENBQUMsTUFBTUEsS0FBRyxDQUFDLElBQUksRUFBRSxDQUFDO1FBQ3RCLElBQUksQ0FBQyxNQUFNLElBQUksT0FBTyxDQUFDLENBQUMsT0FBTyxFQUFFLE1BQU0sS0FBSztZQUN4QyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxRQUFRLENBQUMsV0FBVyxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUM3QyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsZ0NBQWdDLENBQUMsQ0FBQyxDQUFDO1lBQ2hEQyxrQkFBSSxDQUFDLENBQUMsV0FBVyxDQUFDLEVBQUUsQ0FBQyxHQUFHLEtBQUs7Z0JBQ3pCLEdBQUcsR0FBRyxFQUFFO29CQUNKLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQztpQkFDZjtnQkFDRCxPQUFPLEVBQUUsQ0FBQzthQUNiLENBQUMsQ0FBQztTQUNOLENBQUMsQ0FBQztRQUNILElBQUksQ0FBQyxNQUFNO1lBQ1AsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDLHNDQUFzQyxDQUFDLENBQUMsQ0FBQztTQUN6RCxDQUFDO0NBQ1Q7O0FDakNELFNBQWUsQ0FBQztJQUNaLElBQUksRUFBRSxDQUFDLDhCQUE4QixDQUFDO0lBQ3RDLEtBQUssRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUMsRUFBRTtJQUN4QixPQUFPLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBRSxLQUFLO1FBQ25CLE9BQU8sQ0FBQyxHQUFHLENBQUMsUUFBUSxFQUFFO1lBQ2xCLEdBQUcsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDcEIsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7O1FBRXpCLEVBQUUsRUFBRSxDQUFDO0tBQ1I7Q0FDSjs7QUNaRDtBQUNBO0FBR0EsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDOztBQUV0RCxVQUFlLENBQUMsRUFBRSxRQUFRLEVBQUUsS0FBSztJQUM3QixJQUFJLElBQUksR0FBR0MsbUJBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsRUFBRSxRQUFRLENBQUMsU0FBUyxFQUFFLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFO1FBQzdFLEdBQUcsRUFBRSxPQUFPLENBQUMsR0FBRyxFQUFFO1FBQ2xCLEdBQUcsRUFBRSxPQUFPLENBQUMsR0FBRztRQUNoQixLQUFLLEVBQUUsQ0FBQyxPQUFPLENBQUM7S0FDbkIsQ0FBQyxDQUFDOztJQUVILE9BQU87UUFDSCxJQUFJLEVBQUUsSUFBSSxPQUFPLENBQUMsQ0FBQyxPQUFPLEtBQUs7WUFDM0IsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxFQUFFLE1BQU07Z0JBQ25CLE9BQU8sRUFBRSxDQUFDO2dCQUNWLElBQUksR0FBRyxLQUFLLENBQUM7YUFDaEIsQ0FBQyxDQUFDO1NBQ04sQ0FBQzs7UUFFRixNQUFNLEVBQUUsTUFBTTtZQUNWLEdBQUcsQ0FBQyxJQUFJLEVBQUU7Z0JBQ04sT0FBTzthQUNWOztZQUVELElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQztTQUNmO0tBQ0osQ0FBQztDQUNMLENBQUM7O0FDM0JGLFNBQWUsQ0FBQztJQUNaLE9BQU8sRUFBRSxDQUFDLGlCQUFpQixDQUFDO0lBQzVCLElBQUksRUFBRSxDQUFDLCtCQUErQixDQUFDO0lBQ3ZDLE9BQU8sRUFBRSxDQUFDLEVBQUUsT0FBTyxHQUFHLEVBQUUsRUFBRSxLQUFLLEdBQUcsQ0FBQztRQUMvQixRQUFRLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxFQUFFLEdBQUcsT0FBTyxFQUFFO0tBQ25DLENBQUMsQ0FBQyxJQUFJOztDQUVWOztBQ05ELE1BQU1GLEtBQUcsR0FBRyxHQUFHLEVBQUUsQ0FBQzs7QUFFbEIsU0FBZSxDQUFDO0lBQ1osT0FBTyxFQUFFLENBQUMsSUFBSSxDQUFDO0lBQ2YsSUFBSSxFQUFFLENBQUMscUNBQXFDLENBQUM7SUFDN0MsT0FBTyxFQUFFLE1BQU1BLEtBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQ3ZDLElBQUksQ0FBQyxNQUFNLElBQUksT0FBTyxDQUFDLENBQUMsT0FBTyxFQUFFLE1BQU0sS0FBSztZQUN4Q0Msa0JBQUksQ0FBQyxDQUFDLFdBQVcsQ0FBQyxFQUFFLENBQUMsR0FBRyxLQUFLO2dCQUN6QixHQUFHLEdBQUcsRUFBRTtvQkFDSixNQUFNLENBQUMsR0FBRyxDQUFDLENBQUM7aUJBQ2Y7Z0JBQ0QsT0FBTyxFQUFFLENBQUM7YUFDYixDQUFDLENBQUM7U0FDTixDQUFDLENBQUM7UUFDSCxJQUFJLENBQUMsTUFBTSxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsa0NBQWtDLENBQUMsQ0FBQyxDQUFDO0NBQ3BFLEVBQUU7O0FDYkg7QUFDQSxTQUFlLENBQUM7SUFDWixPQUFPLEVBQUUsQ0FBQyxJQUFJLENBQUM7SUFDZixLQUFLLEVBQUUsRUFBRSxDQUFDLE9BQU8sQ0FBQyxFQUFFO0lBQ3BCLE1BQU0sT0FBTyxHQUFHO1FBQ1osTUFBTSxPQUFPLENBQUMsR0FBRyxDQUFDSixNQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztZQUMzQyxHQUFHLENBQUMsQ0FBQyxNQUFNLEtBQUs7Z0JBQ1osTUFBTSxFQUFFLEtBQUssRUFBRSxHQUFHLFVBQVUsQ0FBQyxNQUFNLENBQUMsQ0FBQztnQkFDckMsR0FBRyxLQUFLLElBQUksS0FBSyxDQUFDLEtBQUssRUFBRTtvQkFDckIsTUFBTTt3QkFDRixHQUFHLEdBQUcsQ0FBQyxxQkFBcUIsQ0FBQzt3QkFDN0IsS0FBSztxQkFDUixHQUFHLEtBQUssQ0FBQztvQkFDVixPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsU0FBUyxFQUFFLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTSxFQUFFLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDOztvQkFFcEUsT0FBTyxLQUFLLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxNQUFNLENBQUMsRUFBRTt3QkFDekIsTUFBTSxFQUFFLENBQUMsSUFBSSxDQUFDO3dCQUNkLEtBQUssRUFBRSxDQUFDLFFBQVEsQ0FBQzt3QkFDakIsT0FBTyxFQUFFOzRCQUNMLGNBQWMsRUFBRSxDQUFDLGdCQUFnQixDQUFDO3lCQUNyQzt3QkFDRCxJQUFJLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQzs0QkFDakIsS0FBSzt5QkFDUixDQUFDO3FCQUNMLENBQUMsQ0FBQztpQkFDTjs7Z0JBRUQsT0FBTyxPQUFPLENBQUMsT0FBTyxFQUFFLENBQUM7YUFDNUIsQ0FBQyxDQUFDLENBQUM7O0tBRVg7Q0FDSjs7QUNsQ0QsU0FBZSxDQUFDO0lBQ1osT0FBTyxFQUFFLENBQUMsTUFBTSxDQUFDO0lBQ2pCLElBQUksRUFBRSxDQUFDLHFCQUFxQixDQUFDOztJQUU3QixPQUFPLEVBQUUsTUFBTTtRQUNYLE1BQU07WUFDRixJQUFJO1lBQ0osTUFBTTtTQUNULEdBQUcsVUFBVSxFQUFFLENBQUM7O1FBRWpCLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQzs7QUFFckIsRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQztRQUNYLEdBQUcsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDcEIsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQzs7O0FBR3BCLEVBQUUsTUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUM7UUFDYixHQUFHLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ3BCLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7QUFDcEIsQ0FBQyxDQUFDLENBQUM7S0FDRTtDQUNKOztBQ2xCRCxTQUFlLENBQUM7SUFDWixTQUFTLEVBQUUsQ0FBQyxrQkFBa0IsQ0FBQztJQUMvQixJQUFJLEVBQUUsQ0FBQyxxQkFBcUIsQ0FBQztJQUM3QixNQUFNLEVBQUUsSUFBSTtJQUNaLE1BQU0sT0FBTyxDQUFDLEVBQUUsT0FBTyxFQUFFLEVBQUU7UUFDdkIsTUFBTSxPQUFPLEdBQUcsTUFBTSxjQUFjLENBQUM7WUFDakMsR0FBRyxFQUFFLElBQUk7WUFDVCxPQUFPO1NBQ1YsQ0FBQyxDQUFDOztRQUVILE9BQU8sQ0FBQyxPQUFPLENBQUMsQ0FBQyxNQUFNLEtBQUs7WUFDeEIsTUFBTTtnQkFDRixNQUFNO2FBQ1QsR0FBRyxVQUFVLENBQUMsQ0FBQyxVQUFVLEVBQUUsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7OztZQUczQ00sS0FBRyxDQUFDLEtBQUssQ0FBQztnQkFDTixJQUFJLEVBQUUsTUFBTTtnQkFDWixNQUFNLEVBQUUsTUFBTTtnQkFDZCxLQUFLLEVBQUUsQ0FBQyxFQUFFLEVBQUUsTUFBTSxDQUFDLENBQUM7Z0JBQ3BCLEtBQUssRUFBRSxJQUFJO2dCQUNYLGFBQWEsRUFBRTs7b0JBRVgsT0FBTyxFQUFFLENBQUMsQ0FBQztvQkFDWCxVQUFVLEVBQUUsSUFBSTtpQkFDbkI7Z0JBQ0QsV0FBVyxFQUFFLENBQUM7YUFDakIsQ0FBQyxDQUFDO1NBQ04sQ0FBQyxDQUFDOztRQUVILE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQyxRQUFRLEVBQUUsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7S0FDakQ7Q0FDSixFQUFFOztBQ3RDSCxhQUFlO0lBQ1gsVUFBVTtJQUNWLE9BQU8sR0FBRyxDQUFDLENBQUMsS0FBSyxDQUFDO0tBQ2pCLENBQUMsS0FBSyxLQUFLO0lBQ1osTUFBTSxHQUFHLEdBQUcsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDOztJQUUzQixHQUFHLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxFQUFFO1FBQ2pCLE9BQU87S0FDVjs7SUFFRCxPQUFPLFVBQVUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQztDQUNqQzs7QUNGRCxVQUFlLENBQUM7SUFDWixPQUFPLEVBQUUsQ0FBQyxpQkFBaUIsQ0FBQztJQUM1QixJQUFJLEVBQUUsQ0FBQyxtQkFBbUIsQ0FBQztJQUMzQixLQUFLLEVBQUUsRUFBRSxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUMsRUFBRTtJQUM1QyxNQUFNLEVBQUUsSUFBSTtJQUNaLE1BQU0sQ0FBQyxHQUFHO1FBQ04sSUFBSSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxPQUFPLEtBQUssT0FBTyxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUM7UUFDcEQsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDLG9CQUFvQixDQUFDLENBQUMsQ0FBQztLQUN2QztJQUNELE1BQU0sT0FBTyxDQUFDLEVBQUUsT0FBTyxFQUFFLEVBQUU7UUFDdkIsSUFBSSxDQUFDLFFBQVEsR0FBRyxFQUFFLENBQUM7O1FBRW5CLE1BQU0sT0FBTyxHQUFHLE1BQU0sY0FBYyxDQUFDO1lBQ2pDLEdBQUcsRUFBRSxJQUFJO1lBQ1QsT0FBTztTQUNWLENBQUMsQ0FBQzs7UUFFSCxPQUFPLENBQUMsT0FBTyxDQUFDLENBQUMsTUFBTSxLQUFLO1lBQ3hCLE1BQU0sU0FBUyxHQUFHLENBQUMsVUFBVSxFQUFFLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQzs7WUFFN0MsTUFBTSxJQUFJLEdBQUcsVUFBVSxDQUFDLFNBQVMsQ0FBQyxDQUFDOztZQUVuQyxNQUFNLEVBQUUsVUFBVSxFQUFFLEdBQUcsSUFBSSxDQUFDOzs7WUFHNUIsTUFBTSxPQUFPLEdBQUcsUUFBUSxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsQ0FBQzs7WUFFMUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxFQUFFLE1BQU07Z0JBQ3ZCLFVBQVUsQ0FBQyxTQUFTLENBQUMsQ0FBQzthQUN6QixDQUFDLENBQUM7O1lBRUgsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUM7O1lBRTVCLE1BQU0sY0FBYyxHQUFHLE1BQU0sQ0FBQyxLQUFLLENBQUM7Z0JBQ2hDLEdBQUcsVUFBVTtnQkFDYixLQUFLLEVBQUU7b0JBQ0gsV0FBVyxFQUFFLElBQUk7aUJBQ3BCO2FBQ0osQ0FBQztnQkFDRSxFQUFFLENBQUMsQ0FBQyxLQUFLLENBQUMsRUFBRSxNQUFNLENBQUM7b0JBQ2YsVUFBVSxFQUFFLE1BQU07d0JBQ2QsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxNQUFNLENBQUMsZUFBZSxDQUFDLENBQUMsQ0FBQztxQkFDNUM7b0JBQ0QsS0FBSyxFQUFFLENBQUMsQ0FBQyxLQUFLO3dCQUNWLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7cUJBQ2xCO29CQUNELEtBQUssRUFBRSxDQUFDLEVBQUUsS0FBSyxFQUFFLEtBQUs7d0JBQ2xCLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztxQkFDcEM7aUJBQ0osRUFBRSxDQUFDLEVBQUUsSUFBSSxFQUFFLEtBQUssSUFBSTtpQkFDcEIsQ0FBQyxDQUFDOztZQUVQLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDO1NBQ3RDLENBQUMsQ0FBQztLQUNOO0NBQ0osRUFBRTs7QUM3REgsVUFBZSxDQUFDO0lBQ1osT0FBTyxFQUFFLENBQUMsaUJBQWlCLENBQUM7SUFDNUIsSUFBSSxFQUFFLENBQUMscUJBQXFCLENBQUM7SUFDN0IsS0FBSyxFQUFFLEVBQUUsQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsRUFBRTtJQUM3QyxNQUFNLEdBQUc7UUFDTCxJQUFJLENBQUMsUUFBUSxFQUFFLENBQUM7S0FDbkI7O0lBRUQsT0FBTyxDQUFDLEVBQUUsT0FBTyxHQUFHLFFBQVEsRUFBRSxFQUFFLEdBQUcsS0FBSyxFQUFFO1FBQ3RDLE1BQU0sSUFBSSxHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLEtBQUssQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQzNDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7O1FBRWhCLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDOztRQUUvQixNQUFNLEVBQUUsTUFBTSxFQUFFLElBQUksRUFBRSxHQUFHLEdBQUcsQ0FBQztZQUN6QixRQUFRLEVBQUUsRUFBRSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLEVBQUU7U0FDaEMsQ0FBQyxDQUFDOztRQUVILElBQUksQ0FBQyxRQUFRLEdBQUcsTUFBTSxDQUFDOztRQUV2QixPQUFPLElBQUksQ0FBQztLQUNmO0NBQ0osRUFBRTs7QUNsQkgsTUFBTSxXQUFXLEdBQUcsQ0FBQyxFQUFFLE9BQU8sRUFBRSxLQUFLO0lBQ2pDQyxHQUFLLENBQUMsT0FBTyxDQUFDLEVBQUUsT0FBTyxFQUFFLENBQUMsQ0FBQztJQUMzQkYsRUFBSyxDQUFDLE9BQU8sQ0FBQyxFQUFFLE9BQU8sRUFBRSxDQUFDLENBQUM7O0lBRTNCLE9BQU8sR0FBRyxDQUFDO1FBQ1AsUUFBUSxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsRUFBRTtLQUN2QixDQUFDLENBQUMsSUFBSSxDQUFDO0NBQ1gsQ0FBQzs7QUFFRixTQUFlLENBQUM7SUFDWixPQUFPLEVBQUUsQ0FBQyxtQkFBbUIsQ0FBQztJQUM5QixJQUFJLEVBQUUsQ0FBQyw2QkFBNkIsQ0FBQztJQUNyQyxLQUFLLEVBQUUsRUFBRSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsRUFBRTtJQUNoQyxNQUFNLE9BQU8sQ0FBQyxFQUFFLE9BQU8sRUFBRSxFQUFFO1FBQ3ZCLE1BQU0sT0FBTyxHQUFHLE1BQU0sY0FBYyxDQUFDO1lBQ2pDLEdBQUcsRUFBRSxJQUFJO1lBQ1QsT0FBTztTQUNWLENBQUMsQ0FBQzs7UUFFSCxNQUFNRyxHQUFJLENBQUMsT0FBTyxFQUFFLENBQUM7O1FBRXJCLE9BQU8sV0FBVyxDQUFDLEVBQUUsT0FBTyxFQUFFLE9BQU8sRUFBRSxDQUFDLENBQUM7S0FDNUM7O0lBRUQsTUFBTSxHQUFHO1FBQ0xELEdBQUssQ0FBQyxNQUFNLEVBQUUsQ0FBQztLQUNsQjtDQUNKLEVBQUU7O0FDaENILFVBQWMsQ0FBQztJQUNYLE9BQU8sRUFBRSxDQUFDLGVBQWUsQ0FBQztJQUMxQixJQUFJLEVBQUUsQ0FBQywyQkFBMkIsQ0FBQztJQUNuQyxLQUFLLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUMsRUFBRTtJQUNsQyxPQUFPLEVBQUUsTUFBTSxHQUFHLENBQUM7UUFDZixRQUFRLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFO0tBQ3JCLENBQUMsQ0FBQyxJQUFJO0NBQ1Y7Ozs7QUNQRCxVQUFlLENBQUM7SUFDWixPQUFPLEVBQUUsQ0FBQyxPQUFPLENBQUM7SUFDbEIsSUFBSSxFQUFFLENBQUMsV0FBVyxFQUFFRSxTQUFPLENBQUMsQ0FBQztJQUM3QixPQUFPLEVBQUUsTUFBTTtRQUNYLE9BQU8sQ0FBQyxHQUFHLENBQUNBLFNBQU8sQ0FBQyxDQUFDO0tBQ3hCO0NBQ0o7O0FDUkQsTUFBTSxHQUFHLEdBQUcsRUFBRSxDQUFDO0FBRWYsR0FBRyxDQUFDLE9BQU8sQ0FBQyxHQUFHLEVBQUUsQ0FBQztBQUVsQixHQUFHLENBQUMsUUFBUSxDQUFDLEdBQUcsRUFBRSxDQUFDO0FBRW5CLEdBQUcsQ0FBQyxRQUFRLENBQUMsR0FBRyxFQUFFLENBQUM7QUFFbkIsR0FBRyxDQUFDLFNBQVMsQ0FBQyxHQUFHLEVBQUUsQ0FBQztBQUVwQixHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsRUFBRSxDQUFDO0FBRWpCLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxFQUFFLENBQUM7QUFFakIsR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLEVBQUUsQ0FBQztBQUVqQixHQUFHLENBQUMsUUFBUSxDQUFDLEdBQUcsRUFBRSxDQUFDO0FBRW5CLEdBQUcsQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFLENBQUM7QUFFbEIsR0FBRyxDQUFDLE9BQU8sQ0FBQyxHQUFHLEVBQUUsQ0FBQztBQUVsQixHQUFHLENBQUMsUUFBUSxDQUFDLEdBQUcsR0FBRyxDQUFDO0FBRXBCLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxHQUFHLENBQUM7QUFFbEIsR0FBRyxDQUFDLFNBQVMsQ0FBQyxHQUFHLEdBQUcsQ0FBQztBQUVyQixHQUFHLENBQUMsT0FBTyxDQUFDLEdBQUcsR0FBRyxDQUFDOztBQzFCbkIsTUFBTSxFQUFFLEdBQUcsRUFBRSxHQUFHLE9BQU8sQ0FBQzs7QUFFeEIsT0FBTyxDQUFDLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxLQUFLLEdBQUc7SUFDMUIsR0FBRyxJQUFJLENBQUMsR0FBRztRQUNQLENBQUMsSUFBSSxLQUFLLE9BQU8sSUFBSSxLQUFLLENBQUMsTUFBTSxDQUFDO2NBQzVCLENBQUMsQ0FBQyxLQUFLO2dCQUNMLElBQUksQ0FBQyxPQUFPLENBQUMsbUJBQW1CLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO2FBQ3hEO2NBQ0MsSUFBSTtLQUNiO0NBQ0osQ0FBQzs7QUNGRixNQUFNLENBQUMsR0FBRyxNQUFNLEVBQUUsQ0FBQzs7QUFFbkIsTUFBTSxDQUFDLE9BQU8sQ0FBQ0MsR0FBUSxDQUFDO0lBQ3BCLE9BQU8sQ0FBQyxDQUFDO1FBQ0wsSUFBSSxFQUFFO1lBQ0YsSUFBSTtZQUNKLE9BQU87WUFDUCxZQUFZO1lBQ1osTUFBTTtZQUNOLE9BQU87WUFDUCxLQUFLLEdBQUcsRUFBRTtZQUNWLE9BQU8sR0FBRyxFQUFFO1lBQ1osTUFBTSxHQUFHLE1BQU0sRUFBRTtTQUNwQjtLQUNKLEtBQUs7UUFDRixNQUFNLEdBQUcsR0FBRyxDQUFDLENBQUMsT0FBTyxDQUFDLE9BQU8sSUFBSSxJQUFJLEVBQUUsSUFBSSxDQUFDO1lBQ3hDLEtBQUssQ0FBQyxLQUFLLENBQUM7WUFDWixZQUFZLENBQUMsWUFBWSxJQUFJLEVBQUUsQ0FBQztZQUNoQyxNQUFNLENBQUMsTUFBTSxDQUFDO1lBQ2QsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDOztRQUVwQixHQUFHLE1BQU0sRUFBRTtZQUNQLEdBQUcsQ0FBQyxNQUFNLEVBQUUsQ0FBQztTQUNoQjs7UUFFRCxNQUFNLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQztZQUNuQixPQUFPLENBQUMsQ0FBQyxFQUFFLE1BQU0sRUFBRSxXQUFXLEVBQUUsS0FBSztnQkFDakMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxNQUFNLEVBQUUsV0FBVyxDQUFDLENBQUM7YUFDbkMsQ0FBQyxDQUFDO0tBQ1YsQ0FBQyxDQUFDOztBQUVQLE1BQU0sZ0JBQWdCLEdBQUcsT0FBTyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7O0FBRS9DLEdBQUcsZ0JBQWdCLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRTtJQUM1QixDQUFDLENBQUMsSUFBSSxDQUFDLGdCQUFnQixDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztDQUN0QyxNQUFNOztJQUVILE9BQU8sQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQzs7SUFFOUIsT0FBTyxDQUFDLEdBQUcsQ0FBQ0MsQ0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDOzs7Ozs7O1NBT3BCLEVBQUVGLFNBQU8sQ0FBQztBQUNuQixDQUFDLENBQUMsQ0FBQyxDQUFDOztJQUVBLENBQUMsQ0FBQyxTQUFTLENBQUNFLENBQUssQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUM5QixJQUFJLEVBQUUsQ0FBQzsifQ==
