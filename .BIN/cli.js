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
var chokidar = _interopDefault(require('chokidar'));
var pm2$1 = _interopDefault(require('pm2'));
var fetch = _interopDefault(require('node-fetch'));

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
    css: cssPath = `./.BIN/${path.basename(output, `.js`)}.css`
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
            path: `./.BIN/${path.basename(output, `.js`)}.version`,
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

        config.DAEMON = { name };
        
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
            const output = `.BIN/${name}.js`;

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
        then(() => git.status()).
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

var f14 = ({
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

var f9 = ({
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
                config: {
                    NODE
                }
            } = toml_to_js(`./DAEMONS/${DAEMON}.toml`);

            if(!NODE) {
                return;
            }
            
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

var f4 = ({
    commands: `dev`,
    help: `run and watch everything`,
    handlers: async () => {
        await f14.handler({ DAEMONS: `all` });
        await f9.handler({ DAEMONS: `all` });
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

var f5 = ({
    command: `logs [DAEMONS...]`,
    help: `follow the active [DAEMON] logs`,
    handler: ({ DAEMONS = [] }) => pm2({
        commands: [ `logs`, ...DAEMONS ]
    }).done
    
});

const git$2 = Git();

var f6 = ({
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
var f7 = ({
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

var f8 = ({
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

var f12 = ({
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
    f14.handler({ DAEMONS });
    f9.handler({ DAEMONS });

    return pm2({
        commands: [ `logs` ]
    }).done;
};

var f10 = ({
    command: `summon [DAEMONS...]`,
    help: `summon and watch [DAEMONS...]`,
    alias: [ `dev`, `start`, `run` ],
    async handler({ DAEMONS }) {
        const DAEMONs = await prompt_daemons({
            cmd: this,
            DAEMONS
        });

        await f12.handler();
        
        return run_daemons({ DAEMONS: DAEMONs });
    },

    cancel() {
        f14.cancel();
    }
});

var f11 = ({
    command: `status [DAEMON]`,
    help: `status of active [DAEMON]s.`,
    alias: [ `ps`, `active`, `stats` ],
    handler: () => pm2({
        commands: [ `ps` ]
    }).done
});

var version$1 = "0.0.16";

var f13 = ({
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
res["dev"] = f4;
res["logs"] = f5;
res["pull"] = f6;
res["push"] = f7;
res["skills"] = f8;
res["spawn"] = f9;
res["start"] = f10;
res["status"] = f11;
res["stop"] = f12;
res["version"] = f13;
res["watch"] = f14;

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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2xpLmpzIiwic291cmNlcyI6WyIuLi9zcmMvcm9sbHVwL3BsdWdpbi1nbG9iLmpzIiwiLi4vc3JjL3JvbGx1cC92ZXJzaW9uLmpzIiwiLi4vc3JjL3JvbGx1cC9idWlsZGVycy5qcyIsIi4uL3NyYy9saWIvZ2V0X3NraWxscy5qcyIsIi4uL3NyYy9saWIvZ2V0X2NvbmZpZy5qcyIsIi4uL3NyYy90cmFuc2Zvcm1zL3RvbWxfdG9fanMuanMiLCIuLi9zcmMvbGliL2dldF9saXN0LmpzIiwiLi4vc3JjL2xpYi9maWx0ZXJfbGlzdC5qcyIsIi4uL3NyYy9saWIvcHJvbXB0X2RhZW1vbnMuanMiLCIuLi9zcmMvY29tbWFuZHMvYnVpbGQuanMiLCIuLi9zcmMvY29tbWFuZHMvY29tbWl0LmpzIiwiLi4vc3JjL2NvbW1hbmRzL2NyZWF0ZS5qcyIsIi4uL3NyYy9jb21tYW5kcy9kYWVtb25zLmpzIiwiLi4vc3JjL2xpYi9hY3Rpb24uanMiLCIuLi9zcmMvY29tbWFuZHMvd2F0Y2guanMiLCIuLi9zcmMvY29tbWFuZHMvc3Bhd24uanMiLCIuLi9zcmMvY29tbWFuZHMvZGV2LmpzIiwiLi4vc3JjL2xpYi9wbTIuanMiLCIuLi9zcmMvY29tbWFuZHMvbG9ncy5qcyIsIi4uL3NyYy9jb21tYW5kcy9wdWxsLmpzIiwiLi4vc3JjL2NvbW1hbmRzL3B1c2guanMiLCIuLi9zcmMvY29tbWFuZHMvc2tpbGxzLmpzIiwiLi4vc3JjL2NvbW1hbmRzL3N0b3AuanMiLCIuLi9zcmMvY29tbWFuZHMvc3RhcnQuanMiLCIuLi9zcmMvY29tbWFuZHMvc3RhdHVzLmpzIiwiLi4vc3JjL2NvbW1hbmRzL3ZlcnNpb24uanMiLCIuLi84YmFiNTZiMmZiZTg1NGZkNGM5ZTgxMTQxMWM0MzNmNiIsIi4uL3NyYy9saWIvZm9ybWF0LmpzIiwiLi4vc3JjL2NsaS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJcclxuaW1wb3J0IGZzIGZyb20gXCJmc1wiO1xyXG5pbXBvcnQgb3MgZnJvbSBcIm9zXCI7XHJcbmltcG9ydCBnbG9iIGZyb20gXCJnbG9iXCI7XHJcbmltcG9ydCBwYXRoIGZyb20gXCJwYXRoXCI7XHJcbmltcG9ydCBtZDUgZnJvbSBcIm1kNVwiO1xyXG5cclxuaW1wb3J0IHsgY3JlYXRlRmlsdGVyIH0gZnJvbSBcInJvbGx1cC1wbHVnaW51dGlsc1wiO1xyXG5cclxuY29uc3QgZ2V0RlNQcmVmaXggPSAocHJlZml4ID0gcHJvY2Vzcy5jd2QoKSkgPT4ge1xyXG4gICAgY29uc3QgcGFyZW50ID0gcGF0aC5qb2luKHByZWZpeCwgYC4uYCk7XHJcbiAgICBpZiAocGFyZW50ID09PSBwcmVmaXgpIHtcclxuICAgICAgICByZXR1cm4gcHJlZml4O1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICByZXR1cm4gZ2V0RlNQcmVmaXgocGFyZW50KTtcclxufTtcclxuXHJcbmNvbnN0IGZzUHJlZml4ID0gZ2V0RlNQcmVmaXgoKTtcclxuY29uc3Qgcm9vdFBhdGggPSBwYXRoLmpvaW4oYC9gKTtcclxuXHJcbmNvbnN0IHRvVVJMU3RyaW5nID0gKGZpbGVQYXRoKSA9PiB7XHJcbiAgICBjb25zdCBwYXRoRnJhZ21lbnRzID0gcGF0aC5qb2luKGZpbGVQYXRoKS5cclxuICAgICAgICByZXBsYWNlKGZzUHJlZml4LCByb290UGF0aCkuXHJcbiAgICAgICAgc3BsaXQocGF0aC5zZXApO1xyXG4gICAgaWYgKCFwYXRoLmlzQWJzb2x1dGUoZmlsZVBhdGgpKSB7XHJcbiAgICAgICAgcGF0aEZyYWdtZW50cy51bnNoaWZ0KGAuYCk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIHJldHVybiBwYXRoRnJhZ21lbnRzLmpvaW4oYC9gKTtcclxufTtcclxuXHJcbmNvbnN0IHJlc29sdmVOYW1lID0gKGZyb20pID0+IFxyXG4gICAgZnJvbS5zcGxpdChgL2ApLlxyXG4gICAgICAgIHBvcCgpLlxyXG4gICAgICAgIHNwbGl0KGAuYCkuXHJcbiAgICAgICAgc2hpZnQoKTtcclxuXHJcbmV4cG9ydCBkZWZhdWx0ICh7IFxyXG4gICAgaW5jbHVkZSwgXHJcbiAgICBleGNsdWRlIFxyXG59ID0gZmFsc2UpID0+IHtcclxuICAgIGNvbnN0IGZpbHRlciA9IGNyZWF0ZUZpbHRlcihpbmNsdWRlLCBleGNsdWRlKTtcclxuICAgIFxyXG4gICAgcmV0dXJuIHtcclxuICAgICAgICBuYW1lOiBgcm9sbHVwLWdsb2JgLFxyXG4gICAgICAgIGxvYWQ6IChpZCkgPT4ge1xyXG4gICAgICAgICAgICBjb25zdCBzcmNGaWxlID0gcGF0aC5qb2luKG9zLnRtcGRpcigpLCBpZCk7XHJcblxyXG4gICAgICAgICAgICBsZXQgb3B0aW9ucztcclxuICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICAgIG9wdGlvbnMgPSBKU09OLnBhcnNlKGZzLnJlYWRGaWxlU3luYyhzcmNGaWxlKSk7XHJcbiAgICAgICAgICAgIH0gY2F0Y2goZXJyKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGNvbnN0IHsgaW1wb3J0ZWUsIGltcG9ydGVyIH0gPSBvcHRpb25zO1xyXG5cclxuICAgICAgICAgICAgY29uc3QgaW1wb3J0ZWVJc0Fic29sdXRlID0gcGF0aC5pc0Fic29sdXRlKGltcG9ydGVlKTtcclxuICAgICAgICAgICAgY29uc3QgY3dkID0gcGF0aC5kaXJuYW1lKGltcG9ydGVyKTtcclxuICAgICAgICAgICAgY29uc3QgZ2xvYlBhdHRlcm4gPSBpbXBvcnRlZTtcclxuXHJcbiAgICAgICAgICAgIGNvbnN0IGZpbGVzID0gZ2xvYi5zeW5jKGdsb2JQYXR0ZXJuLCB7XHJcbiAgICAgICAgICAgICAgICBjd2RcclxuICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICBsZXQgY29kZSA9IFsgYGNvbnN0IHJlcyA9IHt9O2AgXTtcclxuICAgICAgICAgICAgbGV0IGltcG9ydEFycmF5ID0gW107XHJcblxyXG4gICAgICAgICAgICBmaWxlcy5mb3JFYWNoKChmaWxlLCBpKSA9PiB7XHJcbiAgICAgICAgICAgICAgICBsZXQgZnJvbTtcclxuICAgICAgICAgICAgICAgIGlmIChpbXBvcnRlZUlzQWJzb2x1dGUpIHtcclxuICAgICAgICAgICAgICAgICAgICBmcm9tID0gdG9VUkxTdHJpbmcoZmlsZSk7XHJcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgIGZyb20gPSB0b1VSTFN0cmluZyhwYXRoLnJlc29sdmUoY3dkLCBmaWxlKSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBjb2RlLnB1c2goYGltcG9ydCBmJHtpfSBmcm9tIFwiJHtmcm9tfVwiO2ApO1xyXG4gICAgICAgICAgICAgICAgY29kZS5wdXNoKGByZXNbXCIke3Jlc29sdmVOYW1lKGZyb20pfVwiXSA9IGYke2l9O2ApO1xyXG4gICAgICAgICAgICAgICAgaW1wb3J0QXJyYXkucHVzaChmcm9tKTtcclxuICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICBjb2RlLnB1c2goYGV4cG9ydCBkZWZhdWx0IHJlcztgKTtcclxuXHJcbiAgICAgICAgICAgIGNvZGUgPSBjb2RlLmpvaW4oYFxcbmApO1xyXG4gICAgICAgIFxyXG4gICAgICAgICAgICByZXR1cm4gY29kZTtcclxuXHJcbiAgICAgICAgfSxcclxuICAgICAgICByZXNvbHZlSWQ6IChpbXBvcnRlZSwgaW1wb3J0ZXIpID0+IHtcclxuICAgICAgICAgICAgaWYgKCFmaWx0ZXIoaW1wb3J0ZWUpIHx8ICFpbXBvcnRlZS5pbmNsdWRlcyhgKmApKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGNvbnN0IGhhc2ggPSBtZDUoaW1wb3J0ZWUgKyBpbXBvcnRlcik7XHJcblxyXG4gICAgICAgICAgICBmcy53cml0ZUZpbGVTeW5jKHBhdGguam9pbihvcy50bXBkaXIoKSwgaGFzaCksIEpTT04uc3RyaW5naWZ5KHtcclxuICAgICAgICAgICAgICAgIGltcG9ydGVlLFxyXG4gICAgICAgICAgICAgICAgaW1wb3J0ZXJcclxuICAgICAgICAgICAgfSkpO1xyXG5cclxuICAgICAgICAgICAgcmV0dXJuIGhhc2g7XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxufTsiLCJpbXBvcnQgZnMgZnJvbSBcImZzXCI7XHJcblxyXG5leHBvcnQgZGVmYXVsdCAoe1xyXG4gICAgcGF0aCxcclxuICAgIHZlcnNpb25cclxufSkgPT4gXHJcbiAgICAoe1xyXG4gICAgICAgIG5hbWU6IGByb2xsdXAtd3JpdGVgLFxyXG4gICAgICAgIGJ1aWxkU3RhcnQ6ICgpID0+IHtcclxuICAgICAgICAgICAgZnMud3JpdGVGaWxlU3luYyhwYXRoLCB2ZXJzaW9uKCkpO1xyXG4gICAgICAgIH1cclxuICAgIH0pOyIsImltcG9ydCBwYXRoIGZyb20gXCJwYXRoXCI7XHJcblxyXG5pbXBvcnQgdG9tbCBmcm9tIFwicm9sbHVwLXBsdWdpbi10b21sXCI7XHJcbmltcG9ydCBzdmVsdGUgZnJvbSBcInJvbGx1cC1wbHVnaW4tc3ZlbHRlXCI7XHJcbmltcG9ydCByZXNvbHZlIGZyb20gXCJyb2xsdXAtcGx1Z2luLW5vZGUtcmVzb2x2ZVwiO1xyXG5cclxuaW1wb3J0IHJlcGxhY2UgZnJvbSBcInJvbGx1cC1wbHVnaW4tcmVwbGFjZVwiO1xyXG5cclxuaW1wb3J0IGpzb24gZnJvbSBcInJvbGx1cC1wbHVnaW4tanNvblwiO1xyXG5pbXBvcnQgbWQgZnJvbSBcInJvbGx1cC1wbHVnaW4tY29tbW9ubWFya1wiO1xyXG5pbXBvcnQgY2pzIGZyb20gXCJyb2xsdXAtcGx1Z2luLWNvbW1vbmpzXCI7XHJcblxyXG5pbXBvcnQgeyB0ZXJzZXIgfSBmcm9tIFwicm9sbHVwLXBsdWdpbi10ZXJzZXJcIjtcclxuaW1wb3J0IHV1aWQgZnJvbSBcInV1aWQvdjFcIjtcclxuXHJcbi8qXHJcbiAqIGltcG9ydCBzcHJpdGVzbWl0aCBmcm9tIFwicm9sbHVwLXBsdWdpbi1zcHJpdGVcIjtcclxuICogaW1wb3J0IHRleHR1cmVQYWNrZXIgZnJvbSBcInNwcml0ZXNtaXRoLXRleHR1cmVwYWNrZXJcIjtcclxuICovXHJcblxyXG5pbXBvcnQgZ2xvYiBmcm9tIFwiLi9wbHVnaW4tZ2xvYi5qc1wiO1xyXG5pbXBvcnQgdmVyc2lvbiBmcm9tIFwiLi92ZXJzaW9uLmpzXCI7XHJcblxyXG5jb25zdCBDT0RFX1ZFUlNJT04gPSB1dWlkKCk7XHJcbmNvbnN0IHByb2R1Y3Rpb24gPSBmYWxzZTtcclxuXHJcbmxldCBDTElFTlRfVkVSU0lPTiA9IHV1aWQoKTtcclxuXHJcbmNvbnN0IGV4dGVybmFsID0gW1xyXG4gICAgYGV4cHJlc3NgLFxyXG4gICAgYGlzZWthaWAsXHJcbiAgICBgZnNgLFxyXG4gICAgYGh0dHBgLFxyXG4gICAgYGh0dHBzYFxyXG5dO1xyXG5cclxuY29uc3Qgbm9kZSA9ICh7XHJcbiAgICBpbnB1dCxcclxuICAgIG91dHB1dCxcclxufSkgPT4gKHtcclxuICAgIGlucHV0LFxyXG4gICAgb3V0cHV0OiB7XHJcbiAgICAgICAgZmlsZTogb3V0cHV0LFxyXG4gICAgICAgIGZvcm1hdDogYGNqc2AsXHJcbiAgICB9LFxyXG4gICAgZXh0ZXJuYWwsXHJcbiAgICBwbHVnaW5zOiBbXHJcbiAgICAgICAgZ2xvYigpLFxyXG4gICAgICAgIHJlcGxhY2Uoe1xyXG4gICAgICAgICAgICBDT0RFX1ZFUlNJT04sXHJcbiAgICAgICAgfSksXHJcbiAgICAgICAgbWQoKSxcclxuICAgICAgICBqc29uKCksXHJcbiAgICAgICAgdG9tbFxyXG4gICAgXSxcclxufSk7XHJcblxyXG4vLyBUT0RPOiBPZmZlciB1cCBzb21lIG9mIHRoZXNlIG9wdGlvbnMgdG8gdGhlIERhZW1vbiBmaWxlc1xyXG5jb25zdCBicm93c2VyID0gKHtcclxuICAgIGlucHV0LFxyXG4gICAgb3V0cHV0LFxyXG4gICAgY3NzOiBjc3NQYXRoID0gYC4vLkJJTi8ke3BhdGguYmFzZW5hbWUob3V0cHV0LCBgLmpzYCl9LmNzc2BcclxufSkgPT4gKHtcclxuICAgIGlucHV0LFxyXG4gICAgb3V0cHV0OiB7XHJcbiAgICAgICAgZmlsZTogb3V0cHV0LFxyXG4gICAgICAgIGZvcm1hdDogYGlpZmVgLFxyXG4gICAgICAgIGdsb2JhbHM6IHtcclxuICAgICAgICAgICAgXCJwaXhpLmpzXCI6IGBQSVhJYCxcclxuICAgICAgICB9LFxyXG4gICAgfSxcclxuICAgIGV4dGVybmFsOiBbIGB1dWlkYCwgYHV1aWQvdjFgLCBgcGl4aS5qc2AgXSxcclxuICAgIHBsdWdpbnM6IFtcclxuICAgICAgICAvLyAvLyBtYWtlIHRoaXMgYSByZWFjdGl2ZSBwbHVnaW4gdG8gXCIudGlsZW1hcC5qc29uXCJcclxuICAgICAgICAvLyAgICAgc3ByaXRlc21pdGgoe1xyXG4gICAgICAgIC8vICAgICAgICAgc3JjOiB7XHJcbiAgICAgICAgLy8gICAgICAgICAgICAgY3dkOiBcIi4vZ29ibGluLmxpZmUvQlJPV1NFUi5QSVhJL1xyXG4gICAgICAgIC8vICAgICAgICAgICAgIGdsb2I6IFwiKiovKi5wbmdcIlxyXG4gICAgICAgIC8vICAgICAgICAgfSxcclxuICAgICAgICAvLyAgICAgICAgIHRhcmdldDoge1xyXG4gICAgICAgIC8vICAgICAgICAgICAgIGltYWdlOiBcIi4vYmluL3B1YmxpYy9pbWFnZXMvc3ByaXRlLnBuZ1wiLFxyXG4gICAgICAgIC8vICAgICAgICAgICAgIGNzczogXCIuL2Jpbi9wdWJsaWMvYXJ0L2RlZmF1bHQuanNvblwiXHJcbiAgICAgICAgLy8gICAgICAgICB9LFxyXG4gICAgICAgIC8vICAgICAgICAgb3V0cHV0OiB7XHJcbiAgICAgICAgLy8gICAgICAgICAgICAgaW1hZ2U6IFwiLi9iaW4vcHVibGljL2ltYWdlcy9zcHJpdGUucG5nXCJcclxuICAgICAgICAvLyAgICAgICAgIH0sXHJcbiAgICAgICAgLy8gICAgICAgICBzcHJpdGVzbWl0aE9wdGlvbnM6IHtcclxuICAgICAgICAvLyAgICAgICAgICAgICBwYWRkaW5nOiAwXHJcbiAgICAgICAgLy8gICAgICAgICB9LFxyXG4gICAgICAgIC8vICAgICAgICAgY3VzdG9tVGVtcGxhdGU6IHRleHR1cmVQYWNrZXJcclxuICAgICAgICAvLyAgICAgfSksXHJcbiAgICAgICAgZ2xvYigpLFxyXG4gICAgICAgIHJlc29sdmUoKSxcclxuICAgICAgICBjanMoe1xyXG4gICAgICAgICAgICBcclxuICAgICAgICB9KSxcclxuICAgICAgICBqc29uKCksXHJcbiAgICAgICAgcmVwbGFjZSh7XHJcbiAgICAgICAgICAgIENPREVfVkVSU0lPTixcclxuICAgICAgICAgICAgQ0xJRU5UX1ZFUlNJT046ICgpID0+IENMSUVOVF9WRVJTSU9OXHJcbiAgICAgICAgfSksXHJcbiAgICAgICAgdG9tbCxcclxuICAgICAgICBtZCgpLFxyXG4gICAgICAgIHN2ZWx0ZSh7XHJcbiAgICAgICAgICAgIGNzczogKGNzcykgPT4ge1xyXG4gICAgICAgICAgICAgICAgY3NzLndyaXRlKGNzc1BhdGgpO1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgIH0pLFxyXG4gICAgICAgIHByb2R1Y3Rpb24gJiYgdGVyc2VyKCksXHJcbiAgICAgICAgdmVyc2lvbih7XHJcbiAgICAgICAgICAgIHBhdGg6IGAuLy5CSU4vJHtwYXRoLmJhc2VuYW1lKG91dHB1dCwgYC5qc2ApfS52ZXJzaW9uYCxcclxuICAgICAgICAgICAgdmVyc2lvbjogKCkgPT4gQ0xJRU5UX1ZFUlNJT05cclxuICAgICAgICB9KVxyXG4gICAgXVxyXG59KTtcclxuXHJcbmV4cG9ydCBkZWZhdWx0IHtcclxuICAgIG5vZGUsXHJcbiAgICBicm93c2VyXHJcbn07IiwiaW1wb3J0IHBhdGggZnJvbSBcInBhdGhcIjtcclxuaW1wb3J0IGdsb2IgZnJvbSBcImdsb2JcIjtcclxuXHJcbi8vIGRvbid0IHJlYWxseSBzdXBwb3J0IG92ZXJyaWRlc1xyXG5jb25zdCBnbG9iX29iaiA9IChvYmogPSB7fSwgZ2xvYl9wYXRoKSA9PiBnbG9iLnN5bmMoZ2xvYl9wYXRoKS5cclxuICAgIHJlZHVjZSgob2JqLCBlcXVpcF9wYXRoKSA9PiB7XHJcbiAgICAgICAgY29uc3QgcHJvamVjdF9uYW1lID0gcGF0aC5iYXNlbmFtZShwYXRoLnJlc29sdmUoZXF1aXBfcGF0aCwgYC4uYCwgYC4uYCkpO1xyXG4gICAgICAgIGNvbnN0IHNraWxsX25hbWUgPSBwYXRoLmJhc2VuYW1lKGVxdWlwX3BhdGgpO1xyXG5cclxuICAgICAgICBpZihvYmpbc2tpbGxfbmFtZV0pIHtcclxuICAgICAgICAvLyBwcmV2ZW50cyBoaWphY2tpbmdcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGAke3NraWxsX25hbWV9IGZyb20gJHtwcm9qZWN0X25hbWV9IG92ZXJsYXBzICR7b2JqW3NraWxsX25hbWVdfWApO1xyXG4gICAgICAgIH1cclxuICAgIFxyXG4gICAgICAgIHJldHVybiB7IFxyXG4gICAgICAgICAgICBbc2tpbGxfbmFtZV06IHBhdGgucmVsYXRpdmUocHJvY2Vzcy5jd2QoKSwgcGF0aC5yZXNvbHZlKGVxdWlwX3BhdGgsIGAuLmAsIGAuLmApKSxcclxuICAgICAgICAgICAgLi4ub2JqIFxyXG4gICAgICAgIH07XHJcbiAgICB9LCBvYmopO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgKCkgPT4gKHtcclxuICAgIFNLSUxMUzogW1xyXG4gICAgICAgIGAuL1NLSUxMUy8qL2AsIFxyXG4gICAgICAgIGAuL25vZGVfbW9kdWxlcy8qL1NLSUxMUy8qL2AsXHJcbiAgICAgICAgYC4vbm9kZV9tb2R1bGVzL0AqLyovU0tJTExTLyovYFxyXG4gICAgXS5yZWR1Y2UoZ2xvYl9vYmosIHt9KVxyXG59KTtcclxuIiwiaW1wb3J0IHRvbWwgZnJvbSBcInRvbWxcIjtcclxuaW1wb3J0IGZzIGZyb20gXCJmc1wiO1xyXG5cclxuY29uc3QgZ2V0X2NvbmZpZyA9IChjb25maWdGaWxlKSA9PiB7XHJcbiAgICAvLyB2ZXJpZnkgdG9tbCBleGlzdHNcclxuICAgIGxldCByYXc7XHJcblxyXG4gICAgdHJ5IHtcclxuICAgICAgICByYXcgPSBmcy5yZWFkRmlsZVN5bmMoY29uZmlnRmlsZSwgYHV0Zi04YCk7XHJcbiAgICB9IGNhdGNoIChleGNlcHRpb24pIHtcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYENvdWxkbid0IHJlYWQgJHtjb25maWdGaWxlfS4gQXJlIHlvdSBzdXJlIHRoaXMgcGF0aCBpcyBjb3JyZWN0P2ApO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IGNvbmZpZyA9IHRvbWwucGFyc2UocmF3KTtcclxuXHJcbiAgICAvLyBoYXMgaW1wbGVtZW50ZWRcclxuICAgIGlmKGNvbmZpZy5oYXMpIHtcclxuICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICAuLi5jb25maWcuaGFzLnJlZHVjZSgob2JqLCBvdGhlcl9maWxlKSA9PiAoe1xyXG4gICAgICAgICAgICAgICAgLi4uZ2V0X2NvbmZpZyhgLi9EQUVNT05TLyR7b3RoZXJfZmlsZX0udG9tbGApLFxyXG4gICAgICAgICAgICAgICAgLi4ub2JqXHJcbiAgICAgICAgICAgIH0pLCB7fSksIFxyXG4gICAgICAgICAgICAuLi5jb25maWdcclxuICAgICAgICB9O1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICByZXR1cm4gY29uZmlnO1xyXG59O1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgZ2V0X2NvbmZpZztcclxuIiwiaW1wb3J0IGZzIGZyb20gXCJmc1wiO1xyXG5pbXBvcnQgcGF0aCBmcm9tIFwicGF0aFwiO1xyXG5cclxuaW1wb3J0IGMgZnJvbSBcImNoYWxrXCI7XHJcbmltcG9ydCBidWlsZGVycyBmcm9tIFwiLi4vcm9sbHVwL2J1aWxkZXJzLmpzXCI7XHJcbmltcG9ydCBnZXRfc2tpbGxzIGZyb20gXCIuLi9saWIvZ2V0X3NraWxscy5qc1wiO1xyXG5pbXBvcnQgZ2V0X2NvbmZpZyBmcm9tIFwiLi4vbGliL2dldF9jb25maWcuanNcIjtcclxuXHJcbi8vIE1peCBDb25maWcgRmlsZSBpbiBhbmQgcnVuIHRoZXNlIGluIG9yZGVyXHJcbmV4cG9ydCBkZWZhdWx0IChjb25maWdGaWxlKSA9PiBPYmplY3QudmFsdWVzKHtcclxuICAgIGdldF9za2lsbHMsXHJcblxyXG4gICAgZ2V0X2NvbmZpZzogKHsgY29uZmlnRmlsZSB9KSA9PiAoe1xyXG4gICAgICAgIGNvbmZpZzogZ2V0X2NvbmZpZyhjb25maWdGaWxlKVxyXG4gICAgfSksXHJcbiAgICBcclxuICAgIHNldF9uYW1lczogKHtcclxuICAgICAgICBjb25maWdGaWxlLFxyXG4gICAgfSkgPT4ge1xyXG4gICAgICAgIGNvbnN0IG5hbWUgPSBwYXRoLmJhc2VuYW1lKGNvbmZpZ0ZpbGUsIGAudG9tbGApO1xyXG5cclxuICAgICAgICBjb25zdCBwYWNrYWdlX3BhdGggPSBwYXRoLmRpcm5hbWUocGF0aC5yZXNvbHZlKGNvbmZpZ0ZpbGUpKTtcclxuICAgICAgICBjb25zdCBwYWNrYWdlX25hbWUgPSBwYWNrYWdlX3BhdGguXHJcbiAgICAgICAgICAgIHNwbGl0KHBhdGguc2VwKS5cclxuICAgICAgICAgICAgcG9wKCk7XHJcblxyXG4gICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgIHBhY2thZ2VfcGF0aCxcclxuICAgICAgICAgICAgcGFja2FnZV9uYW1lLFxyXG4gICAgICAgICAgICBuYW1lLFxyXG4gICAgICAgIH07XHJcbiAgICB9LFxyXG5cclxuICAgIHdyaXRlX2VudHJ5OiAoe1xyXG4gICAgICAgIGNvbmZpZyxcclxuICAgICAgICBuYW1lLFxyXG4gICAgICAgIFNLSUxMU1xyXG4gICAgfSkgPT4ge1xyXG4gICAgICAgIC8vIFdSSVRFIE9VVCBGSUxFXHJcbiAgICAgICAgbGV0IGVudHJ5ID0gYGA7XHJcbiAgICAgICAgY29uc3QgdHlwZSA9IGNvbmZpZy5OT0RFIFxyXG4gICAgICAgICAgICA/IGBub2RlYCBcclxuICAgICAgICAgICAgOiBgYnJvd3NlcmA7XHJcblxyXG4gICAgICAgIGNvbnN0IHdyaXRlID0gKGRhdGEpID0+IHtcclxuICAgICAgICAgICAgZW50cnkgKz0gYCR7ZGF0YX1cXHJcXG5gO1xyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIGNvbmZpZy5EQUVNT04gPSB7IG5hbWUgfTtcclxuICAgICAgICBcclxuICAgICAgICB3cml0ZShgaW1wb3J0IGlzZWthaSBmcm9tIFwiaXNla2FpXCI7YCk7XHJcbiAgICAgICAgd3JpdGUoYGlzZWthaS5TRVQoJHtKU09OLnN0cmluZ2lmeShjb25maWcpfSk7YCk7XHJcbiAgICAgICAgd3JpdGUoYGApO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICBjb25zdCBmYWlscyA9IFtdO1xyXG4gICAgICAgIGNvbnN0IGVxdWlwZWQgPSBPYmplY3Qua2V5cyhjb25maWcpLlxyXG4gICAgICAgICAgICBmaWx0ZXIoKGtleSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgY29uc3QgaXNfdXBwZXIgPSBrZXkgPT09IGtleS50b1VwcGVyQ2FzZSgpO1xyXG4gICAgICAgICAgICAgICAgaWYoIWlzX3VwcGVyKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgIGNvbnN0IGhhc19za2lsbCA9IFNLSUxMU1trZXldICE9PSB1bmRlZmluZWQ7XHJcblxyXG4gICAgICAgICAgICAgICAgY29uc3QgaXNfdGFyZ2V0ID0gWyBgQlJPV1NFUmAsIGBOT0RFYCBdLmluZGV4T2Yoa2V5KSAhPT0gLTE7XHJcblxyXG4gICAgICAgICAgICAgICAgaWYoIWhhc19za2lsbCAmJiAhaXNfdGFyZ2V0KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgZmFpbHMucHVzaChrZXkpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgIHJldHVybiBpc191cHBlciAmJiBoYXNfc2tpbGw7XHJcbiAgICAgICAgICAgIH0pLlxyXG4gICAgICAgICAgICBtYXAoKGtleSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgY29uc3Qgd2hlcmUgPSBTS0lMTFNba2V5XSA9PT0gYGBcclxuICAgICAgICAgICAgICAgICAgICA/IGAuLmBcclxuICAgICAgICAgICAgICAgICAgICA6IGAuLi8ke1NLSUxMU1trZXldLnNwbGl0KHBhdGguc2VwKS5cclxuICAgICAgICAgICAgICAgICAgICAgICAgam9pbihgL2ApfWA7XHJcblxyXG4gICAgICAgICAgICAgICAgd3JpdGUoYGltcG9ydCAke2tleX0gZnJvbSBcIiR7d2hlcmV9L1NLSUxMUy8ke2tleX0vJHt0eXBlfS5qc1wiO2ApO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIHJldHVybiBrZXk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICBjb25zdCBmYWlsZWQgPSBmYWlscy5sZW5ndGggPiAwXHJcbiAgICAgICAgICAgID8gYEZBSUxFRCBUTyBGSU5EXFxyXFxuJHtmYWlscy5tYXAoKGYpID0+IGBbJHtmfV1gKS5cclxuICAgICAgICAgICAgICAgIGpvaW4oYCB4IGApfWBcclxuICAgICAgICAgICAgOiBgYDtcclxuXHJcbiAgICAgICAgY29uc3Qga2V5cyA9IGVxdWlwZWQucmVkdWNlKChvdXRwdXQsIGtleSkgPT4gYCR7b3V0cHV0fSAgICAke2tleX0sXFxyXFxuYCwgYGApO1xyXG5cclxuICAgICAgICB3cml0ZShgXHJcbmlzZWthaS5FUVVJUCh7XFxyXFxuJHtrZXlzfX0pO2ApO1xyXG5cclxuICAgICAgICBjb25zdCBCSU4gPSBgLkJJTmA7XHJcbiAgICAgICAgY29uc3QgaW5wdXQgPSBwYXRoLmpvaW4oQklOLCBgJHtuYW1lfS5lbnRyeS5qc2ApO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICBpZiAoIWZzLmV4aXN0c1N5bmMoQklOKSkge1xyXG4gICAgICAgICAgICBjb25zb2xlLmxvZyhgQ1JFQVRJTkcgJHtCSU59YCk7XHJcbiAgICAgICAgICAgIGZzLm1rZGlyU3luYyhCSU4pO1xyXG4gICAgICAgIH1cclxuICAgICAgICAvLyB3cml0ZSBvdXQgdGhlaXIgaW5kZXguanNcclxuICAgICAgICBmcy53cml0ZUZpbGVTeW5jKGlucHV0LCBlbnRyeSwgYHV0Zi04YCk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgIGNvbnNvbGUubG9nKGBcclxuWyR7bmFtZX1dWyR7dHlwZX1dXHJcblxyXG5TS0lMTFNcclxuJHtjLmJsdWVCcmlnaHQoZXF1aXBlZC5tYXAoKGUpID0+IGBbJHtlfV1gKS5cclxuICAgICAgICBqb2luKGAgKyBgKSl9XHJcblxyXG4ke2MucmVkKGZhaWxlZCl9XHJcbmApO1xyXG5cclxuICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICBpbnB1dFxyXG4gICAgICAgIH07XHJcbiAgICB9LFxyXG5cclxuICAgIHJ1bl9idWlsZGVyczogKHtcclxuICAgICAgICBpbnB1dCxcclxuICAgICAgICBuYW1lLFxyXG4gICAgICAgIGNvbmZpZyxcclxuICAgIH0pID0+IHtcclxuICAgICAgICBpZihjb25maWcuTk9ERSAmJiBjb25maWcuQlJPV1NFUikge1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFlvdSBjYW5ub3QgdGFyZ2V0IGJvdGggW05PREVdIGFuZCBbQlJPV1NFUl1gKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmKGNvbmZpZy5OT0RFKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IG91dHB1dCA9IGAuQklOLyR7bmFtZX0uanNgOyAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgICAgIG91dHB1dCxcclxuICAgICAgICAgICAgICAgIGJ1aWxkX2luZm86IGJ1aWxkZXJzLm5vZGUoe1xyXG4gICAgICAgICAgICAgICAgICAgIGlucHV0LFxyXG4gICAgICAgICAgICAgICAgICAgIG91dHB1dFxyXG4gICAgICAgICAgICAgICAgfSlcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgaWYoY29uZmlnLkJST1dTRVIpIHtcclxuICAgICAgICAgICAgY29uc3Qgb3V0cHV0ID0gYC5CSU4vJHtuYW1lfS5qc2A7XHJcblxyXG4gICAgICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICAgICAgb3V0cHV0LFxyXG4gICAgICAgICAgICAgICAgYnVpbGRfaW5mbzogYnVpbGRlcnMuYnJvd3Nlcih7XHJcbiAgICAgICAgICAgICAgICAgICAgaW5wdXQsXHJcbiAgICAgICAgICAgICAgICAgICAgb3V0cHV0XHJcbiAgICAgICAgICAgICAgICB9KVxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBZb3UgbXVzdCBzcGVjaWZ5IGVpdGhlciBbTk9ERV0gb3IgW0JST1dTRVJdIGZvciB5b3VyIHRhcmdldCBpbiB5b3VyIFtEQUVNT05dIHRvbWxgKTtcclxuICAgIH1cclxufSkuXHJcbiAgICByZWR1Y2UoKHN0YXRlLCBmbikgPT4gKHtcclxuICAgICAgICAuLi5zdGF0ZSxcclxuICAgICAgICAuLi5mbihzdGF0ZSlcclxuICAgIH0pLCB7IGNvbmZpZ0ZpbGUgfSk7XHJcbiIsImltcG9ydCBnbG9iIGZyb20gXCJnbG9iXCI7XHJcbmltcG9ydCBwYXRoIGZyb20gXCJwYXRoXCI7XHJcbmltcG9ydCBnZXRfY29uZmlnIGZyb20gXCIuL2dldF9jb25maWcuanNcIjtcclxuXHJcbmV4cG9ydCBkZWZhdWx0IChleGNsdWRlID0gZmFsc2UpID0+IHtcclxuICAgIGlmKCFleGNsdWRlKSB7XHJcbiAgICAgICAgcmV0dXJuIGdsb2Iuc3luYyhgLi9EQUVNT05TLyoudG9tbGApLlxyXG4gICAgICAgICAgICBtYXAoKGNsYXNzX3BhdGgpID0+IHBhdGguYmFzZW5hbWUoY2xhc3NfcGF0aCwgYC50b21sYCkpO1xyXG4gICAgfVxyXG5cclxuXHJcbiAgICByZXR1cm4gZ2xvYi5zeW5jKGAuL0RBRU1PTlMvKi50b21sYCkuXHJcbiAgICAgICAgZmlsdGVyKChkYWVtb24pID0+IGdldF9jb25maWcoZGFlbW9uKS5OT0RFKS5cclxuICAgICAgICBtYXAoKGNsYXNzX3BhdGgpID0+IHBhdGguYmFzZW5hbWUoY2xhc3NfcGF0aCwgYC50b21sYCkpO1xyXG59OyIsImltcG9ydCBnZXRfbGlzdCBmcm9tIFwiLi9nZXRfbGlzdC5qc1wiO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgKGNsYXNzZXMpID0+IGNsYXNzZXMuZmlsdGVyKCh0YXJnZXQpID0+IHtcclxuICAgIGNvbnN0IGlzX29rYXkgPSBnZXRfbGlzdCgpLlxyXG4gICAgICAgIGluZGV4T2YodGFyZ2V0KSAhPT0gLTE7XHJcblxyXG4gICAgaWYoIWlzX29rYXkpIHtcclxuICAgICAgICBjb25zb2xlLmxvZyhgJHt0YXJnZXR9IGlzIG5vdCBhbiBhdmFpbGFibGUgW0RBRU1PTl1gKTtcclxuICAgIH1cclxuICAgICAgICBcclxuICAgIHJldHVybiBpc19va2F5O1xyXG59KTtcclxuIiwiaW1wb3J0IGdldF9saXN0IGZyb20gXCIuL2dldF9saXN0LmpzXCI7XHJcbmltcG9ydCBmaWx0ZXJfbGlzdCBmcm9tIFwiLi9maWx0ZXJfbGlzdC5qc1wiO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgKHtcclxuICAgIGNtZCxcclxuICAgIERBRU1PTlNcclxufSkgPT4ge1xyXG4gICAgaWYoIURBRU1PTlMpIHtcclxuICAgICAgICByZXR1cm4gY21kLnByb21wdCh7XHJcbiAgICAgICAgICAgIHR5cGU6IGBsaXN0YCxcclxuICAgICAgICAgICAgbmFtZTogYERBRU1PTmAsXHJcbiAgICAgICAgICAgIG1lc3NhZ2U6IGBXaGljaCBbREFFTU9OXT9gLFxyXG4gICAgICAgICAgICBjaG9pY2VzOiBbIGBhbGxgLCAuLi5nZXRfbGlzdCgpIF1cclxuICAgICAgICB9KS5cclxuICAgICAgICAgICAgdGhlbigoeyBEQUVNT04gfSkgPT4gREFFTU9OID09PSBgYWxsYCBcclxuICAgICAgICAgICAgICAgID8gZ2V0X2xpc3QoKSBcclxuICAgICAgICAgICAgICAgIDogZmlsdGVyX2xpc3QoWyBEQUVNT04gXSkpO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICBpZihEQUVNT05TWzBdID09PSBgYWxsYCkge1xyXG4gICAgICAgIHJldHVybiBnZXRfbGlzdCgpO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiBmaWx0ZXJfbGlzdChEQUVNT05TKTtcclxufTsiLCJpbXBvcnQgdG9tbF90b19qcyBmcm9tIFwiLi4vdHJhbnNmb3Jtcy90b21sX3RvX2pzLmpzXCI7XHJcbmltcG9ydCByb2xsdXAgZnJvbSBcInJvbGx1cFwiO1xyXG5cclxuaW1wb3J0IHByb21wdF9kYWVtb25zIGZyb20gXCIuLi9saWIvcHJvbXB0X2RhZW1vbnMuanNcIjtcclxuXHJcbmV4cG9ydCBkZWZhdWx0ICh7XHJcbiAgICBjb21tYW5kOiBgYnVpbGQgW0RBRU1PTlMuLi5dYCxcclxuICAgIGhlbHA6IGBidWlsZCBhbGwgW0RBRU1PTl0gc2F2ZShzKS5gLFxyXG4gICAgaGlkZGVuOiB0cnVlLFxyXG4gICAgYXN5bmMgaGFuZGxlcih7IERBRU1PTlMgfSkge1xyXG4gICAgICAgIGNvbnN0IERBRU1PTnMgPSBhd2FpdCBwcm9tcHRfZGFlbW9ucyh7IFxyXG4gICAgICAgICAgICBjbWQ6IHRoaXMsXHJcbiAgICAgICAgICAgIERBRU1PTlMgXHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIGNvbnN0IGJ1aWx0ID0gYXdhaXQgUHJvbWlzZS5hbGwoREFFTU9Ocy5tYXAoYXN5bmMgKHRhcmdldCkgPT4ge1xyXG4gICAgICAgICAgICBjb25zdCB7IGJ1aWxkX2luZm8sIG5hbWUgfSA9IGF3YWl0IHRvbWxfdG9fanMoYC4vREFFTU9OUy8ke3RhcmdldH0udG9tbGApO1xyXG4gICAgICAgICAgICBjb25zdCBidW5kbGUgPSBhd2FpdCByb2xsdXAucm9sbHVwKGJ1aWxkX2luZm8pO1xyXG5cclxuICAgICAgICAgICAgYXdhaXQgYnVuZGxlLndyaXRlKGJ1aWxkX2luZm8ub3V0cHV0KTtcclxuICAgICAgICAgICAgY29uc29sZS5sb2coYFske25hbWV9XSBCdWlsZCBDb21wbGV0ZS5cXHJcXG5gKTtcclxuICAgICAgICB9KSk7XHJcblxyXG4gICAgICAgIGNvbnNvbGUubG9nKGBCdWlsdCAke2J1aWx0Lmxlbmd0aH0gW0RBRU1PTl0ocykuYCk7XHJcbiAgICB9XHJcbn0pOyIsImltcG9ydCBHaXQgZnJvbSBcInNpbXBsZS1naXQvcHJvbWlzZVwiO1xyXG5cclxuY29uc3QgZ2l0ID0gR2l0KCk7XHJcblxyXG5leHBvcnQgZGVmYXVsdCAoe1xyXG4gICAgY29tbWFuZDogYGNvbW1pdCBbbWVzc2FnZS4uLl1gLFxyXG4gICAgaGVscDogYGNvbW1pdCBjdXJyZW50IGZpbGVzIHRvIHNvdXJjZSBjb250cm9sYCxcclxuICAgIGhhbmRsZXI6ICh7XHJcbiAgICAgICAgbWVzc2FnZSA9IFsgYFVwZGF0ZSwgbm8gY29tbWl0IG1lc3NhZ2VgIF1cclxuICAgIH0pID0+IGdpdC5hZGQoWyBgLmAgXSkuXHJcbiAgICAgICAgdGhlbigoKSA9PiBnaXQuc3RhdHVzKCkpLlxyXG4gICAgICAgIHRoZW4oKCkgPT4gZ2l0LmNvbW1pdChtZXNzYWdlLmpvaW4oYCBgKSkpLlxyXG4gICAgICAgIHRoZW4oKCkgPT4gZ2l0LnB1c2goYG9yaWdpbmAsIGBtYXN0ZXJgKSkuXHJcbiAgICAgICAgdGhlbigoKSA9PiBjb25zb2xlLmxvZyhgQ29tbWl0ZWQgd2l0aCBtZXNzYWdlICR7bWVzc2FnZS5qb2luKGAgYCl9YCkpXHJcbn0pO1xyXG4iLCJpbXBvcnQgZGVnaXQgZnJvbSBcImRlZ2l0XCI7XHJcbmltcG9ydCB7IGV4ZWMgfSBmcm9tIFwiY2hpbGRfcHJvY2Vzc1wiO1xyXG5pbXBvcnQgR2l0IGZyb20gXCJzaW1wbGUtZ2l0L3Byb21pc2VcIjtcclxuXHJcbmNvbnN0IGdpdCA9IEdpdCgpO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgKHtcclxuICAgIGNvbW1hbmQ6IGBjcmVhdGUgW3RlbXBsYXRlXSBbbmFtZV1gLFxyXG4gICAgaGVscDogYENyZWF0ZSBhIG5ldyBpc2VrYWkgcHJvamVjdCBmcm9tIFt0ZW1wbGF0ZV0gb3IgQGlzZWthaS90ZW1wbGF0ZWAsXHJcbiAgICBhbGlhczogWyBgaW5pdGAgXSxcclxuICAgIG9wdGlvbnM6IHtcclxuICAgICAgICBcIi1mLCAtLWZvcmNlXCI6IGBmb3JjZSBvdmVyd3JpdGUgZnJvbSB0ZW1wbGF0ZWBcclxuICAgIH0sXHJcbiAgICBoYW5kbGVyOiAoe1xyXG4gICAgICAgIHRlbXBsYXRlID0gYGlzZWthaS1kZXYvdGVtcGxhdGVgLFxyXG4gICAgICAgIG5hbWUgPSBgLmAsXHJcbiAgICAgICAgb3B0aW9uczoge1xyXG4gICAgICAgICAgICBmb3JjZSA9IGZhbHNlXHJcbiAgICAgICAgfSA9IGZhbHNlXHJcbiAgICB9KSA9PiBkZWdpdCh0ZW1wbGF0ZSwgeyBmb3JjZSB9KS5cclxuICAgICAgICBjbG9uZShuYW1lKS5cclxuICAgICAgICB0aGVuKCgpID0+IGdpdC5pbml0KCkpLlxyXG4gICAgICAgIHRoZW4oKCkgPT4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xyXG4gICAgICAgICAgICBjb25zb2xlLmxvZyhgJHt0ZW1wbGF0ZX0gY29waWVkIHRvICR7bmFtZX1gKTtcclxuICAgICAgICAgICAgY29uc29sZS5sb2coYElOU1RBTExJTkc6IFRISVMgTUFZIFRBS0UgQVdISUxFYCk7XHJcbiAgICAgICAgICAgIGV4ZWMoYG5wbSBpbnN0YWxsYCwgKGVycikgPT4ge1xyXG4gICAgICAgICAgICAgICAgaWYoZXJyKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmVqZWN0KGVycik7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICByZXNvbHZlKCk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0pKS5cclxuICAgICAgICB0aGVuKCgpID0+IHtcclxuICAgICAgICAgICAgY29uc29sZS5sb2coYENPTVBMRVRFOiBbcnVuXSB0byBzdGFydCB5b3VyIERBRU1PTnMuYCk7XHJcbiAgICAgICAgfSlcclxufSk7IiwiaW1wb3J0IGdldF9saXN0IGZyb20gXCIuLi9saWIvZ2V0X2xpc3QuanNcIjtcclxuXHJcbmV4cG9ydCBkZWZhdWx0ICh7XHJcbiAgICBoZWxwOiBgU2hvdyBhdmFpbGFibGUgW0RBRU1PTl0gc2F2ZXMuYCxcclxuICAgIGFsaWFzOiBbIGBsc2AsIGBzYXZlc2AgXSxcclxuICAgIGhhbmRsZXI6IChhcmdzLCBjYikgPT4ge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKGdldF9saXN0KCkuXHJcbiAgICAgICAgICAgIG1hcCgoaSkgPT4gYFske2l9XWApLlxyXG4gICAgICAgICAgICBqb2luKGAgLSBgKSwgYFxcclxcbmApOyAgICBcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgY2IoKTtcclxuICAgIH1cclxufSk7IiwiZXhwb3J0IGRlZmF1bHQgKFxyXG4gICAgYWN0aW9uX21hcCwgXHJcbiAgICByZWR1Y2VyID0gKGkpID0+IGlcclxuKSA9PiAoaW5wdXQpID0+IHtcclxuICAgIGNvbnN0IGtleSA9IHJlZHVjZXIoaW5wdXQpO1xyXG5cclxuICAgIGlmKCFhY3Rpb25fbWFwW2tleV0pIHtcclxuICAgICAgICByZXR1cm47XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIGFjdGlvbl9tYXBba2V5XShpbnB1dCk7XHJcbn07IiwiaW1wb3J0IGNob2tpZGFyIGZyb20gXCJjaG9raWRhclwiO1xyXG5pbXBvcnQgcm9sbHVwIGZyb20gXCJyb2xsdXBcIjtcclxuaW1wb3J0IGMgZnJvbSBcImNoYWxrXCI7XHJcblxyXG5pbXBvcnQgdG9tbF90b19qcyBmcm9tIFwiLi4vdHJhbnNmb3Jtcy90b21sX3RvX2pzLmpzXCI7XHJcblxyXG5pbXBvcnQgYWN0aW9uIGZyb20gXCIuLi9saWIvYWN0aW9uLmpzXCI7XHJcbmltcG9ydCBwcm9tcHRfZGFlbW9ucyBmcm9tIFwiLi4vbGliL3Byb21wdF9kYWVtb25zLmpzXCI7XHJcblxyXG5leHBvcnQgZGVmYXVsdCAoe1xyXG4gICAgY29tbWFuZDogYGxvYWQgW0RBRU1PTlMuLi5dYCxcclxuICAgIGhlbHA6IGBsb2FkIFtEQUVNT05dIHNhdmVzYCxcclxuICAgIGFsaWFzOiBbIGByZWdlbmVyYXRlYCwgYHJlY3JlYXRlYCwgYHdhdGNoYCBdLFxyXG4gICAgaGlkZGVuOiB0cnVlLFxyXG4gICAgY2FuY2VsICgpIHtcclxuICAgICAgICB0aGlzLndhdGNoZXJzLmZvckVhY2goKHdhdGNoZXIpID0+IHdhdGNoZXIuY2xvc2UoKSk7XHJcbiAgICAgICAgY29uc29sZS5sb2coYFlPVVIgV0FUQ0ggSEFTIEVOREVEYCk7XHJcbiAgICB9LFxyXG4gICAgYXN5bmMgaGFuZGxlcih7IERBRU1PTlMgfSkge1xyXG4gICAgICAgIHRoaXMud2F0Y2hlcnMgPSBbXTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgY29uc3QgREFFTU9OcyA9IGF3YWl0IHByb21wdF9kYWVtb25zKHtcclxuICAgICAgICAgICAgY21kOiB0aGlzLFxyXG4gICAgICAgICAgICBEQUVNT05TXHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgREFFTU9Ocy5mb3JFYWNoKCh0YXJnZXQpID0+IHtcclxuICAgICAgICAgICAgY29uc3QgZmlsZV9wYXRoID0gYC4vREFFTU9OUy8ke3RhcmdldH0udG9tbGA7XHJcblxyXG4gICAgICAgICAgICBjb25zdCBkYXRhID0gdG9tbF90b19qcyhmaWxlX3BhdGgpO1xyXG5cclxuICAgICAgICAgICAgY29uc3QgeyBidWlsZF9pbmZvIH0gPSBkYXRhO1xyXG4gICAgICAgIFxyXG4gICAgICAgICAgICAvLyByZWJ1aWxkIG9uIGZpbGUgY2hhZ25lXHJcbiAgICAgICAgICAgIGNvbnN0IHdhdGNoZXIgPSBjaG9raWRhci53YXRjaChmaWxlX3BhdGgpO1xyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHdhdGNoZXIub24oYGNoYW5nZWAsICgpID0+IHtcclxuICAgICAgICAgICAgICAgIHRvbWxfdG9fanMoZmlsZV9wYXRoKTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgdGhpcy53YXRjaGVycy5wdXNoKHdhdGNoZXIpO1xyXG5cclxuICAgICAgICAgICAgY29uc3Qgcm9sbHVwX3dhdGNoZXIgPSByb2xsdXAud2F0Y2goe1xyXG4gICAgICAgICAgICAgICAgLi4uYnVpbGRfaW5mbyxcclxuICAgICAgICAgICAgICAgIHdhdGNoOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgY2xlYXJTY3JlZW46IHRydWVcclxuICAgICAgICAgICAgICAgIH0gICBcclxuICAgICAgICAgICAgfSkuXHJcbiAgICAgICAgICAgICAgICBvbihgZXZlbnRgLCBhY3Rpb24oe1xyXG4gICAgICAgICAgICAgICAgICAgIEJVTkRMRV9FTkQ6ICgpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coYFske3RhcmdldH1dW1dBVENIXSBCdWlsdC5gKTtcclxuICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgIEVSUk9SOiAoZSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhlKTtcclxuICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgIEZBVEFMOiAoeyBlcnJvciB9KSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoYy5yZWQuYm9sZChlcnJvcikpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH0sICh7IGNvZGUgfSkgPT4gY29kZSBcclxuICAgICAgICAgICAgICAgICkpO1xyXG5cclxuICAgICAgICAgICAgdGhpcy53YXRjaGVycy5wdXNoKHJvbGx1cF93YXRjaGVyKTtcclxuICAgICAgICB9KTtcclxuICAgIH1cclxufSk7XHJcbiIsImltcG9ydCBwbTIgZnJvbSBcInBtMlwiO1xyXG5cclxuaW1wb3J0IHRvbWxfdG9fanMgZnJvbSBcIi4uL3RyYW5zZm9ybXMvdG9tbF90b19qcy5qc1wiO1xyXG5cclxuaW1wb3J0IHByb21wdF9kYWVtb25zIGZyb20gXCIuLi9saWIvcHJvbXB0X2RhZW1vbnMuanNcIjtcclxuXHJcbmV4cG9ydCBkZWZhdWx0ICh7XHJcbiAgICBjb21tYW5kZXI6IGBzcGF3biBbREFFTU9OUy4uLl1gLFxyXG4gICAgaGVscDogYHNwYXduIFtEQUVNT05TXSBmaWxlc2AsXHJcbiAgICBoaWRkZW46IHRydWUsXHJcbiAgICBhc3luYyBoYW5kbGVyKHsgREFFTU9OUyB9KSB7XHJcbiAgICAgICAgY29uc3QgZGFlbW9ucyA9IGF3YWl0IHByb21wdF9kYWVtb25zKHtcclxuICAgICAgICAgICAgY21kOiB0aGlzLFxyXG4gICAgICAgICAgICBEQUVNT05TXHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIGRhZW1vbnMuZm9yRWFjaCgoREFFTU9OKSA9PiB7XHJcbiAgICAgICAgICAgIGNvbnN0IHtcclxuICAgICAgICAgICAgICAgIG91dHB1dCxcclxuICAgICAgICAgICAgICAgIGNvbmZpZzoge1xyXG4gICAgICAgICAgICAgICAgICAgIE5PREVcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSA9IHRvbWxfdG9fanMoYC4vREFFTU9OUy8ke0RBRU1PTn0udG9tbGApO1xyXG5cclxuICAgICAgICAgICAgaWYoIU5PREUpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgLy8gSEFDSzogY291bGQgbmFtZSB0aGUgZmlsZSBvZiB0aGUgVE9NTCBzb21ldGhpbmcgZ25hcmx5XHJcbiAgICAgICAgICAgIHBtMi5zdGFydCh7XHJcbiAgICAgICAgICAgICAgICBuYW1lOiBEQUVNT04sXHJcbiAgICAgICAgICAgICAgICBzY3JpcHQ6IG91dHB1dCxcclxuICAgICAgICAgICAgICAgIHdhdGNoOiBgLi8ke291dHB1dH1gLFxyXG4gICAgICAgICAgICAgICAgZm9yY2U6IHRydWUsXHJcbiAgICAgICAgICAgICAgICB3YXRjaF9vcHRpb25zOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgLy8geXVwIFBNMiB3YXMgc2V0dGluZyBhIGRlZmF1bHQgaWdub3JlXHJcbiAgICAgICAgICAgICAgICAgICAgaWdub3JlZDogYGAsXHJcbiAgICAgICAgICAgICAgICAgICAgdXNlUG9sbGluZzogdHJ1ZVxyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIG1heF9yZXN0YXJ0OiAwXHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICBjb25zb2xlLmxvZyhgU3Bhd25lZCAke2RhZW1vbnMuam9pbihgIC0gYCl9YCk7XHJcbiAgICB9XHJcbn0pO1xyXG4iLCJpbXBvcnQgd2F0Y2ggZnJvbSBcIi4vd2F0Y2guanNcIjtcclxuaW1wb3J0IHNwYXduIGZyb20gXCIuL3NwYXduLmpzXCI7XHJcblxyXG5leHBvcnQgZGVmYXVsdCAoe1xyXG4gICAgY29tbWFuZHM6IGBkZXZgLFxyXG4gICAgaGVscDogYHJ1biBhbmQgd2F0Y2ggZXZlcnl0aGluZ2AsXHJcbiAgICBoYW5kbGVyczogYXN5bmMgKCkgPT4ge1xyXG4gICAgICAgIGF3YWl0IHdhdGNoLmhhbmRsZXIoeyBEQUVNT05TOiBgYWxsYCB9KTtcclxuICAgICAgICBhd2FpdCBzcGF3bi5oYW5kbGVyKHsgREFFTU9OUzogYGFsbGAgfSk7XHJcbiAgICB9XHJcbn0pO1xyXG4iLCIvLyBwaXBlIG91dCB0byBwbTJcclxuaW1wb3J0IHsgc3Bhd24gfSBmcm9tIFwiY2hpbGRfcHJvY2Vzc1wiO1xyXG5pbXBvcnQgcGF0aCBmcm9tIFwicGF0aFwiO1xyXG5cclxuY29uc3QgcG0yX3BhdGggPSBwYXRoLmRpcm5hbWUocmVxdWlyZS5yZXNvbHZlKGBwbTJgKSk7XHJcblxyXG5leHBvcnQgZGVmYXVsdCAoeyBjb21tYW5kcyB9KSA9PiB7XHJcbiAgICBsZXQgbm9kZSA9IHNwYXduKGBub2RlYCwgYCR7cG0yX3BhdGh9L2Jpbi9wbTIgJHtjb21tYW5kcy5qb2luKGAgYCl9YC5zcGxpdChgIGApLCB7XHJcbiAgICAgICAgY3dkOiBwcm9jZXNzLmN3ZCgpLFxyXG4gICAgICAgIGVudjogcHJvY2Vzcy5lbnYsXHJcbiAgICAgICAgc3RkaW86IGBpbmhlcml0YFxyXG4gICAgfSk7XHJcblxyXG4gICAgcmV0dXJuIHtcclxuICAgICAgICBkb25lOiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xyXG4gICAgICAgICAgICBub2RlLm9uKGBjbG9zZWAsICgpID0+IHtcclxuICAgICAgICAgICAgICAgIHJlc29sdmUoKTtcclxuICAgICAgICAgICAgICAgIG5vZGUgPSBmYWxzZTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfSksXHJcblxyXG4gICAgICAgIGNhbmNlbDogKCkgPT4ge1xyXG4gICAgICAgICAgICBpZighbm9kZSkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICB9XHJcbiAgICBcclxuICAgICAgICAgICAgbm9kZS5raWxsKCk7XHJcbiAgICAgICAgfSAgIFxyXG4gICAgfTtcclxufTtcclxuIiwiaW1wb3J0IHBtMiBmcm9tIFwiLi4vbGliL3BtMi5qc1wiO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgKHtcclxuICAgIGNvbW1hbmQ6IGBsb2dzIFtEQUVNT05TLi4uXWAsXHJcbiAgICBoZWxwOiBgZm9sbG93IHRoZSBhY3RpdmUgW0RBRU1PTl0gbG9nc2AsXHJcbiAgICBoYW5kbGVyOiAoeyBEQUVNT05TID0gW10gfSkgPT4gcG0yKHtcclxuICAgICAgICBjb21tYW5kczogWyBgbG9nc2AsIC4uLkRBRU1PTlMgXVxyXG4gICAgfSkuZG9uZVxyXG4gICAgXHJcbn0pOyIsImltcG9ydCBHaXQgZnJvbSBcInNpbXBsZS1naXQvcHJvbWlzZVwiO1xyXG5pbXBvcnQgeyBleGVjIH0gZnJvbSBcImNoaWxkX3Byb2Nlc3NcIjtcclxuXHJcbmNvbnN0IGdpdCA9IEdpdCgpO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgKHtcclxuICAgIGNvbW1hbmQ6IGBwdWxsYCxcclxuICAgIGhlbHA6IGBnZXQgY3VycmVudCBmaWxlcyBmcm9tIHNvdXJjZSBjb250cm9sYCxcclxuICAgIGhhbmRsZXI6ICgpID0+IGdpdC5wdWxsKGBvcmlnaW5gLCBgbWFzdGVyYCkuXHJcbiAgICAgICAgdGhlbigoKSA9PiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XHJcbiAgICAgICAgICAgIGV4ZWMoYG5wbSBpbnN0YWxsYCwgKGVycikgPT4ge1xyXG4gICAgICAgICAgICAgICAgaWYoZXJyKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmVqZWN0KGVycik7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICByZXNvbHZlKCk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0pKS5cclxuICAgICAgICB0aGVuKCgpID0+IGNvbnNvbGUubG9nKGBQdWxsZWQgbGF0ZXN0IGZyb20gc291cmNlIGNvbnRyb2wuYCkpXHJcbn0pO1xyXG4iLCJpbXBvcnQgZmV0Y2ggZnJvbSBcIm5vZGUtZmV0Y2hcIjtcclxuaW1wb3J0IGdsb2IgZnJvbSBcImdsb2JcIjtcclxuaW1wb3J0IGdldF9jb25maWcgZnJvbSBcIi4uL2xpYi9nZXRfY29uZmlnLmpzXCI7XHJcbmltcG9ydCBwYXRoIGZyb20gXCJwYXRoXCI7XHJcblxyXG4vLyBUT0RPOiBUaGlzIHNob3VsZCByZWFsbHkgYmUgZXhwb3NlZCBieSBpc2VrYWkgY29yZSBzb21lIGhvdy4gTGlrZSBhIHdheSB0byBhZGQgaW4gdG9vbHNcclxuZXhwb3J0IGRlZmF1bHQgKHtcclxuICAgIGNvbW1hbmQ6IGBwdXNoYCxcclxuICAgIGFsaWFzOiBbIGBwdWJsaXNoYCBdLFxyXG4gICAgYXN5bmMgaGFuZGxlcigpIHtcclxuICAgICAgICBhd2FpdCBQcm9taXNlLmFsbChnbG9iLnN5bmMoYC4vREFFTU9OUy8qLnRvbWxgKS5cclxuICAgICAgICAgICAgbWFwKChEQUVNT04pID0+IHtcclxuICAgICAgICAgICAgICAgIGNvbnN0IHsgQURNSU4gfSA9IGdldF9jb25maWcoREFFTU9OKTtcclxuICAgICAgICAgICAgICAgIGlmKEFETUlOICYmIEFETUlOLnphbGdvKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgeyBcclxuICAgICAgICAgICAgICAgICAgICAgICAgdXJsID0gYGh0dHA6Ly9sb2NhbGhvc3Q6ODA4MGAsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHphbGdvIFxyXG4gICAgICAgICAgICAgICAgICAgIH0gPSBBRE1JTjtcclxuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgUFVTSElORyBbJHtwYXRoLmJhc2VuYW1lKERBRU1PTiwgYC50b21sYCl9XSAtICR7dXJsfWApO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmV0Y2goYCR7dXJsfS96YWxnb2AsIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgbWV0aG9kOiBgUE9TVGAsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhY2hlOiBgbm8tY2FjaGVgLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBoZWFkZXJzOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBcIkNvbnRlbnQtVHlwZVwiOiBgYXBwbGljYXRpb24vanNvbmBcclxuICAgICAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoe1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgemFsZ29cclxuICAgICAgICAgICAgICAgICAgICAgICAgfSlcclxuICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XHJcbiAgICAgICAgICAgIH0pKTtcclxuXHJcbiAgICB9XHJcbn0pOyIsImltcG9ydCBnZXRfc2tpbGxzIGZyb20gXCIuLi9saWIvZ2V0X3NraWxscy5qc1wiO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgKHtcclxuICAgIGNvbW1hbmQ6IGBza2lsbHNgLFxyXG4gICAgaGVscDogYExpc3QgYXZhaWxhYmxlIHNraWxsc2AsXHJcblxyXG4gICAgaGFuZGxlcjogKCkgPT4ge1xyXG4gICAgICAgIGNvbnN0IHtcclxuICAgICAgICAgICAgU0hPUCxcclxuICAgICAgICAgICAgU0tJTExTXHJcbiAgICAgICAgfSA9IGdldF9za2lsbHMoKTtcclxuXHJcbiAgICAgICAgY29uc29sZS5sb2coYFxyXG5TSE9QXHJcbiR7T2JqZWN0LmtleXMoU0hPUCkuXHJcbiAgICAgICAgbWFwKChzKSA9PiBgWyR7c31dYCkuXHJcbiAgICAgICAgam9pbihgID0gYCl9XHJcblxyXG5TS0lMTFNcclxuJHtPYmplY3Qua2V5cyhTS0lMTFMpLlxyXG4gICAgICAgIG1hcCgocykgPT4gYFske3N9XWApLlxyXG4gICAgICAgIGpvaW4oYCBvIGApfVxyXG5gKTtcclxuICAgIH1cclxufSk7IiwiaW1wb3J0IHBtMiBmcm9tIFwiLi4vbGliL3BtMi5qc1wiO1xyXG5pbXBvcnQgZ2V0X2xpc3QgZnJvbSBcIi4uL2xpYi9nZXRfbGlzdC5qc1wiO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgKHtcclxuICAgIGNvbW1hbmQ6IGBzbGF5IFtEQUVNT05TLi4uXWAsXHJcbiAgICBoZWxwOiBgc2xheSBhY3RpdmUgW0RBRU1PTlNdYCwgXHJcbiAgICBhbGlhczogWyBgdW5zdW1tb25gLCBga2lsbGAsIGBzbGF5YCwgYHN0b3BgIF0sXHJcbiAgICBjYW5jZWwoKSB7XHJcbiAgICAgICAgdGhpcy5jYW5jZWxlcigpO1xyXG4gICAgfSxcclxuICAgIFxyXG4gICAgaGFuZGxlcih7IERBRU1PTlMgPSBnZXRfbGlzdCgpIH0gPSBmYWxzZSkge1xyXG4gICAgICAgIGNvbnN0IHdob20gPSBEQUVNT05TLm1hcCgoY2hhcikgPT4gYFske2NoYXJ9XWApLlxyXG4gICAgICAgICAgICBqb2luKGAgLSBgKTtcclxuXHJcbiAgICAgICAgY29uc29sZS5sb2coYFNMQVlJTkcgJHt3aG9tfWApO1xyXG5cclxuICAgICAgICBjb25zdCB7IGNhbmNlbCwgZG9uZSB9ID0gcG0yKHtcclxuICAgICAgICAgICAgY29tbWFuZHM6IFsgYGRlbGV0ZWAsIGBhbGxgIF1cclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgdGhpcy5jYW5jZWxlciA9IGNhbmNlbDtcclxuXHJcbiAgICAgICAgcmV0dXJuIGRvbmU7XHJcbiAgICB9XHJcbn0pO1xyXG5cclxuIiwiaW1wb3J0IHdhdGNoIGZyb20gXCIuL3dhdGNoLmpzXCI7XHJcbmltcG9ydCBzcGF3biBmcm9tIFwiLi9zcGF3bi5qc1wiO1xyXG5pbXBvcnQgcG0yIGZyb20gXCIuLi9saWIvcG0yLmpzXCI7XHJcblxyXG5pbXBvcnQgc3RvcCBmcm9tIFwiLi9zdG9wLmpzXCI7XHJcbmltcG9ydCBwcm9tcHRfZGFlbW9ucyBmcm9tIFwiLi4vbGliL3Byb21wdF9kYWVtb25zLmpzXCI7XHJcblxyXG5jb25zdCBydW5fZGFlbW9ucyA9ICh7IERBRU1PTlMgfSkgPT4ge1xyXG4gICAgd2F0Y2guaGFuZGxlcih7IERBRU1PTlMgfSk7XHJcbiAgICBzcGF3bi5oYW5kbGVyKHsgREFFTU9OUyB9KTtcclxuXHJcbiAgICByZXR1cm4gcG0yKHtcclxuICAgICAgICBjb21tYW5kczogWyBgbG9nc2AgXVxyXG4gICAgfSkuZG9uZTtcclxufTtcclxuXHJcbmV4cG9ydCBkZWZhdWx0ICh7XHJcbiAgICBjb21tYW5kOiBgc3VtbW9uIFtEQUVNT05TLi4uXWAsXHJcbiAgICBoZWxwOiBgc3VtbW9uIGFuZCB3YXRjaCBbREFFTU9OUy4uLl1gLFxyXG4gICAgYWxpYXM6IFsgYGRldmAsIGBzdGFydGAsIGBydW5gIF0sXHJcbiAgICBhc3luYyBoYW5kbGVyKHsgREFFTU9OUyB9KSB7XHJcbiAgICAgICAgY29uc3QgREFFTU9OcyA9IGF3YWl0IHByb21wdF9kYWVtb25zKHtcclxuICAgICAgICAgICAgY21kOiB0aGlzLFxyXG4gICAgICAgICAgICBEQUVNT05TXHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIGF3YWl0IHN0b3AuaGFuZGxlcigpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHJldHVybiBydW5fZGFlbW9ucyh7IERBRU1PTlM6IERBRU1PTnMgfSk7XHJcbiAgICB9LFxyXG5cclxuICAgIGNhbmNlbCgpIHtcclxuICAgICAgICB3YXRjaC5jYW5jZWwoKTtcclxuICAgIH1cclxufSk7XHJcblxyXG4iLCJpbXBvcnQgcG0yIGZyb20gXCIuLi9saWIvcG0yLmpzXCI7XHJcblxyXG5leHBvcnQgZGVmYXVsdCh7XHJcbiAgICBjb21tYW5kOiBgc3RhdHVzIFtEQUVNT05dYCxcclxuICAgIGhlbHA6IGBzdGF0dXMgb2YgYWN0aXZlIFtEQUVNT05dcy5gLFxyXG4gICAgYWxpYXM6IFsgYHBzYCwgYGFjdGl2ZWAsIGBzdGF0c2AgXSxcclxuICAgIGhhbmRsZXI6ICgpID0+IHBtMih7XHJcbiAgICAgICAgY29tbWFuZHM6IFsgYHBzYCBdXHJcbiAgICB9KS5kb25lXHJcbn0pOyIsImltcG9ydCB7IHZlcnNpb24gfSBmcm9tIFwiLi4vLi4vcGFja2FnZS5qc29uXCI7XHJcblxyXG5leHBvcnQgZGVmYXVsdCAoe1xyXG4gICAgY29tbWFuZDogYHZlcnNpb25gLFxyXG4gICAgaGVscDogYFZlcnNpb24gaXMgJHt2ZXJzaW9ufWAsXHJcbiAgICBoYW5kbGVyOiAoKSA9PiB7XHJcbiAgICAgICAgY29uc29sZS5sb2codmVyc2lvbik7XHJcbiAgICB9XHJcbn0pOyIsImNvbnN0IHJlcyA9IHt9O1xuaW1wb3J0IGYwIGZyb20gXCIvVXNlcnMvR2FtZXMvUHJvamVjdHMvaXNla2FpL3NyYy9jb21tYW5kcy9idWlsZC5qc1wiO1xucmVzW1wiYnVpbGRcIl0gPSBmMDtcbmltcG9ydCBmMSBmcm9tIFwiL1VzZXJzL0dhbWVzL1Byb2plY3RzL2lzZWthaS9zcmMvY29tbWFuZHMvY29tbWl0LmpzXCI7XG5yZXNbXCJjb21taXRcIl0gPSBmMTtcbmltcG9ydCBmMiBmcm9tIFwiL1VzZXJzL0dhbWVzL1Byb2plY3RzL2lzZWthaS9zcmMvY29tbWFuZHMvY3JlYXRlLmpzXCI7XG5yZXNbXCJjcmVhdGVcIl0gPSBmMjtcbmltcG9ydCBmMyBmcm9tIFwiL1VzZXJzL0dhbWVzL1Byb2plY3RzL2lzZWthaS9zcmMvY29tbWFuZHMvZGFlbW9ucy5qc1wiO1xucmVzW1wiZGFlbW9uc1wiXSA9IGYzO1xuaW1wb3J0IGY0IGZyb20gXCIvVXNlcnMvR2FtZXMvUHJvamVjdHMvaXNla2FpL3NyYy9jb21tYW5kcy9kZXYuanNcIjtcbnJlc1tcImRldlwiXSA9IGY0O1xuaW1wb3J0IGY1IGZyb20gXCIvVXNlcnMvR2FtZXMvUHJvamVjdHMvaXNla2FpL3NyYy9jb21tYW5kcy9sb2dzLmpzXCI7XG5yZXNbXCJsb2dzXCJdID0gZjU7XG5pbXBvcnQgZjYgZnJvbSBcIi9Vc2Vycy9HYW1lcy9Qcm9qZWN0cy9pc2VrYWkvc3JjL2NvbW1hbmRzL3B1bGwuanNcIjtcbnJlc1tcInB1bGxcIl0gPSBmNjtcbmltcG9ydCBmNyBmcm9tIFwiL1VzZXJzL0dhbWVzL1Byb2plY3RzL2lzZWthaS9zcmMvY29tbWFuZHMvcHVzaC5qc1wiO1xucmVzW1wicHVzaFwiXSA9IGY3O1xuaW1wb3J0IGY4IGZyb20gXCIvVXNlcnMvR2FtZXMvUHJvamVjdHMvaXNla2FpL3NyYy9jb21tYW5kcy9za2lsbHMuanNcIjtcbnJlc1tcInNraWxsc1wiXSA9IGY4O1xuaW1wb3J0IGY5IGZyb20gXCIvVXNlcnMvR2FtZXMvUHJvamVjdHMvaXNla2FpL3NyYy9jb21tYW5kcy9zcGF3bi5qc1wiO1xucmVzW1wic3Bhd25cIl0gPSBmOTtcbmltcG9ydCBmMTAgZnJvbSBcIi9Vc2Vycy9HYW1lcy9Qcm9qZWN0cy9pc2VrYWkvc3JjL2NvbW1hbmRzL3N0YXJ0LmpzXCI7XG5yZXNbXCJzdGFydFwiXSA9IGYxMDtcbmltcG9ydCBmMTEgZnJvbSBcIi9Vc2Vycy9HYW1lcy9Qcm9qZWN0cy9pc2VrYWkvc3JjL2NvbW1hbmRzL3N0YXR1cy5qc1wiO1xucmVzW1wic3RhdHVzXCJdID0gZjExO1xuaW1wb3J0IGYxMiBmcm9tIFwiL1VzZXJzL0dhbWVzL1Byb2plY3RzL2lzZWthaS9zcmMvY29tbWFuZHMvc3RvcC5qc1wiO1xucmVzW1wic3RvcFwiXSA9IGYxMjtcbmltcG9ydCBmMTMgZnJvbSBcIi9Vc2Vycy9HYW1lcy9Qcm9qZWN0cy9pc2VrYWkvc3JjL2NvbW1hbmRzL3ZlcnNpb24uanNcIjtcbnJlc1tcInZlcnNpb25cIl0gPSBmMTM7XG5pbXBvcnQgZjE0IGZyb20gXCIvVXNlcnMvR2FtZXMvUHJvamVjdHMvaXNla2FpL3NyYy9jb21tYW5kcy93YXRjaC5qc1wiO1xucmVzW1wid2F0Y2hcIl0gPSBmMTQ7XG5leHBvcnQgZGVmYXVsdCByZXM7IiwiaW1wb3J0IGMgZnJvbSBcImNoYWxrXCI7XHJcblxyXG5jb25zdCB7IGxvZyB9ID0gY29uc29sZTtcclxuXHJcbmNvbnNvbGUubG9nID0gKC4uLmFyZ3MpID0+IGxvZyhcclxuICAgIC4uLmFyZ3MubWFwKFxyXG4gICAgICAgIChpdGVtKSA9PiB0eXBlb2YgaXRlbSA9PT0gYHN0cmluZ2BcclxuICAgICAgICAgICAgPyBjLmdyZWVuKFxyXG4gICAgICAgICAgICAgICAgaXRlbS5yZXBsYWNlKC8oXFxbLlteXFxdXFxbXSpcXF0pL3VnLCBjLmJvbGQud2hpdGUoYCQxYCkpXHJcbiAgICAgICAgICAgIClcclxuICAgICAgICAgICAgOiBpdGVtXHJcbiAgICApXHJcbik7XHJcbiIsIiMhL3Vzci9iaW4vZW52IG5vZGVcclxuXHJcbmltcG9ydCB2b3JwYWwgZnJvbSBcInZvcnBhbFwiO1xyXG5pbXBvcnQgY29tbWFuZHMgZnJvbSBcIi4vY29tbWFuZHMvKi5qc1wiO1xyXG5pbXBvcnQgeyB2ZXJzaW9uIH0gZnJvbSBcIi4uL3BhY2thZ2UuanNvblwiO1xyXG5cclxuaW1wb3J0IFwiLi9saWIvZm9ybWF0LmpzXCI7XHJcblxyXG5pbXBvcnQgY2hhbGsgZnJvbSBcImNoYWxrXCI7XHJcblxyXG5jb25zdCB2ID0gdm9ycGFsKCk7XHJcblxyXG5PYmplY3QuZW50cmllcyhjb21tYW5kcykuXHJcbiAgICBmb3JFYWNoKChbXHJcbiAgICAgICAgbmFtZSwge1xyXG4gICAgICAgICAgICBoZWxwLFxyXG4gICAgICAgICAgICBoYW5kbGVyLFxyXG4gICAgICAgICAgICBhdXRvY29tcGxldGUsXHJcbiAgICAgICAgICAgIGhpZGRlbixcclxuICAgICAgICAgICAgY29tbWFuZCxcclxuICAgICAgICAgICAgYWxpYXMgPSBbXSxcclxuICAgICAgICAgICAgb3B0aW9ucyA9IHt9LFxyXG4gICAgICAgICAgICBjYW5jZWwgPSAoKSA9PiB7fVxyXG4gICAgICAgIH1cclxuICAgIF0pID0+IHsgXHJcbiAgICAgICAgY29uc3QgaXN0ID0gdi5jb21tYW5kKGNvbW1hbmQgfHwgbmFtZSwgaGVscCkuXHJcbiAgICAgICAgICAgIGFsaWFzKGFsaWFzKS5cclxuICAgICAgICAgICAgYXV0b2NvbXBsZXRlKGF1dG9jb21wbGV0ZSB8fCBbXSkuXHJcbiAgICAgICAgICAgIGNhbmNlbChjYW5jZWwpLlxyXG4gICAgICAgICAgICBhY3Rpb24oaGFuZGxlcik7XHJcblxyXG4gICAgICAgIGlmKGhpZGRlbikge1xyXG4gICAgICAgICAgICBpc3QuaGlkZGVuKCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBPYmplY3QuZW50cmllcyhvcHRpb25zKS5cclxuICAgICAgICAgICAgZm9yRWFjaCgoWyBvcHRpb24sIG9wdGlvbl9oZWxwIF0pID0+IHtcclxuICAgICAgICAgICAgICAgIGlzdC5vcHRpb24ob3B0aW9uLCBvcHRpb25faGVscCk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgfSk7XHJcblxyXG5jb25zdCBzdGFydHVwX2NvbW1hbmRzID0gcHJvY2Vzcy5hcmd2LnNsaWNlKDIpO1xyXG5cclxuaWYoc3RhcnR1cF9jb21tYW5kcy5sZW5ndGggPiAwKSB7XHJcbiAgICB2LmV4ZWMoc3RhcnR1cF9jb21tYW5kcy5qb2luKGAgYCkpO1xyXG59IGVsc2Uge1xyXG5cclxuICAgIHByb2Nlc3Muc3Rkb3V0LndyaXRlKGBcXHgxQmNgKTtcclxuXHJcbiAgICBjb25zb2xlLmxvZyhjaGFsay5ncmVlbihgXHJcbuKWiOKWiOKVl+KWiOKWiOKWiOKWiOKWiOKWiOKWiOKVl+KWiOKWiOKWiOKWiOKWiOKWiOKWiOKVl+KWiOKWiOKVlyAg4paI4paI4pWXIOKWiOKWiOKWiOKWiOKWiOKVlyDilojilojilZcgICAgICDilojilojilojilojilojilojilojilZfilojilojilojilZcgICDilojilojilZcg4paI4paI4paI4paI4paI4paI4pWXIOKWiOKWiOKVl+KWiOKWiOKWiOKVlyAgIOKWiOKWiOKVl+KWiOKWiOKWiOKWiOKWiOKWiOKWiOKVlyAgICBcclxu4paI4paI4pWR4paI4paI4pWU4pWQ4pWQ4pWQ4pWQ4pWd4paI4paI4pWU4pWQ4pWQ4pWQ4pWQ4pWd4paI4paI4pWRIOKWiOKWiOKVlOKVneKWiOKWiOKVlOKVkOKVkOKWiOKWiOKVl+KWiOKWiOKVkeKWhCDilojilojilZfiloTilojilojilZTilZDilZDilZDilZDilZ3ilojilojilojilojilZcgIOKWiOKWiOKVkeKWiOKWiOKVlOKVkOKVkOKVkOKVkOKVnSDilojilojilZHilojilojilojilojilZcgIOKWiOKWiOKVkeKWiOKWiOKVlOKVkOKVkOKVkOKVkOKVnSAgICBcclxu4paI4paI4pWR4paI4paI4paI4paI4paI4paI4paI4pWX4paI4paI4paI4paI4paI4pWXICDilojilojilojilojilojilZTilZ0g4paI4paI4paI4paI4paI4paI4paI4pWR4paI4paI4pWRIOKWiOKWiOKWiOKWiOKVl+KWiOKWiOKWiOKWiOKWiOKVlyAg4paI4paI4pWU4paI4paI4pWXIOKWiOKWiOKVkeKWiOKWiOKVkSAg4paI4paI4paI4pWX4paI4paI4pWR4paI4paI4pWU4paI4paI4pWXIOKWiOKWiOKVkeKWiOKWiOKWiOKWiOKWiOKVlyAgICAgIFxyXG7ilojilojilZHilZrilZDilZDilZDilZDilojilojilZHilojilojilZTilZDilZDilZ0gIOKWiOKWiOKVlOKVkOKWiOKWiOKVlyDilojilojilZTilZDilZDilojilojilZHilojilojilZHiloDilZrilojilojilZTiloDilojilojilZTilZDilZDilZ0gIOKWiOKWiOKVkeKVmuKWiOKWiOKVl+KWiOKWiOKVkeKWiOKWiOKVkSAgIOKWiOKWiOKVkeKWiOKWiOKVkeKWiOKWiOKVkeKVmuKWiOKWiOKVl+KWiOKWiOKVkeKWiOKWiOKVlOKVkOKVkOKVnSAgICAgIFxyXG7ilojilojilZHilojilojilojilojilojilojilojilZHilojilojilojilojilojilojilojilZfilojilojilZEgIOKWiOKWiOKVl+KWiOKWiOKVkSAg4paI4paI4pWR4paI4paI4pWRICDilZrilZDilZ0g4paI4paI4paI4paI4paI4paI4paI4pWX4paI4paI4pWRIOKVmuKWiOKWiOKWiOKWiOKVkeKVmuKWiOKWiOKWiOKWiOKWiOKWiOKVlOKVneKWiOKWiOKVkeKWiOKWiOKVkSDilZrilojilojilojilojilZHilojilojilojilojilojilojilojilZcgICAgXHJcbuKVmuKVkOKVneKVmuKVkOKVkOKVkOKVkOKVkOKVkOKVneKVmuKVkOKVkOKVkOKVkOKVkOKVkOKVneKVmuKVkOKVnSAg4pWa4pWQ4pWd4pWa4pWQ4pWdICDilZrilZDilZ3ilZrilZDilZ0gICAgICDilZrilZDilZDilZDilZDilZDilZDilZ3ilZrilZDilZ0gIOKVmuKVkOKVkOKVkOKVnSDilZrilZDilZDilZDilZDilZDilZ0g4pWa4pWQ4pWd4pWa4pWQ4pWdICDilZrilZDilZDilZDilZ3ilZrilZDilZDilZDilZDilZDilZDilZ0gICAgXHJcblZFUlNJT046ICR7dmVyc2lvbn0gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxyXG5gKSk7XHJcblxyXG4gICAgdi5kZWxpbWl0ZXIoY2hhbGsuYm9sZC5ncmVlbihgPmApKS5cclxuICAgICAgICBzaG93KCk7XHJcbn0iXSwibmFtZXMiOlsiY3JlYXRlRmlsdGVyIiwiZ2xvYiIsInRlcnNlciIsInRvbWwiLCJnaXQiLCJleGVjIiwicG0yIiwid2F0Y2giLCJzcGF3biIsInN0b3AiLCJ2ZXJzaW9uIiwiY29tbWFuZHMiLCJjaGFsayJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQVNBLE1BQU0sV0FBVyxHQUFHLENBQUMsTUFBTSxHQUFHLE9BQU8sQ0FBQyxHQUFHLEVBQUUsS0FBSztJQUM1QyxNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFDdkMsSUFBSSxNQUFNLEtBQUssTUFBTSxFQUFFO1FBQ25CLE9BQU8sTUFBTSxDQUFDO0tBQ2pCOztJQUVELE9BQU8sV0FBVyxDQUFDLE1BQU0sQ0FBQyxDQUFDO0NBQzlCLENBQUM7O0FBRUYsTUFBTSxRQUFRLEdBQUcsV0FBVyxFQUFFLENBQUM7QUFDL0IsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7O0FBRWhDLE1BQU0sV0FBVyxHQUFHLENBQUMsUUFBUSxLQUFLO0lBQzlCLE1BQU0sYUFBYSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDO1FBQ3JDLE9BQU8sQ0FBQyxRQUFRLEVBQUUsUUFBUSxDQUFD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
