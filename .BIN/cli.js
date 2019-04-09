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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2xpLmpzIiwic291cmNlcyI6WyIuLi9zcmMvcm9sbHVwL3BsdWdpbi1nbG9iLmpzIiwiLi4vc3JjL3JvbGx1cC92ZXJzaW9uLmpzIiwiLi4vc3JjL3JvbGx1cC9idWlsZGVycy5qcyIsIi4uL3NyYy9saWIvZ2V0X3NraWxscy5qcyIsIi4uL3NyYy9saWIvZ2V0X2NvbmZpZy5qcyIsIi4uL3NyYy90cmFuc2Zvcm1zL3RvbWxfdG9fanMuanMiLCIuLi9zcmMvbGliL2dldF9saXN0LmpzIiwiLi4vc3JjL2xpYi9maWx0ZXJfbGlzdC5qcyIsIi4uL3NyYy9saWIvcHJvbXB0X2RhZW1vbnMuanMiLCIuLi9zcmMvY29tbWFuZHMvYnVpbGQuanMiLCIuLi9zcmMvY29tbWFuZHMvY29tbWl0LmpzIiwiLi4vc3JjL2NvbW1hbmRzL2NyZWF0ZS5qcyIsIi4uL3NyYy9jb21tYW5kcy9kYWVtb25zLmpzIiwiLi4vc3JjL2xpYi9hY3Rpb24uanMiLCIuLi9zcmMvY29tbWFuZHMvd2F0Y2guanMiLCIuLi9zcmMvY29tbWFuZHMvc3Bhd24uanMiLCIuLi9zcmMvY29tbWFuZHMvZGV2LmpzIiwiLi4vc3JjL2xpYi9wbTIuanMiLCIuLi9zcmMvY29tbWFuZHMvbG9ncy5qcyIsIi4uL3NyYy9jb21tYW5kcy9wdWxsLmpzIiwiLi4vc3JjL2NvbW1hbmRzL3B1c2guanMiLCIuLi9zcmMvY29tbWFuZHMvc2tpbGxzLmpzIiwiLi4vc3JjL2NvbW1hbmRzL3N0b3AuanMiLCIuLi9zcmMvY29tbWFuZHMvc3RhcnQuanMiLCIuLi9zcmMvY29tbWFuZHMvc3RhdHVzLmpzIiwiLi4vc3JjL2NvbW1hbmRzL3ZlcnNpb24uanMiLCIuLi84YmFiNTZiMmZiZTg1NGZkNGM5ZTgxMTQxMWM0MzNmNiIsIi4uL3NyYy9saWIvZm9ybWF0LmpzIiwiLi4vc3JjL2NsaS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJcclxuaW1wb3J0IGZzIGZyb20gXCJmc1wiO1xyXG5pbXBvcnQgb3MgZnJvbSBcIm9zXCI7XHJcbmltcG9ydCBnbG9iIGZyb20gXCJnbG9iXCI7XHJcbmltcG9ydCBwYXRoIGZyb20gXCJwYXRoXCI7XHJcbmltcG9ydCBtZDUgZnJvbSBcIm1kNVwiO1xyXG5cclxuaW1wb3J0IHsgY3JlYXRlRmlsdGVyIH0gZnJvbSBcInJvbGx1cC1wbHVnaW51dGlsc1wiO1xyXG5cclxuY29uc3QgZ2V0RlNQcmVmaXggPSAocHJlZml4ID0gcHJvY2Vzcy5jd2QoKSkgPT4ge1xyXG4gICAgY29uc3QgcGFyZW50ID0gcGF0aC5qb2luKHByZWZpeCwgYC4uYCk7XHJcbiAgICBpZiAocGFyZW50ID09PSBwcmVmaXgpIHtcclxuICAgICAgICByZXR1cm4gcHJlZml4O1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICByZXR1cm4gZ2V0RlNQcmVmaXgocGFyZW50KTtcclxufTtcclxuXHJcbmNvbnN0IGZzUHJlZml4ID0gZ2V0RlNQcmVmaXgoKTtcclxuY29uc3Qgcm9vdFBhdGggPSBwYXRoLmpvaW4oYC9gKTtcclxuXHJcbmNvbnN0IHRvVVJMU3RyaW5nID0gKGZpbGVQYXRoKSA9PiB7XHJcbiAgICBjb25zdCBwYXRoRnJhZ21lbnRzID0gcGF0aC5qb2luKGZpbGVQYXRoKS5cclxuICAgICAgICByZXBsYWNlKGZzUHJlZml4LCByb290UGF0aCkuXHJcbiAgICAgICAgc3BsaXQocGF0aC5zZXApO1xyXG4gICAgaWYgKCFwYXRoLmlzQWJzb2x1dGUoZmlsZVBhdGgpKSB7XHJcbiAgICAgICAgcGF0aEZyYWdtZW50cy51bnNoaWZ0KGAuYCk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIHJldHVybiBwYXRoRnJhZ21lbnRzLmpvaW4oYC9gKTtcclxufTtcclxuXHJcbmNvbnN0IHJlc29sdmVOYW1lID0gKGZyb20pID0+IFxyXG4gICAgZnJvbS5zcGxpdChgL2ApLlxyXG4gICAgICAgIHBvcCgpLlxyXG4gICAgICAgIHNwbGl0KGAuYCkuXHJcbiAgICAgICAgc2hpZnQoKTtcclxuXHJcbmV4cG9ydCBkZWZhdWx0ICh7IFxyXG4gICAgaW5jbHVkZSwgXHJcbiAgICBleGNsdWRlIFxyXG59ID0gZmFsc2UpID0+IHtcclxuICAgIGNvbnN0IGZpbHRlciA9IGNyZWF0ZUZpbHRlcihpbmNsdWRlLCBleGNsdWRlKTtcclxuICAgIFxyXG4gICAgcmV0dXJuIHtcclxuICAgICAgICBuYW1lOiBgcm9sbHVwLWdsb2JgLFxyXG4gICAgICAgIGxvYWQ6IChpZCkgPT4ge1xyXG4gICAgICAgICAgICBjb25zdCBzcmNGaWxlID0gcGF0aC5qb2luKG9zLnRtcGRpcigpLCBpZCk7XHJcblxyXG4gICAgICAgICAgICBsZXQgb3B0aW9ucztcclxuICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICAgIG9wdGlvbnMgPSBKU09OLnBhcnNlKGZzLnJlYWRGaWxlU3luYyhzcmNGaWxlKSk7XHJcbiAgICAgICAgICAgIH0gY2F0Y2goZXJyKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGNvbnN0IHsgaW1wb3J0ZWUsIGltcG9ydGVyIH0gPSBvcHRpb25zO1xyXG5cclxuICAgICAgICAgICAgY29uc3QgaW1wb3J0ZWVJc0Fic29sdXRlID0gcGF0aC5pc0Fic29sdXRlKGltcG9ydGVlKTtcclxuICAgICAgICAgICAgY29uc3QgY3dkID0gcGF0aC5kaXJuYW1lKGltcG9ydGVyKTtcclxuICAgICAgICAgICAgY29uc3QgZ2xvYlBhdHRlcm4gPSBpbXBvcnRlZTtcclxuXHJcbiAgICAgICAgICAgIGNvbnN0IGZpbGVzID0gZ2xvYi5zeW5jKGdsb2JQYXR0ZXJuLCB7XHJcbiAgICAgICAgICAgICAgICBjd2RcclxuICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICBsZXQgY29kZSA9IFsgYGNvbnN0IHJlcyA9IHt9O2AgXTtcclxuICAgICAgICAgICAgbGV0IGltcG9ydEFycmF5ID0gW107XHJcblxyXG4gICAgICAgICAgICBmaWxlcy5mb3JFYWNoKChmaWxlLCBpKSA9PiB7XHJcbiAgICAgICAgICAgICAgICBsZXQgZnJvbTtcclxuICAgICAgICAgICAgICAgIGlmIChpbXBvcnRlZUlzQWJzb2x1dGUpIHtcclxuICAgICAgICAgICAgICAgICAgICBmcm9tID0gdG9VUkxTdHJpbmcoZmlsZSk7XHJcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgIGZyb20gPSB0b1VSTFN0cmluZyhwYXRoLnJlc29sdmUoY3dkLCBmaWxlKSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBjb2RlLnB1c2goYGltcG9ydCBmJHtpfSBmcm9tIFwiJHtmcm9tfVwiO2ApO1xyXG4gICAgICAgICAgICAgICAgY29kZS5wdXNoKGByZXNbXCIke3Jlc29sdmVOYW1lKGZyb20pfVwiXSA9IGYke2l9O2ApO1xyXG4gICAgICAgICAgICAgICAgaW1wb3J0QXJyYXkucHVzaChmcm9tKTtcclxuICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICBjb2RlLnB1c2goYGV4cG9ydCBkZWZhdWx0IHJlcztgKTtcclxuXHJcbiAgICAgICAgICAgIGNvZGUgPSBjb2RlLmpvaW4oYFxcbmApO1xyXG4gICAgICAgIFxyXG4gICAgICAgICAgICByZXR1cm4gY29kZTtcclxuXHJcbiAgICAgICAgfSxcclxuICAgICAgICByZXNvbHZlSWQ6IChpbXBvcnRlZSwgaW1wb3J0ZXIpID0+IHtcclxuICAgICAgICAgICAgaWYgKCFmaWx0ZXIoaW1wb3J0ZWUpIHx8ICFpbXBvcnRlZS5pbmNsdWRlcyhgKmApKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGNvbnN0IGhhc2ggPSBtZDUoaW1wb3J0ZWUgKyBpbXBvcnRlcik7XHJcblxyXG4gICAgICAgICAgICBmcy53cml0ZUZpbGVTeW5jKHBhdGguam9pbihvcy50bXBkaXIoKSwgaGFzaCksIEpTT04uc3RyaW5naWZ5KHtcclxuICAgICAgICAgICAgICAgIGltcG9ydGVlLFxyXG4gICAgICAgICAgICAgICAgaW1wb3J0ZXJcclxuICAgICAgICAgICAgfSkpO1xyXG5cclxuICAgICAgICAgICAgcmV0dXJuIGhhc2g7XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxufTsiLCJpbXBvcnQgZnMgZnJvbSBcImZzXCI7XHJcblxyXG5leHBvcnQgZGVmYXVsdCAoe1xyXG4gICAgcGF0aCxcclxuICAgIHZlcnNpb25cclxufSkgPT4gXHJcbiAgICAoe1xyXG4gICAgICAgIG5hbWU6IGByb2xsdXAtd3JpdGVgLFxyXG4gICAgICAgIGJ1aWxkU3RhcnQ6ICgpID0+IHtcclxuICAgICAgICAgICAgZnMud3JpdGVGaWxlU3luYyhwYXRoLCB2ZXJzaW9uKCkpO1xyXG4gICAgICAgIH1cclxuICAgIH0pOyIsImltcG9ydCBwYXRoIGZyb20gXCJwYXRoXCI7XHJcblxyXG5pbXBvcnQgdG9tbCBmcm9tIFwicm9sbHVwLXBsdWdpbi10b21sXCI7XHJcbmltcG9ydCBzdmVsdGUgZnJvbSBcInJvbGx1cC1wbHVnaW4tc3ZlbHRlXCI7XHJcbmltcG9ydCByZXNvbHZlIGZyb20gXCJyb2xsdXAtcGx1Z2luLW5vZGUtcmVzb2x2ZVwiO1xyXG5cclxuaW1wb3J0IHJlcGxhY2UgZnJvbSBcInJvbGx1cC1wbHVnaW4tcmVwbGFjZVwiO1xyXG5cclxuaW1wb3J0IGpzb24gZnJvbSBcInJvbGx1cC1wbHVnaW4tanNvblwiO1xyXG5pbXBvcnQgbWQgZnJvbSBcInJvbGx1cC1wbHVnaW4tY29tbW9ubWFya1wiO1xyXG5pbXBvcnQgY2pzIGZyb20gXCJyb2xsdXAtcGx1Z2luLWNvbW1vbmpzXCI7XHJcblxyXG5pbXBvcnQgeyB0ZXJzZXIgfSBmcm9tIFwicm9sbHVwLXBsdWdpbi10ZXJzZXJcIjtcclxuaW1wb3J0IHV1aWQgZnJvbSBcInV1aWQvdjFcIjtcclxuXHJcbi8qXHJcbiAqIGltcG9ydCBzcHJpdGVzbWl0aCBmcm9tIFwicm9sbHVwLXBsdWdpbi1zcHJpdGVcIjtcclxuICogaW1wb3J0IHRleHR1cmVQYWNrZXIgZnJvbSBcInNwcml0ZXNtaXRoLXRleHR1cmVwYWNrZXJcIjtcclxuICovXHJcblxyXG5pbXBvcnQgZ2xvYiBmcm9tIFwiLi9wbHVnaW4tZ2xvYi5qc1wiO1xyXG5pbXBvcnQgdmVyc2lvbiBmcm9tIFwiLi92ZXJzaW9uLmpzXCI7XHJcblxyXG5jb25zdCBDT0RFX1ZFUlNJT04gPSB1dWlkKCk7XHJcbmNvbnN0IHByb2R1Y3Rpb24gPSBmYWxzZTtcclxuXHJcbmxldCBDTElFTlRfVkVSU0lPTiA9IHV1aWQoKTtcclxuXHJcbmNvbnN0IGV4dGVybmFsID0gW1xyXG4gICAgYGV4cHJlc3NgLFxyXG4gICAgYGlzZWthaWAsXHJcbiAgICBgZnNgLFxyXG4gICAgYGh0dHBgLFxyXG4gICAgYGh0dHBzYFxyXG5dO1xyXG5cclxuY29uc3Qgbm9kZSA9ICh7XHJcbiAgICBpbnB1dCxcclxuICAgIG91dHB1dCxcclxufSkgPT4gKHtcclxuICAgIGlucHV0LFxyXG4gICAgb3V0cHV0OiB7XHJcbiAgICAgICAgZmlsZTogb3V0cHV0LFxyXG4gICAgICAgIGZvcm1hdDogYGNqc2AsXHJcbiAgICB9LFxyXG4gICAgZXh0ZXJuYWwsXHJcbiAgICBwbHVnaW5zOiBbXHJcbiAgICAgICAgZ2xvYigpLFxyXG4gICAgICAgIHJlcGxhY2Uoe1xyXG4gICAgICAgICAgICBDT0RFX1ZFUlNJT04sXHJcbiAgICAgICAgfSksXHJcbiAgICAgICAgbWQoKSxcclxuICAgICAgICBqc29uKCksXHJcbiAgICAgICAgdG9tbFxyXG4gICAgXSxcclxufSk7XHJcblxyXG4vLyBUT0RPOiBPZmZlciB1cCBzb21lIG9mIHRoZXNlIG9wdGlvbnMgdG8gdGhlIERhZW1vbiBmaWxlc1xyXG5jb25zdCBicm93c2VyID0gKHtcclxuICAgIGlucHV0LFxyXG4gICAgb3V0cHV0LFxyXG4gICAgY3NzOiBjc3NQYXRoID0gYC4vREFUQS9wdWJsaWMvJHtwYXRoLmJhc2VuYW1lKG91dHB1dCwgYC5qc2ApfS5jc3NgXHJcbn0pID0+ICh7XHJcbiAgICBpbnB1dCxcclxuICAgIG91dHB1dDoge1xyXG4gICAgICAgIGZpbGU6IG91dHB1dCxcclxuICAgICAgICBmb3JtYXQ6IGBpaWZlYCxcclxuICAgICAgICBnbG9iYWxzOiB7XHJcbiAgICAgICAgICAgIFwicGl4aS5qc1wiOiBgUElYSWAsXHJcbiAgICAgICAgfSxcclxuICAgIH0sXHJcbiAgICBleHRlcm5hbDogWyBgdXVpZGAsIGB1dWlkL3YxYCwgYHBpeGkuanNgIF0sXHJcbiAgICBwbHVnaW5zOiBbXHJcbiAgICAgICAgLy8gLy8gbWFrZSB0aGlzIGEgcmVhY3RpdmUgcGx1Z2luIHRvIFwiLnRpbGVtYXAuanNvblwiXHJcbiAgICAgICAgLy8gICAgIHNwcml0ZXNtaXRoKHtcclxuICAgICAgICAvLyAgICAgICAgIHNyYzoge1xyXG4gICAgICAgIC8vICAgICAgICAgICAgIGN3ZDogXCIuL2dvYmxpbi5saWZlL0JST1dTRVIuUElYSS9cclxuICAgICAgICAvLyAgICAgICAgICAgICBnbG9iOiBcIioqLyoucG5nXCJcclxuICAgICAgICAvLyAgICAgICAgIH0sXHJcbiAgICAgICAgLy8gICAgICAgICB0YXJnZXQ6IHtcclxuICAgICAgICAvLyAgICAgICAgICAgICBpbWFnZTogXCIuL2Jpbi9wdWJsaWMvaW1hZ2VzL3Nwcml0ZS5wbmdcIixcclxuICAgICAgICAvLyAgICAgICAgICAgICBjc3M6IFwiLi9iaW4vcHVibGljL2FydC9kZWZhdWx0Lmpzb25cIlxyXG4gICAgICAgIC8vICAgICAgICAgfSxcclxuICAgICAgICAvLyAgICAgICAgIG91dHB1dDoge1xyXG4gICAgICAgIC8vICAgICAgICAgICAgIGltYWdlOiBcIi4vYmluL3B1YmxpYy9pbWFnZXMvc3ByaXRlLnBuZ1wiXHJcbiAgICAgICAgLy8gICAgICAgICB9LFxyXG4gICAgICAgIC8vICAgICAgICAgc3ByaXRlc21pdGhPcHRpb25zOiB7XHJcbiAgICAgICAgLy8gICAgICAgICAgICAgcGFkZGluZzogMFxyXG4gICAgICAgIC8vICAgICAgICAgfSxcclxuICAgICAgICAvLyAgICAgICAgIGN1c3RvbVRlbXBsYXRlOiB0ZXh0dXJlUGFja2VyXHJcbiAgICAgICAgLy8gICAgIH0pLFxyXG4gICAgICAgIGdsb2IoKSxcclxuICAgICAgICByZXNvbHZlKCksXHJcbiAgICAgICAgY2pzKHtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgfSksXHJcbiAgICAgICAganNvbigpLFxyXG4gICAgICAgIHJlcGxhY2Uoe1xyXG4gICAgICAgICAgICBDT0RFX1ZFUlNJT04sXHJcbiAgICAgICAgICAgIENMSUVOVF9WRVJTSU9OOiAoKSA9PiBDTElFTlRfVkVSU0lPTlxyXG4gICAgICAgIH0pLFxyXG4gICAgICAgIHRvbWwsXHJcbiAgICAgICAgbWQoKSxcclxuICAgICAgICBzdmVsdGUoe1xyXG4gICAgICAgICAgICBjc3M6IChjc3MpID0+IHtcclxuICAgICAgICAgICAgICAgIGNzcy53cml0ZShjc3NQYXRoKTtcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICB9KSxcclxuICAgICAgICBwcm9kdWN0aW9uICYmIHRlcnNlcigpLFxyXG4gICAgICAgIHZlcnNpb24oe1xyXG4gICAgICAgICAgICBwYXRoOiBgLi8uQklOL2NsaWVudC52ZXJzaW9uYCxcclxuICAgICAgICAgICAgdmVyc2lvbjogKCkgPT4gQ0xJRU5UX1ZFUlNJT05cclxuICAgICAgICB9KVxyXG4gICAgXVxyXG59KTtcclxuXHJcbmV4cG9ydCBkZWZhdWx0IHtcclxuICAgIG5vZGUsXHJcbiAgICBicm93c2VyXHJcbn07IiwiaW1wb3J0IHBhdGggZnJvbSBcInBhdGhcIjtcclxuaW1wb3J0IGdsb2IgZnJvbSBcImdsb2JcIjtcclxuXHJcbi8vIGRvbid0IHJlYWxseSBzdXBwb3J0IG92ZXJyaWRlc1xyXG5jb25zdCBnbG9iX29iaiA9IChvYmogPSB7fSwgZ2xvYl9wYXRoKSA9PiBnbG9iLnN5bmMoZ2xvYl9wYXRoKS5cclxuICAgIHJlZHVjZSgob2JqLCBlcXVpcF9wYXRoKSA9PiB7XHJcbiAgICAgICAgY29uc3QgcHJvamVjdF9uYW1lID0gcGF0aC5iYXNlbmFtZShwYXRoLnJlc29sdmUoZXF1aXBfcGF0aCwgYC4uYCwgYC4uYCkpO1xyXG4gICAgICAgIGNvbnN0IHNraWxsX25hbWUgPSBwYXRoLmJhc2VuYW1lKGVxdWlwX3BhdGgpO1xyXG5cclxuICAgICAgICBpZihvYmpbc2tpbGxfbmFtZV0pIHtcclxuICAgICAgICAvLyBwcmV2ZW50cyBoaWphY2tpbmdcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGAke3NraWxsX25hbWV9IGZyb20gJHtwcm9qZWN0X25hbWV9IG92ZXJsYXBzICR7b2JqW3NraWxsX25hbWVdfWApO1xyXG4gICAgICAgIH1cclxuICAgIFxyXG4gICAgICAgIHJldHVybiB7IFxyXG4gICAgICAgICAgICBbc2tpbGxfbmFtZV06IHBhdGgucmVsYXRpdmUocHJvY2Vzcy5jd2QoKSwgcGF0aC5yZXNvbHZlKGVxdWlwX3BhdGgsIGAuLmAsIGAuLmApKSxcclxuICAgICAgICAgICAgLi4ub2JqIFxyXG4gICAgICAgIH07XHJcbiAgICB9LCBvYmopO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgKCkgPT4gKHtcclxuICAgIFNLSUxMUzogW1xyXG4gICAgICAgIGAuL1NLSUxMUy8qL2AsIFxyXG4gICAgICAgIGAuL25vZGVfbW9kdWxlcy8qL1NLSUxMUy8qL2AsXHJcbiAgICAgICAgYC4vbm9kZV9tb2R1bGVzL0AqLyovU0tJTExTLyovYFxyXG4gICAgXS5yZWR1Y2UoZ2xvYl9vYmosIHt9KVxyXG59KTtcclxuIiwiaW1wb3J0IHRvbWwgZnJvbSBcInRvbWxcIjtcclxuaW1wb3J0IGZzIGZyb20gXCJmc1wiO1xyXG5cclxuY29uc3QgZ2V0X2NvbmZpZyA9IChjb25maWdGaWxlKSA9PiB7XHJcbiAgICAvLyB2ZXJpZnkgdG9tbCBleGlzdHNcclxuICAgIGxldCByYXc7XHJcblxyXG4gICAgdHJ5IHtcclxuICAgICAgICByYXcgPSBmcy5yZWFkRmlsZVN5bmMoY29uZmlnRmlsZSwgYHV0Zi04YCk7XHJcbiAgICB9IGNhdGNoIChleGNlcHRpb24pIHtcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYENvdWxkbid0IHJlYWQgJHtjb25maWdGaWxlfS4gQXJlIHlvdSBzdXJlIHRoaXMgcGF0aCBpcyBjb3JyZWN0P2ApO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IGNvbmZpZyA9IHRvbWwucGFyc2UocmF3KTtcclxuXHJcbiAgICAvLyBoYXMgaW1wbGVtZW50ZWRcclxuICAgIGlmKGNvbmZpZy5oYXMpIHtcclxuICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICAuLi5jb25maWcuaGFzLnJlZHVjZSgob2JqLCBvdGhlcl9maWxlKSA9PiAoe1xyXG4gICAgICAgICAgICAgICAgLi4uZ2V0X2NvbmZpZyhgLi9EQUVNT05TLyR7b3RoZXJfZmlsZX0udG9tbGApLFxyXG4gICAgICAgICAgICAgICAgLi4ub2JqXHJcbiAgICAgICAgICAgIH0pLCB7fSksIFxyXG4gICAgICAgICAgICAuLi5jb25maWdcclxuICAgICAgICB9O1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICByZXR1cm4gY29uZmlnO1xyXG59O1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgZ2V0X2NvbmZpZztcclxuIiwiaW1wb3J0IGZzIGZyb20gXCJmc1wiO1xyXG5pbXBvcnQgcGF0aCBmcm9tIFwicGF0aFwiO1xyXG5cclxuaW1wb3J0IGMgZnJvbSBcImNoYWxrXCI7XHJcbmltcG9ydCBidWlsZGVycyBmcm9tIFwiLi4vcm9sbHVwL2J1aWxkZXJzLmpzXCI7XHJcbmltcG9ydCBnZXRfc2tpbGxzIGZyb20gXCIuLi9saWIvZ2V0X3NraWxscy5qc1wiO1xyXG5pbXBvcnQgZ2V0X2NvbmZpZyBmcm9tIFwiLi4vbGliL2dldF9jb25maWcuanNcIjtcclxuXHJcbi8vIE1peCBDb25maWcgRmlsZSBpbiBhbmQgcnVuIHRoZXNlIGluIG9yZGVyXHJcbmV4cG9ydCBkZWZhdWx0IChjb25maWdGaWxlKSA9PiBPYmplY3QudmFsdWVzKHtcclxuICAgIGdldF9za2lsbHMsXHJcblxyXG4gICAgZ2V0X2NvbmZpZzogKHsgY29uZmlnRmlsZSB9KSA9PiAoe1xyXG4gICAgICAgIGNvbmZpZzogZ2V0X2NvbmZpZyhjb25maWdGaWxlKVxyXG4gICAgfSksXHJcbiAgICBcclxuICAgIHNldF9uYW1lczogKHtcclxuICAgICAgICBjb25maWdGaWxlLFxyXG4gICAgfSkgPT4ge1xyXG4gICAgICAgIGNvbnN0IG5hbWUgPSBwYXRoLmJhc2VuYW1lKGNvbmZpZ0ZpbGUsIGAudG9tbGApO1xyXG5cclxuICAgICAgICBjb25zdCBwYWNrYWdlX3BhdGggPSBwYXRoLmRpcm5hbWUocGF0aC5yZXNvbHZlKGNvbmZpZ0ZpbGUpKTtcclxuICAgICAgICBjb25zdCBwYWNrYWdlX25hbWUgPSBwYWNrYWdlX3BhdGguXHJcbiAgICAgICAgICAgIHNwbGl0KHBhdGguc2VwKS5cclxuICAgICAgICAgICAgcG9wKCk7XHJcblxyXG4gICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgIHBhY2thZ2VfcGF0aCxcclxuICAgICAgICAgICAgcGFja2FnZV9uYW1lLFxyXG4gICAgICAgICAgICBuYW1lLFxyXG4gICAgICAgIH07XHJcbiAgICB9LFxyXG5cclxuICAgIHdyaXRlX2VudHJ5OiAoe1xyXG4gICAgICAgIGNvbmZpZyxcclxuICAgICAgICBuYW1lLFxyXG4gICAgICAgIFNLSUxMU1xyXG4gICAgfSkgPT4ge1xyXG4gICAgICAgIC8vIFdSSVRFIE9VVCBGSUxFXHJcbiAgICAgICAgbGV0IGVudHJ5ID0gYGA7XHJcbiAgICAgICAgY29uc3QgdHlwZSA9IGNvbmZpZy5OT0RFIFxyXG4gICAgICAgICAgICA/IGBub2RlYCBcclxuICAgICAgICAgICAgOiBgYnJvd3NlcmA7XHJcblxyXG4gICAgICAgIGNvbnN0IHdyaXRlID0gKGRhdGEpID0+IHtcclxuICAgICAgICAgICAgZW50cnkgKz0gYCR7ZGF0YX1cXHJcXG5gO1xyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIGNvbmZpZy5EQUVNT04gPSB7IG5hbWUgfTtcclxuICAgICAgICBcclxuICAgICAgICB3cml0ZShgaW1wb3J0IGlzZWthaSBmcm9tIFwiaXNla2FpXCI7YCk7XHJcbiAgICAgICAgd3JpdGUoYGlzZWthaS5TRVQoJHtKU09OLnN0cmluZ2lmeShjb25maWcpfSk7YCk7XHJcbiAgICAgICAgd3JpdGUoYGApO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICBjb25zdCBmYWlscyA9IFtdO1xyXG4gICAgICAgIGNvbnN0IGVxdWlwZWQgPSBPYmplY3Qua2V5cyhjb25maWcpLlxyXG4gICAgICAgICAgICBmaWx0ZXIoKGtleSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgY29uc3QgaXNfdXBwZXIgPSBrZXkgPT09IGtleS50b1VwcGVyQ2FzZSgpO1xyXG4gICAgICAgICAgICAgICAgaWYoIWlzX3VwcGVyKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgIGNvbnN0IGhhc19za2lsbCA9IFNLSUxMU1trZXldICE9PSB1bmRlZmluZWQ7XHJcblxyXG4gICAgICAgICAgICAgICAgY29uc3QgaXNfdGFyZ2V0ID0gWyBgQlJPV1NFUmAsIGBOT0RFYCBdLmluZGV4T2Yoa2V5KSAhPT0gLTE7XHJcblxyXG4gICAgICAgICAgICAgICAgaWYoIWhhc19za2lsbCAmJiAhaXNfdGFyZ2V0KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgZmFpbHMucHVzaChrZXkpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgIHJldHVybiBpc191cHBlciAmJiBoYXNfc2tpbGw7XHJcbiAgICAgICAgICAgIH0pLlxyXG4gICAgICAgICAgICBtYXAoKGtleSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgY29uc3Qgd2hlcmUgPSBTS0lMTFNba2V5XSA9PT0gYGBcclxuICAgICAgICAgICAgICAgICAgICA/IGAuLmBcclxuICAgICAgICAgICAgICAgICAgICA6IGAuLi8ke1NLSUxMU1trZXldLnNwbGl0KHBhdGguc2VwKS5cclxuICAgICAgICAgICAgICAgICAgICAgICAgam9pbihgL2ApfWA7XHJcblxyXG4gICAgICAgICAgICAgICAgd3JpdGUoYGltcG9ydCAke2tleX0gZnJvbSBcIiR7d2hlcmV9L1NLSUxMUy8ke2tleX0vJHt0eXBlfS5qc1wiO2ApO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIHJldHVybiBrZXk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICBjb25zdCBmYWlsZWQgPSBmYWlscy5sZW5ndGggPiAwXHJcbiAgICAgICAgICAgID8gYEZBSUxFRCBUTyBGSU5EXFxyXFxuJHtmYWlscy5tYXAoKGYpID0+IGBbJHtmfV1gKS5cclxuICAgICAgICAgICAgICAgIGpvaW4oYCB4IGApfWBcclxuICAgICAgICAgICAgOiBgYDtcclxuXHJcbiAgICAgICAgY29uc3Qga2V5cyA9IGVxdWlwZWQucmVkdWNlKChvdXRwdXQsIGtleSkgPT4gYCR7b3V0cHV0fSAgICAke2tleX0sXFxyXFxuYCwgYGApO1xyXG5cclxuICAgICAgICB3cml0ZShgXHJcbmlzZWthaS5FUVVJUCh7XFxyXFxuJHtrZXlzfX0pO2ApO1xyXG5cclxuICAgICAgICBjb25zdCBCSU4gPSBgLkJJTmA7XHJcbiAgICAgICAgY29uc3QgaW5wdXQgPSBwYXRoLmpvaW4oQklOLCBgJHtuYW1lfS5lbnRyeS5qc2ApO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICBpZiAoIWZzLmV4aXN0c1N5bmMoQklOKSkge1xyXG4gICAgICAgICAgICBjb25zb2xlLmxvZyhgQ1JFQVRJTkcgJHtCSU59YCk7XHJcbiAgICAgICAgICAgIGZzLm1rZGlyU3luYyhCSU4pO1xyXG4gICAgICAgIH1cclxuICAgICAgICAvLyB3cml0ZSBvdXQgdGhlaXIgaW5kZXguanNcclxuICAgICAgICBmcy53cml0ZUZpbGVTeW5jKGlucHV0LCBlbnRyeSwgYHV0Zi04YCk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgIGNvbnNvbGUubG9nKGBcclxuWyR7bmFtZX1dWyR7dHlwZX1dXHJcblxyXG5TS0lMTFNcclxuJHtjLmJsdWVCcmlnaHQoZXF1aXBlZC5tYXAoKGUpID0+IGBbJHtlfV1gKS5cclxuICAgICAgICBqb2luKGAgKyBgKSl9XHJcblxyXG4ke2MucmVkKGZhaWxlZCl9XHJcbmApO1xyXG5cclxuICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICBpbnB1dFxyXG4gICAgICAgIH07XHJcbiAgICB9LFxyXG5cclxuICAgIHJ1bl9idWlsZGVyczogKHtcclxuICAgICAgICBpbnB1dCxcclxuICAgICAgICBuYW1lLFxyXG4gICAgICAgIGNvbmZpZyxcclxuICAgIH0pID0+IHtcclxuICAgICAgICBpZihjb25maWcuTk9ERSAmJiBjb25maWcuQlJPV1NFUikge1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFlvdSBjYW5ub3QgdGFyZ2V0IGJvdGggW05PREVdIGFuZCBbQlJPV1NFUl1gKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmKGNvbmZpZy5OT0RFKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IG91dHB1dCA9IGAuQklOLyR7bmFtZX0uanNgOyAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgICAgIG91dHB1dCxcclxuICAgICAgICAgICAgICAgIGJ1aWxkX2luZm86IGJ1aWxkZXJzLm5vZGUoe1xyXG4gICAgICAgICAgICAgICAgICAgIGlucHV0LFxyXG4gICAgICAgICAgICAgICAgICAgIG91dHB1dFxyXG4gICAgICAgICAgICAgICAgfSlcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgaWYoY29uZmlnLkJST1dTRVIpIHtcclxuICAgICAgICAgICAgY29uc3Qgb3V0cHV0ID0gYERBVEEvcHVibGljLyR7bmFtZX0uanNgO1xyXG5cclxuICAgICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgICAgIG91dHB1dCxcclxuICAgICAgICAgICAgICAgIGJ1aWxkX2luZm86IGJ1aWxkZXJzLmJyb3dzZXIoe1xyXG4gICAgICAgICAgICAgICAgICAgIGlucHV0LFxyXG4gICAgICAgICAgICAgICAgICAgIG91dHB1dFxyXG4gICAgICAgICAgICAgICAgfSlcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgWW91IG11c3Qgc3BlY2lmeSBlaXRoZXIgW05PREVdIG9yIFtCUk9XU0VSXSBmb3IgeW91ciB0YXJnZXQgaW4geW91ciBbREFFTU9OXSB0b21sYCk7XHJcbiAgICB9XHJcbn0pLlxyXG4gICAgcmVkdWNlKChzdGF0ZSwgZm4pID0+ICh7XHJcbiAgICAgICAgLi4uc3RhdGUsXHJcbiAgICAgICAgLi4uZm4oc3RhdGUpXHJcbiAgICB9KSwgeyBjb25maWdGaWxlIH0pO1xyXG4iLCJpbXBvcnQgZ2xvYiBmcm9tIFwiZ2xvYlwiO1xyXG5pbXBvcnQgcGF0aCBmcm9tIFwicGF0aFwiO1xyXG5pbXBvcnQgZ2V0X2NvbmZpZyBmcm9tIFwiLi9nZXRfY29uZmlnLmpzXCI7XHJcblxyXG5leHBvcnQgZGVmYXVsdCAoZXhjbHVkZSA9IGZhbHNlKSA9PiB7XHJcbiAgICBpZighZXhjbHVkZSkge1xyXG4gICAgICAgIHJldHVybiBnbG9iLnN5bmMoYC4vREFFTU9OUy8qLnRvbWxgKS5cclxuICAgICAgICAgICAgbWFwKChjbGFzc19wYXRoKSA9PiBwYXRoLmJhc2VuYW1lKGNsYXNzX3BhdGgsIGAudG9tbGApKTtcclxuICAgIH1cclxuXHJcblxyXG4gICAgcmV0dXJuIGdsb2Iuc3luYyhgLi9EQUVNT05TLyoudG9tbGApLlxyXG4gICAgICAgIGZpbHRlcigoZGFlbW9uKSA9PiBnZXRfY29uZmlnKGRhZW1vbikuTk9ERSkuXHJcbiAgICAgICAgbWFwKChjbGFzc19wYXRoKSA9PiBwYXRoLmJhc2VuYW1lKGNsYXNzX3BhdGgsIGAudG9tbGApKTtcclxufTsiLCJpbXBvcnQgZ2V0X2xpc3QgZnJvbSBcIi4vZ2V0X2xpc3QuanNcIjtcclxuXHJcbmV4cG9ydCBkZWZhdWx0IChjbGFzc2VzKSA9PiBjbGFzc2VzLmZpbHRlcigodGFyZ2V0KSA9PiB7XHJcbiAgICBjb25zdCBpc19va2F5ID0gZ2V0X2xpc3QoKS5cclxuICAgICAgICBpbmRleE9mKHRhcmdldCkgIT09IC0xO1xyXG5cclxuICAgIGlmKCFpc19va2F5KSB7XHJcbiAgICAgICAgY29uc29sZS5sb2coYCR7dGFyZ2V0fSBpcyBub3QgYW4gYXZhaWxhYmxlIFtEQUVNT05dYCk7XHJcbiAgICB9XHJcbiAgICAgICAgXHJcbiAgICByZXR1cm4gaXNfb2theTtcclxufSk7XHJcbiIsImltcG9ydCBnZXRfbGlzdCBmcm9tIFwiLi9nZXRfbGlzdC5qc1wiO1xyXG5pbXBvcnQgZmlsdGVyX2xpc3QgZnJvbSBcIi4vZmlsdGVyX2xpc3QuanNcIjtcclxuXHJcbmV4cG9ydCBkZWZhdWx0ICh7XHJcbiAgICBjbWQsXHJcbiAgICBEQUVNT05TXHJcbn0pID0+IHtcclxuICAgIGlmKCFEQUVNT05TKSB7XHJcbiAgICAgICAgcmV0dXJuIGNtZC5wcm9tcHQoe1xyXG4gICAgICAgICAgICB0eXBlOiBgbGlzdGAsXHJcbiAgICAgICAgICAgIG5hbWU6IGBEQUVNT05gLFxyXG4gICAgICAgICAgICBtZXNzYWdlOiBgV2hpY2ggW0RBRU1PTl0/YCxcclxuICAgICAgICAgICAgY2hvaWNlczogWyBgYWxsYCwgLi4uZ2V0X2xpc3QoKSBdXHJcbiAgICAgICAgfSkuXHJcbiAgICAgICAgICAgIHRoZW4oKHsgREFFTU9OIH0pID0+IERBRU1PTiA9PT0gYGFsbGAgXHJcbiAgICAgICAgICAgICAgICA/IGdldF9saXN0KCkgXHJcbiAgICAgICAgICAgICAgICA6IGZpbHRlcl9saXN0KFsgREFFTU9OIF0pKTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgaWYoREFFTU9OU1swXSA9PT0gYGFsbGApIHtcclxuICAgICAgICByZXR1cm4gZ2V0X2xpc3QoKTtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gZmlsdGVyX2xpc3QoREFFTU9OUyk7XHJcbn07IiwiaW1wb3J0IHRvbWxfdG9fanMgZnJvbSBcIi4uL3RyYW5zZm9ybXMvdG9tbF90b19qcy5qc1wiO1xyXG5pbXBvcnQgcm9sbHVwIGZyb20gXCJyb2xsdXBcIjtcclxuXHJcbmltcG9ydCBwcm9tcHRfZGFlbW9ucyBmcm9tIFwiLi4vbGliL3Byb21wdF9kYWVtb25zLmpzXCI7XHJcblxyXG5leHBvcnQgZGVmYXVsdCAoe1xyXG4gICAgY29tbWFuZDogYGJ1aWxkIFtEQUVNT05TLi4uXWAsXHJcbiAgICBoZWxwOiBgYnVpbGQgYWxsIFtEQUVNT05dIHNhdmUocykuYCxcclxuICAgIGhpZGRlbjogdHJ1ZSxcclxuICAgIGFzeW5jIGhhbmRsZXIoeyBEQUVNT05TIH0pIHtcclxuICAgICAgICBjb25zdCBEQUVNT05zID0gYXdhaXQgcHJvbXB0X2RhZW1vbnMoeyBcclxuICAgICAgICAgICAgY21kOiB0aGlzLFxyXG4gICAgICAgICAgICBEQUVNT05TIFxyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICBjb25zdCBidWlsdCA9IGF3YWl0IFByb21pc2UuYWxsKERBRU1PTnMubWFwKGFzeW5jICh0YXJnZXQpID0+IHtcclxuICAgICAgICAgICAgY29uc3QgeyBidWlsZF9pbmZvLCBuYW1lIH0gPSBhd2FpdCB0b21sX3RvX2pzKGAuL0RBRU1PTlMvJHt0YXJnZXR9LnRvbWxgKTtcclxuICAgICAgICAgICAgY29uc3QgYnVuZGxlID0gYXdhaXQgcm9sbHVwLnJvbGx1cChidWlsZF9pbmZvKTtcclxuXHJcbiAgICAgICAgICAgIGF3YWl0IGJ1bmRsZS53cml0ZShidWlsZF9pbmZvLm91dHB1dCk7XHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbJHtuYW1lfV0gQnVpbGQgQ29tcGxldGUuXFxyXFxuYCk7XHJcbiAgICAgICAgfSkpO1xyXG5cclxuICAgICAgICBjb25zb2xlLmxvZyhgQnVpbHQgJHtidWlsdC5sZW5ndGh9IFtEQUVNT05dKHMpLmApO1xyXG4gICAgfVxyXG59KTsiLCJpbXBvcnQgR2l0IGZyb20gXCJzaW1wbGUtZ2l0L3Byb21pc2VcIjtcclxuXHJcbmNvbnN0IGdpdCA9IEdpdCgpO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgKHtcclxuICAgIGNvbW1hbmQ6IGBjb21taXQgW21lc3NhZ2UuLi5dYCxcclxuICAgIGhlbHA6IGBjb21taXQgY3VycmVudCBmaWxlcyB0byBzb3VyY2UgY29udHJvbGAsXHJcbiAgICBoYW5kbGVyOiAoe1xyXG4gICAgICAgIG1lc3NhZ2UgPSBbIGBVcGRhdGUsIG5vIGNvbW1pdCBtZXNzYWdlYCBdXHJcbiAgICB9KSA9PiBnaXQuYWRkKFsgYC5gIF0pLlxyXG4gICAgICAgIHRoZW4oKCkgPT4gZ2l0LnN0YXR1cygpKS5cclxuICAgICAgICB0aGVuKCgpID0+IGdpdC5jb21taXQobWVzc2FnZS5qb2luKGAgYCkpKS5cclxuICAgICAgICB0aGVuKCgpID0+IGdpdC5wdXNoKGBvcmlnaW5gLCBgbWFzdGVyYCkpLlxyXG4gICAgICAgIHRoZW4oKCkgPT4gY29uc29sZS5sb2coYENvbW1pdGVkIHdpdGggbWVzc2FnZSAke21lc3NhZ2Uuam9pbihgIGApfWApKVxyXG59KTtcclxuIiwiaW1wb3J0IGRlZ2l0IGZyb20gXCJkZWdpdFwiO1xyXG5pbXBvcnQgeyBleGVjIH0gZnJvbSBcImNoaWxkX3Byb2Nlc3NcIjtcclxuaW1wb3J0IEdpdCBmcm9tIFwic2ltcGxlLWdpdC9wcm9taXNlXCI7XHJcblxyXG5jb25zdCBnaXQgPSBHaXQoKTtcclxuXHJcbmV4cG9ydCBkZWZhdWx0ICh7XHJcbiAgICBjb21tYW5kOiBgY3JlYXRlIFt0ZW1wbGF0ZV0gW25hbWVdYCxcclxuICAgIGhlbHA6IGBDcmVhdGUgYSBuZXcgaXNla2FpIHByb2plY3QgZnJvbSBbdGVtcGxhdGVdIG9yIEBpc2VrYWkvdGVtcGxhdGVgLFxyXG4gICAgYWxpYXM6IFsgYGluaXRgIF0sXHJcbiAgICBvcHRpb25zOiB7XHJcbiAgICAgICAgXCItZiwgLS1mb3JjZVwiOiBgZm9yY2Ugb3ZlcndyaXRlIGZyb20gdGVtcGxhdGVgXHJcbiAgICB9LFxyXG4gICAgaGFuZGxlcjogKHtcclxuICAgICAgICB0ZW1wbGF0ZSA9IGBpc2VrYWktZGV2L3RlbXBsYXRlYCxcclxuICAgICAgICBuYW1lID0gYC5gLFxyXG4gICAgICAgIG9wdGlvbnM6IHtcclxuICAgICAgICAgICAgZm9yY2UgPSBmYWxzZVxyXG4gICAgICAgIH0gPSBmYWxzZVxyXG4gICAgfSkgPT4gZGVnaXQodGVtcGxhdGUsIHsgZm9yY2UgfSkuXHJcbiAgICAgICAgY2xvbmUobmFtZSkuXHJcbiAgICAgICAgdGhlbigoKSA9PiBnaXQuaW5pdCgpKS5cclxuICAgICAgICB0aGVuKCgpID0+IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcclxuICAgICAgICAgICAgY29uc29sZS5sb2coYCR7dGVtcGxhdGV9IGNvcGllZCB0byAke25hbWV9YCk7XHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGBJTlNUQUxMSU5HOiBUSElTIE1BWSBUQUtFIEFXSElMRWApO1xyXG4gICAgICAgICAgICBleGVjKGBucG0gaW5zdGFsbGAsIChlcnIpID0+IHtcclxuICAgICAgICAgICAgICAgIGlmKGVycikge1xyXG4gICAgICAgICAgICAgICAgICAgIHJlamVjdChlcnIpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgcmVzb2x2ZSgpO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9KSkuXHJcbiAgICAgICAgdGhlbigoKSA9PiB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGBDT01QTEVURTogW3J1bl0gdG8gc3RhcnQgeW91ciBEQUVNT05zLmApO1xyXG4gICAgICAgIH0pXHJcbn0pOyIsImltcG9ydCBnZXRfbGlzdCBmcm9tIFwiLi4vbGliL2dldF9saXN0LmpzXCI7XHJcblxyXG5leHBvcnQgZGVmYXVsdCAoe1xyXG4gICAgaGVscDogYFNob3cgYXZhaWxhYmxlIFtEQUVNT05dIHNhdmVzLmAsXHJcbiAgICBhbGlhczogWyBgbHNgLCBgc2F2ZXNgIF0sXHJcbiAgICBoYW5kbGVyOiAoYXJncywgY2IpID0+IHtcclxuICAgICAgICBjb25zb2xlLmxvZyhnZXRfbGlzdCgpLlxyXG4gICAgICAgICAgICBtYXAoKGkpID0+IGBbJHtpfV1gKS5cclxuICAgICAgICAgICAgam9pbihgIC0gYCksIGBcXHJcXG5gKTsgICAgXHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgIGNiKCk7XHJcbiAgICB9XHJcbn0pOyIsImV4cG9ydCBkZWZhdWx0IChcclxuICAgIGFjdGlvbl9tYXAsIFxyXG4gICAgcmVkdWNlciA9IChpKSA9PiBpXHJcbikgPT4gKGlucHV0KSA9PiB7XHJcbiAgICBjb25zdCBrZXkgPSByZWR1Y2VyKGlucHV0KTtcclxuXHJcbiAgICBpZighYWN0aW9uX21hcFtrZXldKSB7XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiBhY3Rpb25fbWFwW2tleV0oaW5wdXQpO1xyXG59OyIsImltcG9ydCBjaG9raWRhciBmcm9tIFwiY2hva2lkYXJcIjtcclxuaW1wb3J0IHJvbGx1cCBmcm9tIFwicm9sbHVwXCI7XHJcbmltcG9ydCBjIGZyb20gXCJjaGFsa1wiO1xyXG5cclxuaW1wb3J0IHRvbWxfdG9fanMgZnJvbSBcIi4uL3RyYW5zZm9ybXMvdG9tbF90b19qcy5qc1wiO1xyXG5cclxuaW1wb3J0IGFjdGlvbiBmcm9tIFwiLi4vbGliL2FjdGlvbi5qc1wiO1xyXG5pbXBvcnQgcHJvbXB0X2RhZW1vbnMgZnJvbSBcIi4uL2xpYi9wcm9tcHRfZGFlbW9ucy5qc1wiO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgKHtcclxuICAgIGNvbW1hbmQ6IGBsb2FkIFtEQUVNT05TLi4uXWAsXHJcbiAgICBoZWxwOiBgbG9hZCBbREFFTU9OXSBzYXZlc2AsXHJcbiAgICBhbGlhczogWyBgcmVnZW5lcmF0ZWAsIGByZWNyZWF0ZWAsIGB3YXRjaGAgXSxcclxuICAgIGhpZGRlbjogdHJ1ZSxcclxuICAgIGNhbmNlbCAoKSB7XHJcbiAgICAgICAgdGhpcy53YXRjaGVycy5mb3JFYWNoKCh3YXRjaGVyKSA9PiB3YXRjaGVyLmNsb3NlKCkpO1xyXG4gICAgICAgIGNvbnNvbGUubG9nKGBZT1VSIFdBVENIIEhBUyBFTkRFRGApO1xyXG4gICAgfSxcclxuICAgIGFzeW5jIGhhbmRsZXIoeyBEQUVNT05TIH0pIHtcclxuICAgICAgICB0aGlzLndhdGNoZXJzID0gW107XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgIGNvbnN0IERBRU1PTnMgPSBhd2FpdCBwcm9tcHRfZGFlbW9ucyh7XHJcbiAgICAgICAgICAgIGNtZDogdGhpcyxcclxuICAgICAgICAgICAgREFFTU9OU1xyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIFxyXG4gICAgICAgIERBRU1PTnMuZm9yRWFjaCgodGFyZ2V0KSA9PiB7XHJcbiAgICAgICAgICAgIGNvbnN0IGZpbGVfcGF0aCA9IGAuL0RBRU1PTlMvJHt0YXJnZXR9LnRvbWxgO1xyXG5cclxuICAgICAgICAgICAgY29uc3QgZGF0YSA9IHRvbWxfdG9fanMoZmlsZV9wYXRoKTtcclxuXHJcbiAgICAgICAgICAgIGNvbnN0IHsgYnVpbGRfaW5mbyB9ID0gZGF0YTtcclxuICAgICAgICBcclxuICAgICAgICAgICAgLy8gcmVidWlsZCBvbiBmaWxlIGNoYWduZVxyXG4gICAgICAgICAgICBjb25zdCB3YXRjaGVyID0gY2hva2lkYXIud2F0Y2goZmlsZV9wYXRoKTtcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICB3YXRjaGVyLm9uKGBjaGFuZ2VgLCAoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICB0b21sX3RvX2pzKGZpbGVfcGF0aCk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHRoaXMud2F0Y2hlcnMucHVzaCh3YXRjaGVyKTtcclxuXHJcbiAgICAgICAgICAgIGNvbnN0IHJvbGx1cF93YXRjaGVyID0gcm9sbHVwLndhdGNoKHtcclxuICAgICAgICAgICAgICAgIC4uLmJ1aWxkX2luZm8sXHJcbiAgICAgICAgICAgICAgICB3YXRjaDoge1xyXG4gICAgICAgICAgICAgICAgICAgIGNsZWFyU2NyZWVuOiB0cnVlXHJcbiAgICAgICAgICAgICAgICB9ICAgXHJcbiAgICAgICAgICAgIH0pLlxyXG4gICAgICAgICAgICAgICAgb24oYGV2ZW50YCwgYWN0aW9uKHtcclxuICAgICAgICAgICAgICAgICAgICBCVU5ETEVfRU5EOiAoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbJHt0YXJnZXR9XVtXQVRDSF0gQnVpbHQuYCk7XHJcbiAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICBFUlJPUjogKGUpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coZSk7XHJcbiAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICBGQVRBTDogKHsgZXJyb3IgfSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKGMucmVkLmJvbGQoZXJyb3IpKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9LCAoeyBjb2RlIH0pID0+IGNvZGUgXHJcbiAgICAgICAgICAgICAgICApKTtcclxuXHJcbiAgICAgICAgICAgIHRoaXMud2F0Y2hlcnMucHVzaChyb2xsdXBfd2F0Y2hlcik7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcbn0pO1xyXG4iLCJpbXBvcnQgcG0yIGZyb20gXCJwbTJcIjtcclxuXHJcbmltcG9ydCB0b21sX3RvX2pzIGZyb20gXCIuLi90cmFuc2Zvcm1zL3RvbWxfdG9fanMuanNcIjtcclxuXHJcbmltcG9ydCBwcm9tcHRfZGFlbW9ucyBmcm9tIFwiLi4vbGliL3Byb21wdF9kYWVtb25zLmpzXCI7XHJcblxyXG5leHBvcnQgZGVmYXVsdCAoe1xyXG4gICAgY29tbWFuZGVyOiBgc3Bhd24gW0RBRU1PTlMuLi5dYCxcclxuICAgIGhlbHA6IGBzcGF3biBbREFFTU9OU10gZmlsZXNgLFxyXG4gICAgaGlkZGVuOiB0cnVlLFxyXG4gICAgYXN5bmMgaGFuZGxlcih7IERBRU1PTlMgfSkge1xyXG4gICAgICAgIGNvbnN0IGRhZW1vbnMgPSBhd2FpdCBwcm9tcHRfZGFlbW9ucyh7XHJcbiAgICAgICAgICAgIGNtZDogdGhpcyxcclxuICAgICAgICAgICAgREFFTU9OU1xyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICBkYWVtb25zLmZvckVhY2goKERBRU1PTikgPT4ge1xyXG4gICAgICAgICAgICBjb25zdCB7XHJcbiAgICAgICAgICAgICAgICBvdXRwdXQsXHJcbiAgICAgICAgICAgICAgICBjb25maWc6IHtcclxuICAgICAgICAgICAgICAgICAgICBOT0RFXHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0gPSB0b21sX3RvX2pzKGAuL0RBRU1PTlMvJHtEQUVNT059LnRvbWxgKTtcclxuXHJcbiAgICAgICAgICAgIGlmKCFOT0RFKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIC8vIEhBQ0s6IGNvdWxkIG5hbWUgdGhlIGZpbGUgb2YgdGhlIFRPTUwgc29tZXRoaW5nIGduYXJseVxyXG4gICAgICAgICAgICBwbTIuc3RhcnQoe1xyXG4gICAgICAgICAgICAgICAgbmFtZTogREFFTU9OLFxyXG4gICAgICAgICAgICAgICAgc2NyaXB0OiBvdXRwdXQsXHJcbiAgICAgICAgICAgICAgICB3YXRjaDogYC4vJHtvdXRwdXR9YCxcclxuICAgICAgICAgICAgICAgIGZvcmNlOiB0cnVlLFxyXG4gICAgICAgICAgICAgICAgd2F0Y2hfb3B0aW9uczoge1xyXG4gICAgICAgICAgICAgICAgICAgIC8vIHl1cCBQTTIgd2FzIHNldHRpbmcgYSBkZWZhdWx0IGlnbm9yZVxyXG4gICAgICAgICAgICAgICAgICAgIGlnbm9yZWQ6IGBgLFxyXG4gICAgICAgICAgICAgICAgICAgIHVzZVBvbGxpbmc6IHRydWVcclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICBtYXhfcmVzdGFydDogMFxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgY29uc29sZS5sb2coYFNwYXduZWQgJHtkYWVtb25zLmpvaW4oYCAtIGApfWApO1xyXG4gICAgfVxyXG59KTtcclxuIiwiaW1wb3J0IHdhdGNoIGZyb20gXCIuL3dhdGNoLmpzXCI7XHJcbmltcG9ydCBzcGF3biBmcm9tIFwiLi9zcGF3bi5qc1wiO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgKHtcclxuICAgIGNvbW1hbmRzOiBgZGV2YCxcclxuICAgIGhlbHA6IGBydW4gYW5kIHdhdGNoIGV2ZXJ5dGhpbmdgLFxyXG4gICAgaGFuZGxlcnM6IGFzeW5jICgpID0+IHtcclxuICAgICAgICBhd2FpdCB3YXRjaC5oYW5kbGVyKHsgREFFTU9OUzogYGFsbGAgfSk7XHJcbiAgICAgICAgYXdhaXQgc3Bhd24uaGFuZGxlcih7IERBRU1PTlM6IGBhbGxgIH0pO1xyXG4gICAgfVxyXG59KTtcclxuIiwiLy8gcGlwZSBvdXQgdG8gcG0yXHJcbmltcG9ydCB7IHNwYXduIH0gZnJvbSBcImNoaWxkX3Byb2Nlc3NcIjtcclxuaW1wb3J0IHBhdGggZnJvbSBcInBhdGhcIjtcclxuXHJcbmNvbnN0IHBtMl9wYXRoID0gcGF0aC5kaXJuYW1lKHJlcXVpcmUucmVzb2x2ZShgcG0yYCkpO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgKHsgY29tbWFuZHMgfSkgPT4ge1xyXG4gICAgbGV0IG5vZGUgPSBzcGF3bihgbm9kZWAsIGAke3BtMl9wYXRofS9iaW4vcG0yICR7Y29tbWFuZHMuam9pbihgIGApfWAuc3BsaXQoYCBgKSwge1xyXG4gICAgICAgIGN3ZDogcHJvY2Vzcy5jd2QoKSxcclxuICAgICAgICBlbnY6IHByb2Nlc3MuZW52LFxyXG4gICAgICAgIHN0ZGlvOiBgaW5oZXJpdGBcclxuICAgIH0pO1xyXG5cclxuICAgIHJldHVybiB7XHJcbiAgICAgICAgZG9uZTogbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHtcclxuICAgICAgICAgICAgbm9kZS5vbihgY2xvc2VgLCAoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICByZXNvbHZlKCk7XHJcbiAgICAgICAgICAgICAgICBub2RlID0gZmFsc2U7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0pLFxyXG5cclxuICAgICAgICBjYW5jZWw6ICgpID0+IHtcclxuICAgICAgICAgICAgaWYoIW5vZGUpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgfVxyXG4gICAgXHJcbiAgICAgICAgICAgIG5vZGUua2lsbCgpO1xyXG4gICAgICAgIH0gICBcclxuICAgIH07XHJcbn07XHJcbiIsImltcG9ydCBwbTIgZnJvbSBcIi4uL2xpYi9wbTIuanNcIjtcclxuXHJcbmV4cG9ydCBkZWZhdWx0ICh7XHJcbiAgICBjb21tYW5kOiBgbG9ncyBbREFFTU9OUy4uLl1gLFxyXG4gICAgaGVscDogYGZvbGxvdyB0aGUgYWN0aXZlIFtEQUVNT05dIGxvZ3NgLFxyXG4gICAgaGFuZGxlcjogKHsgREFFTU9OUyA9IFtdIH0pID0+IHBtMih7XHJcbiAgICAgICAgY29tbWFuZHM6IFsgYGxvZ3NgLCAuLi5EQUVNT05TIF1cclxuICAgIH0pLmRvbmVcclxuICAgIFxyXG59KTsiLCJpbXBvcnQgR2l0IGZyb20gXCJzaW1wbGUtZ2l0L3Byb21pc2VcIjtcclxuaW1wb3J0IHsgZXhlYyB9IGZyb20gXCJjaGlsZF9wcm9jZXNzXCI7XHJcblxyXG5jb25zdCBnaXQgPSBHaXQoKTtcclxuXHJcbmV4cG9ydCBkZWZhdWx0ICh7XHJcbiAgICBjb21tYW5kOiBgcHVsbGAsXHJcbiAgICBoZWxwOiBgZ2V0IGN1cnJlbnQgZmlsZXMgZnJvbSBzb3VyY2UgY29udHJvbGAsXHJcbiAgICBoYW5kbGVyOiAoKSA9PiBnaXQucHVsbChgb3JpZ2luYCwgYG1hc3RlcmApLlxyXG4gICAgICAgIHRoZW4oKCkgPT4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xyXG4gICAgICAgICAgICBleGVjKGBucG0gaW5zdGFsbGAsIChlcnIpID0+IHtcclxuICAgICAgICAgICAgICAgIGlmKGVycikge1xyXG4gICAgICAgICAgICAgICAgICAgIHJlamVjdChlcnIpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgcmVzb2x2ZSgpO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9KSkuXHJcbiAgICAgICAgdGhlbigoKSA9PiBjb25zb2xlLmxvZyhgUHVsbGVkIGxhdGVzdCBmcm9tIHNvdXJjZSBjb250cm9sLmApKVxyXG59KTtcclxuIiwiaW1wb3J0IGZldGNoIGZyb20gXCJub2RlLWZldGNoXCI7XHJcbmltcG9ydCBnbG9iIGZyb20gXCJnbG9iXCI7XHJcbmltcG9ydCBnZXRfY29uZmlnIGZyb20gXCIuLi9saWIvZ2V0X2NvbmZpZy5qc1wiO1xyXG5pbXBvcnQgcGF0aCBmcm9tIFwicGF0aFwiO1xyXG5cclxuLy8gVE9ETzogVGhpcyBzaG91bGQgcmVhbGx5IGJlIGV4cG9zZWQgYnkgaXNla2FpIGNvcmUgc29tZSBob3cuIExpa2UgYSB3YXkgdG8gYWRkIGluIHRvb2xzXHJcbmV4cG9ydCBkZWZhdWx0ICh7XHJcbiAgICBjb21tYW5kOiBgcHVzaGAsXHJcbiAgICBhbGlhczogWyBgcHVibGlzaGAgXSxcclxuICAgIGFzeW5jIGhhbmRsZXIoKSB7XHJcbiAgICAgICAgYXdhaXQgUHJvbWlzZS5hbGwoZ2xvYi5zeW5jKGAuL0RBRU1PTlMvKi50b21sYCkuXHJcbiAgICAgICAgICAgIG1hcCgoREFFTU9OKSA9PiB7XHJcbiAgICAgICAgICAgICAgICBjb25zdCB7IEFETUlOIH0gPSBnZXRfY29uZmlnKERBRU1PTik7XHJcbiAgICAgICAgICAgICAgICBpZihBRE1JTiAmJiBBRE1JTi56YWxnbykge1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHsgXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHVybCA9IGBodHRwOi8vbG9jYWxob3N0OjgwODBgLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB6YWxnbyBcclxuICAgICAgICAgICAgICAgICAgICB9ID0gQURNSU47XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coYFBVU0hJTkcgWyR7cGF0aC5iYXNlbmFtZShEQUVNT04sIGAudG9tbGApfV0gLSAke3VybH1gKTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZldGNoKGAke3VybH0vemFsZ29gLCB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG1ldGhvZDogYFBPU1RgLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBjYWNoZTogYG5vLWNhY2hlYCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgaGVhZGVyczoge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJDb250ZW50LVR5cGVcIjogYGFwcGxpY2F0aW9uL2pzb25gXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHphbGdvXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pXHJcbiAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xyXG4gICAgICAgICAgICB9KSk7XHJcblxyXG4gICAgfVxyXG59KTsiLCJpbXBvcnQgZ2V0X3NraWxscyBmcm9tIFwiLi4vbGliL2dldF9za2lsbHMuanNcIjtcclxuXHJcbmV4cG9ydCBkZWZhdWx0ICh7XHJcbiAgICBjb21tYW5kOiBgc2tpbGxzYCxcclxuICAgIGhlbHA6IGBMaXN0IGF2YWlsYWJsZSBza2lsbHNgLFxyXG5cclxuICAgIGhhbmRsZXI6ICgpID0+IHtcclxuICAgICAgICBjb25zdCB7XHJcbiAgICAgICAgICAgIFNIT1AsXHJcbiAgICAgICAgICAgIFNLSUxMU1xyXG4gICAgICAgIH0gPSBnZXRfc2tpbGxzKCk7XHJcblxyXG4gICAgICAgIGNvbnNvbGUubG9nKGBcclxuU0hPUFxyXG4ke09iamVjdC5rZXlzKFNIT1ApLlxyXG4gICAgICAgIG1hcCgocykgPT4gYFske3N9XWApLlxyXG4gICAgICAgIGpvaW4oYCA9IGApfVxyXG5cclxuU0tJTExTXHJcbiR7T2JqZWN0LmtleXMoU0tJTExTKS5cclxuICAgICAgICBtYXAoKHMpID0+IGBbJHtzfV1gKS5cclxuICAgICAgICBqb2luKGAgbyBgKX1cclxuYCk7XHJcbiAgICB9XHJcbn0pOyIsImltcG9ydCBwbTIgZnJvbSBcIi4uL2xpYi9wbTIuanNcIjtcclxuaW1wb3J0IGdldF9saXN0IGZyb20gXCIuLi9saWIvZ2V0X2xpc3QuanNcIjtcclxuXHJcbmV4cG9ydCBkZWZhdWx0ICh7XHJcbiAgICBjb21tYW5kOiBgc2xheSBbREFFTU9OUy4uLl1gLFxyXG4gICAgaGVscDogYHNsYXkgYWN0aXZlIFtEQUVNT05TXWAsIFxyXG4gICAgYWxpYXM6IFsgYHVuc3VtbW9uYCwgYGtpbGxgLCBgc2xheWAsIGBzdG9wYCBdLFxyXG4gICAgY2FuY2VsKCkge1xyXG4gICAgICAgIHRoaXMuY2FuY2VsZXIoKTtcclxuICAgIH0sXHJcbiAgICBcclxuICAgIGhhbmRsZXIoeyBEQUVNT05TID0gZ2V0X2xpc3QoKSB9ID0gZmFsc2UpIHtcclxuICAgICAgICBjb25zdCB3aG9tID0gREFFTU9OUy5tYXAoKGNoYXIpID0+IGBbJHtjaGFyfV1gKS5cclxuICAgICAgICAgICAgam9pbihgIC0gYCk7XHJcblxyXG4gICAgICAgIGNvbnNvbGUubG9nKGBTTEFZSU5HICR7d2hvbX1gKTtcclxuXHJcbiAgICAgICAgY29uc3QgeyBjYW5jZWwsIGRvbmUgfSA9IHBtMih7XHJcbiAgICAgICAgICAgIGNvbW1hbmRzOiBbIGBkZWxldGVgLCBgYWxsYCBdXHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIHRoaXMuY2FuY2VsZXIgPSBjYW5jZWw7XHJcblxyXG4gICAgICAgIHJldHVybiBkb25lO1xyXG4gICAgfVxyXG59KTtcclxuXHJcbiIsImltcG9ydCB3YXRjaCBmcm9tIFwiLi93YXRjaC5qc1wiO1xyXG5pbXBvcnQgc3Bhd24gZnJvbSBcIi4vc3Bhd24uanNcIjtcclxuaW1wb3J0IHBtMiBmcm9tIFwiLi4vbGliL3BtMi5qc1wiO1xyXG5cclxuaW1wb3J0IHN0b3AgZnJvbSBcIi4vc3RvcC5qc1wiO1xyXG5pbXBvcnQgcHJvbXB0X2RhZW1vbnMgZnJvbSBcIi4uL2xpYi9wcm9tcHRfZGFlbW9ucy5qc1wiO1xyXG5cclxuY29uc3QgcnVuX2RhZW1vbnMgPSAoeyBEQUVNT05TIH0pID0+IHtcclxuICAgIHdhdGNoLmhhbmRsZXIoeyBEQUVNT05TIH0pO1xyXG4gICAgc3Bhd24uaGFuZGxlcih7IERBRU1PTlMgfSk7XHJcblxyXG4gICAgcmV0dXJuIHBtMih7XHJcbiAgICAgICAgY29tbWFuZHM6IFsgYGxvZ3NgIF1cclxuICAgIH0pLmRvbmU7XHJcbn07XHJcblxyXG5leHBvcnQgZGVmYXVsdCAoe1xyXG4gICAgY29tbWFuZDogYHN1bW1vbiBbREFFTU9OUy4uLl1gLFxyXG4gICAgaGVscDogYHN1bW1vbiBhbmQgd2F0Y2ggW0RBRU1PTlMuLi5dYCxcclxuICAgIGFsaWFzOiBbIGBkZXZgLCBgc3RhcnRgLCBgcnVuYCBdLFxyXG4gICAgYXN5bmMgaGFuZGxlcih7IERBRU1PTlMgfSkge1xyXG4gICAgICAgIGNvbnN0IERBRU1PTnMgPSBhd2FpdCBwcm9tcHRfZGFlbW9ucyh7XHJcbiAgICAgICAgICAgIGNtZDogdGhpcyxcclxuICAgICAgICAgICAgREFFTU9OU1xyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICBhd2FpdCBzdG9wLmhhbmRsZXIoKTtcclxuICAgICAgICBcclxuICAgICAgICByZXR1cm4gcnVuX2RhZW1vbnMoeyBEQUVNT05TOiBEQUVNT05zIH0pO1xyXG4gICAgfSxcclxuXHJcbiAgICBjYW5jZWwoKSB7XHJcbiAgICAgICAgd2F0Y2guY2FuY2VsKCk7XHJcbiAgICB9XHJcbn0pO1xyXG5cclxuIiwiaW1wb3J0IHBtMiBmcm9tIFwiLi4vbGliL3BtMi5qc1wiO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQoe1xyXG4gICAgY29tbWFuZDogYHN0YXR1cyBbREFFTU9OXWAsXHJcbiAgICBoZWxwOiBgc3RhdHVzIG9mIGFjdGl2ZSBbREFFTU9OXXMuYCxcclxuICAgIGFsaWFzOiBbIGBwc2AsIGBhY3RpdmVgLCBgc3RhdHNgIF0sXHJcbiAgICBoYW5kbGVyOiAoKSA9PiBwbTIoe1xyXG4gICAgICAgIGNvbW1hbmRzOiBbIGBwc2AgXVxyXG4gICAgfSkuZG9uZVxyXG59KTsiLCJpbXBvcnQgeyB2ZXJzaW9uIH0gZnJvbSBcIi4uLy4uL3BhY2thZ2UuanNvblwiO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgKHtcclxuICAgIGNvbW1hbmQ6IGB2ZXJzaW9uYCxcclxuICAgIGhlbHA6IGBWZXJzaW9uIGlzICR7dmVyc2lvbn1gLFxyXG4gICAgaGFuZGxlcjogKCkgPT4ge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKHZlcnNpb24pO1xyXG4gICAgfVxyXG59KTsiLCJjb25zdCByZXMgPSB7fTtcbmltcG9ydCBmMCBmcm9tIFwiL1VzZXJzL0dhbWVzL1Byb2plY3RzL2lzZWthaS9zcmMvY29tbWFuZHMvYnVpbGQuanNcIjtcbnJlc1tcImJ1aWxkXCJdID0gZjA7XG5pbXBvcnQgZjEgZnJvbSBcIi9Vc2Vycy9HYW1lcy9Qcm9qZWN0cy9pc2VrYWkvc3JjL2NvbW1hbmRzL2NvbW1pdC5qc1wiO1xucmVzW1wiY29tbWl0XCJdID0gZjE7XG5pbXBvcnQgZjIgZnJvbSBcIi9Vc2Vycy9HYW1lcy9Qcm9qZWN0cy9pc2VrYWkvc3JjL2NvbW1hbmRzL2NyZWF0ZS5qc1wiO1xucmVzW1wiY3JlYXRlXCJdID0gZjI7XG5pbXBvcnQgZjMgZnJvbSBcIi9Vc2Vycy9HYW1lcy9Qcm9qZWN0cy9pc2VrYWkvc3JjL2NvbW1hbmRzL2RhZW1vbnMuanNcIjtcbnJlc1tcImRhZW1vbnNcIl0gPSBmMztcbmltcG9ydCBmNCBmcm9tIFwiL1VzZXJzL0dhbWVzL1Byb2plY3RzL2lzZWthaS9zcmMvY29tbWFuZHMvZGV2LmpzXCI7XG5yZXNbXCJkZXZcIl0gPSBmNDtcbmltcG9ydCBmNSBmcm9tIFwiL1VzZXJzL0dhbWVzL1Byb2plY3RzL2lzZWthaS9zcmMvY29tbWFuZHMvbG9ncy5qc1wiO1xucmVzW1wibG9nc1wiXSA9IGY1O1xuaW1wb3J0IGY2IGZyb20gXCIvVXNlcnMvR2FtZXMvUHJvamVjdHMvaXNla2FpL3NyYy9jb21tYW5kcy9wdWxsLmpzXCI7XG5yZXNbXCJwdWxsXCJdID0gZjY7XG5pbXBvcnQgZjcgZnJvbSBcIi9Vc2Vycy9HYW1lcy9Qcm9qZWN0cy9pc2VrYWkvc3JjL2NvbW1hbmRzL3B1c2guanNcIjtcbnJlc1tcInB1c2hcIl0gPSBmNztcbmltcG9ydCBmOCBmcm9tIFwiL1VzZXJzL0dhbWVzL1Byb2plY3RzL2lzZWthaS9zcmMvY29tbWFuZHMvc2tpbGxzLmpzXCI7XG5yZXNbXCJza2lsbHNcIl0gPSBmODtcbmltcG9ydCBmOSBmcm9tIFwiL1VzZXJzL0dhbWVzL1Byb2plY3RzL2lzZWthaS9zcmMvY29tbWFuZHMvc3Bhd24uanNcIjtcbnJlc1tcInNwYXduXCJdID0gZjk7XG5pbXBvcnQgZjEwIGZyb20gXCIvVXNlcnMvR2FtZXMvUHJvamVjdHMvaXNla2FpL3NyYy9jb21tYW5kcy9zdGFydC5qc1wiO1xucmVzW1wic3RhcnRcIl0gPSBmMTA7XG5pbXBvcnQgZjExIGZyb20gXCIvVXNlcnMvR2FtZXMvUHJvamVjdHMvaXNla2FpL3NyYy9jb21tYW5kcy9zdGF0dXMuanNcIjtcbnJlc1tcInN0YXR1c1wiXSA9IGYxMTtcbmltcG9ydCBmMTIgZnJvbSBcIi9Vc2Vycy9HYW1lcy9Qcm9qZWN0cy9pc2VrYWkvc3JjL2NvbW1hbmRzL3N0b3AuanNcIjtcbnJlc1tcInN0b3BcIl0gPSBmMTI7XG5pbXBvcnQgZjEzIGZyb20gXCIvVXNlcnMvR2FtZXMvUHJvamVjdHMvaXNla2FpL3NyYy9jb21tYW5kcy92ZXJzaW9uLmpzXCI7XG5yZXNbXCJ2ZXJzaW9uXCJdID0gZjEzO1xuaW1wb3J0IGYxNCBmcm9tIFwiL1VzZXJzL0dhbWVzL1Byb2plY3RzL2lzZWthaS9zcmMvY29tbWFuZHMvd2F0Y2guanNcIjtcbnJlc1tcIndhdGNoXCJdID0gZjE0O1xuZXhwb3J0IGRlZmF1bHQgcmVzOyIsImltcG9ydCBjIGZyb20gXCJjaGFsa1wiO1xyXG5cclxuY29uc3QgeyBsb2cgfSA9IGNvbnNvbGU7XHJcblxyXG5jb25zb2xlLmxvZyA9ICguLi5hcmdzKSA9PiBsb2coXHJcbiAgICAuLi5hcmdzLm1hcChcclxuICAgICAgICAoaXRlbSkgPT4gdHlwZW9mIGl0ZW0gPT09IGBzdHJpbmdgXHJcbiAgICAgICAgICAgID8gYy5ncmVlbihcclxuICAgICAgICAgICAgICAgIGl0ZW0ucmVwbGFjZSgvKFxcWy5bXlxcXVxcW10qXFxdKS91ZywgYy5ib2xkLndoaXRlKGAkMWApKVxyXG4gICAgICAgICAgICApXHJcbiAgICAgICAgICAgIDogaXRlbVxyXG4gICAgKVxyXG4pO1xyXG4iLCIjIS91c3IvYmluL2VudiBub2RlXHJcblxyXG5pbXBvcnQgdm9ycGFsIGZyb20gXCJ2b3JwYWxcIjtcclxuaW1wb3J0IGNvbW1hbmRzIGZyb20gXCIuL2NvbW1hbmRzLyouanNcIjtcclxuaW1wb3J0IHsgdmVyc2lvbiB9IGZyb20gXCIuLi9wYWNrYWdlLmpzb25cIjtcclxuXHJcbmltcG9ydCBcIi4vbGliL2Zvcm1hdC5qc1wiO1xyXG5cclxuaW1wb3J0IGNoYWxrIGZyb20gXCJjaGFsa1wiO1xyXG5cclxuY29uc3QgdiA9IHZvcnBhbCgpO1xyXG5cclxuT2JqZWN0LmVudHJpZXMoY29tbWFuZHMpLlxyXG4gICAgZm9yRWFjaCgoW1xyXG4gICAgICAgIG5hbWUsIHtcclxuICAgICAgICAgICAgaGVscCxcclxuICAgICAgICAgICAgaGFuZGxlcixcclxuICAgICAgICAgICAgYXV0b2NvbXBsZXRlLFxyXG4gICAgICAgICAgICBoaWRkZW4sXHJcbiAgICAgICAgICAgIGNvbW1hbmQsXHJcbiAgICAgICAgICAgIGFsaWFzID0gW10sXHJcbiAgICAgICAgICAgIG9wdGlvbnMgPSB7fSxcclxuICAgICAgICAgICAgY2FuY2VsID0gKCkgPT4ge31cclxuICAgICAgICB9XHJcbiAgICBdKSA9PiB7IFxyXG4gICAgICAgIGNvbnN0IGlzdCA9IHYuY29tbWFuZChjb21tYW5kIHx8IG5hbWUsIGhlbHApLlxyXG4gICAgICAgICAgICBhbGlhcyhhbGlhcykuXHJcbiAgICAgICAgICAgIGF1dG9jb21wbGV0ZShhdXRvY29tcGxldGUgfHwgW10pLlxyXG4gICAgICAgICAgICBjYW5jZWwoY2FuY2VsKS5cclxuICAgICAgICAgICAgYWN0aW9uKGhhbmRsZXIpO1xyXG5cclxuICAgICAgICBpZihoaWRkZW4pIHtcclxuICAgICAgICAgICAgaXN0LmhpZGRlbigpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgT2JqZWN0LmVudHJpZXMob3B0aW9ucykuXHJcbiAgICAgICAgICAgIGZvckVhY2goKFsgb3B0aW9uLCBvcHRpb25faGVscCBdKSA9PiB7XHJcbiAgICAgICAgICAgICAgICBpc3Qub3B0aW9uKG9wdGlvbiwgb3B0aW9uX2hlbHApO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgIH0pO1xyXG5cclxuY29uc3Qgc3RhcnR1cF9jb21tYW5kcyA9IHByb2Nlc3MuYXJndi5zbGljZSgyKTtcclxuXHJcbmlmKHN0YXJ0dXBfY29tbWFuZHMubGVuZ3RoID4gMCkge1xyXG4gICAgdi5leGVjKHN0YXJ0dXBfY29tbWFuZHMuam9pbihgIGApKTtcclxufSBlbHNlIHtcclxuXHJcbiAgICBwcm9jZXNzLnN0ZG91dC53cml0ZShgXFx4MUJjYCk7XHJcblxyXG4gICAgY29uc29sZS5sb2coY2hhbGsuZ3JlZW4oYFxyXG7ilojilojilZfilojilojilojilojilojilojilojilZfilojilojilojilojilojilojilojilZfilojilojilZcgIOKWiOKWiOKVlyDilojilojilojilojilojilZcg4paI4paI4pWXICAgICAg4paI4paI4paI4paI4paI4paI4paI4pWX4paI4paI4paI4pWXICAg4paI4paI4pWXIOKWiOKWiOKWiOKWiOKWiOKWiOKVlyDilojilojilZfilojilojilojilZcgICDilojilojilZfilojilojilojilojilojilojilojilZcgICAgXHJcbuKWiOKWiOKVkeKWiOKWiOKVlOKVkOKVkOKVkOKVkOKVneKWiOKWiOKVlOKVkOKVkOKVkOKVkOKVneKWiOKWiOKVkSDilojilojilZTilZ3ilojilojilZTilZDilZDilojilojilZfilojilojilZHiloQg4paI4paI4pWX4paE4paI4paI4pWU4pWQ4pWQ4pWQ4pWQ4pWd4paI4paI4paI4paI4pWXICDilojilojilZHilojilojilZTilZDilZDilZDilZDilZ0g4paI4paI4pWR4paI4paI4paI4paI4pWXICDilojilojilZHilojilojilZTilZDilZDilZDilZDilZ0gICAgXHJcbuKWiOKWiOKVkeKWiOKWiOKWiOKWiOKWiOKWiOKWiOKVl+KWiOKWiOKWiOKWiOKWiOKVlyAg4paI4paI4paI4paI4paI4pWU4pWdIOKWiOKWiOKWiOKWiOKWiOKWiOKWiOKVkeKWiOKWiOKVkSDilojilojilojilojilZfilojilojilojilojilojilZcgIOKWiOKWiOKVlOKWiOKWiOKVlyDilojilojilZHilojilojilZEgIOKWiOKWiOKWiOKVl+KWiOKWiOKVkeKWiOKWiOKVlOKWiOKWiOKVlyDilojilojilZHilojilojilojilojilojilZcgICAgICBcclxu4paI4paI4pWR4pWa4pWQ4pWQ4pWQ4pWQ4paI4paI4pWR4paI4paI4pWU4pWQ4pWQ4pWdICDilojilojilZTilZDilojilojilZcg4paI4paI4pWU4pWQ4pWQ4paI4paI4pWR4paI4paI4pWR4paA4pWa4paI4paI4pWU4paA4paI4paI4pWU4pWQ4pWQ4pWdICDilojilojilZHilZrilojilojilZfilojilojilZHilojilojilZEgICDilojilojilZHilojilojilZHilojilojilZHilZrilojilojilZfilojilojilZHilojilojilZTilZDilZDilZ0gICAgICBcclxu4paI4paI4pWR4paI4paI4paI4paI4paI4paI4paI4pWR4paI4paI4paI4paI4paI4paI4paI4pWX4paI4paI4pWRICDilojilojilZfilojilojilZEgIOKWiOKWiOKVkeKWiOKWiOKVkSAg4pWa4pWQ4pWdIOKWiOKWiOKWiOKWiOKWiOKWiOKWiOKVl+KWiOKWiOKVkSDilZrilojilojilojilojilZHilZrilojilojilojilojilojilojilZTilZ3ilojilojilZHilojilojilZEg4pWa4paI4paI4paI4paI4pWR4paI4paI4paI4paI4paI4paI4paI4pWXICAgIFxyXG7ilZrilZDilZ3ilZrilZDilZDilZDilZDilZDilZDilZ3ilZrilZDilZDilZDilZDilZDilZDilZ3ilZrilZDilZ0gIOKVmuKVkOKVneKVmuKVkOKVnSAg4pWa4pWQ4pWd4pWa4pWQ4pWdICAgICAg4pWa4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWd4pWa4pWQ4pWdICDilZrilZDilZDilZDilZ0g4pWa4pWQ4pWQ4pWQ4pWQ4pWQ4pWdIOKVmuKVkOKVneKVmuKVkOKVnSAg4pWa4pWQ4pWQ4pWQ4pWd4pWa4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWdICAgIFxyXG5WRVJTSU9OOiAke3ZlcnNpb259ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcclxuYCkpO1xyXG5cclxuICAgIHYuZGVsaW1pdGVyKGNoYWxrLmJvbGQuZ3JlZW4oYD5gKSkuXHJcbiAgICAgICAgc2hvdygpO1xyXG59Il0sIm5hbWVzIjpbImNyZWF0ZUZpbHRlciIsImdsb2IiLCJ0ZXJzZXIiLCJ0b21sIiwiZ2l0IiwiZXhlYyIsInBtMiIsIndhdGNoIiwic3Bhd24iLCJzdG9wIiwidmVyc2lvbiIsImNvbW1hbmRzIiwiY2hhbGsiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFTQSxNQUFNLFdBQVcsR0FBRyxDQUFDLE1BQU0sR0FBRyxPQUFPLENBQUMsR0FBRyxFQUFFLEtBQUs7SUFDNUMsTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQ3ZDLElBQUksTUFBTSxLQUFLLE1BQU0sRUFBRTtRQUNuQixPQUFPLE1BQU0sQ0FBQztLQUNqQjs7SUFFRCxPQUFPLFdBQVcsQ0FBQyxNQUFNLENBQUMsQ0FBQztDQUM5QixDQUFDOztBQUVGLE1BQU0sUUFBUSxHQUFHLFdBQVcsRUFBRSxDQUFDO0FBQy9CLE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDOztBQUVoQyxNQUFNLFdBQVcsR0FBRyxDQUFDLFFBQVEsS0FBSztJQUM5QixNQUFNLGFBQWEsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQztRQUNyQyxPQUFPLENBQUMsUUFBUSxFQUFFLFFBQVEsQ0FBQztRQUMzQixLQUFL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
