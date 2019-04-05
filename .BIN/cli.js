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
        rollupPluginTerser.terser(),
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

var version$1 = "0.0.15";

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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2xpLmpzIiwic291cmNlcyI6WyIuLi9zcmMvcm9sbHVwL3BsdWdpbi1nbG9iLmpzIiwiLi4vc3JjL3JvbGx1cC92ZXJzaW9uLmpzIiwiLi4vc3JjL3JvbGx1cC9idWlsZGVycy5qcyIsIi4uL3NyYy9saWIvZ2V0X3NraWxscy5qcyIsIi4uL3NyYy9saWIvZ2V0X2NvbmZpZy5qcyIsIi4uL3NyYy90cmFuc2Zvcm1zL3RvbWxfdG9fanMuanMiLCIuLi9zcmMvbGliL2dldF9saXN0LmpzIiwiLi4vc3JjL2xpYi9maWx0ZXJfbGlzdC5qcyIsIi4uL3NyYy9saWIvcHJvbXB0X2RhZW1vbnMuanMiLCIuLi9zcmMvY29tbWFuZHMvYnVpbGQuanMiLCIuLi9zcmMvY29tbWFuZHMvY29tbWl0LmpzIiwiLi4vc3JjL2NvbW1hbmRzL2NyZWF0ZS5qcyIsIi4uL3NyYy9jb21tYW5kcy9kYWVtb25zLmpzIiwiLi4vc3JjL2xpYi9hY3Rpb24uanMiLCIuLi9zcmMvY29tbWFuZHMvd2F0Y2guanMiLCIuLi9zcmMvY29tbWFuZHMvc3Bhd24uanMiLCIuLi9zcmMvY29tbWFuZHMvZGV2LmpzIiwiLi4vc3JjL2xpYi9wbTIuanMiLCIuLi9zcmMvY29tbWFuZHMvbG9ncy5qcyIsIi4uL3NyYy9jb21tYW5kcy9wdWxsLmpzIiwiLi4vc3JjL2NvbW1hbmRzL3B1c2guanMiLCIuLi9zcmMvY29tbWFuZHMvc2tpbGxzLmpzIiwiLi4vc3JjL2NvbW1hbmRzL3N0b3AuanMiLCIuLi9zcmMvY29tbWFuZHMvc3RhcnQuanMiLCIuLi9zcmMvY29tbWFuZHMvc3RhdHVzLmpzIiwiLi4vc3JjL2NvbW1hbmRzL3ZlcnNpb24uanMiLCIuLi84YmFiNTZiMmZiZTg1NGZkNGM5ZTgxMTQxMWM0MzNmNiIsIi4uL3NyYy9saWIvZm9ybWF0LmpzIiwiLi4vc3JjL2NsaS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJcclxuaW1wb3J0IGZzIGZyb20gXCJmc1wiO1xyXG5pbXBvcnQgb3MgZnJvbSBcIm9zXCI7XHJcbmltcG9ydCBnbG9iIGZyb20gXCJnbG9iXCI7XHJcbmltcG9ydCBwYXRoIGZyb20gXCJwYXRoXCI7XHJcbmltcG9ydCBtZDUgZnJvbSBcIm1kNVwiO1xyXG5cclxuaW1wb3J0IHsgY3JlYXRlRmlsdGVyIH0gZnJvbSBcInJvbGx1cC1wbHVnaW51dGlsc1wiO1xyXG5cclxuY29uc3QgZ2V0RlNQcmVmaXggPSAocHJlZml4ID0gcHJvY2Vzcy5jd2QoKSkgPT4ge1xyXG4gICAgY29uc3QgcGFyZW50ID0gcGF0aC5qb2luKHByZWZpeCwgYC4uYCk7XHJcbiAgICBpZiAocGFyZW50ID09PSBwcmVmaXgpIHtcclxuICAgICAgICByZXR1cm4gcHJlZml4O1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICByZXR1cm4gZ2V0RlNQcmVmaXgocGFyZW50KTtcclxufTtcclxuXHJcbmNvbnN0IGZzUHJlZml4ID0gZ2V0RlNQcmVmaXgoKTtcclxuY29uc3Qgcm9vdFBhdGggPSBwYXRoLmpvaW4oYC9gKTtcclxuXHJcbmNvbnN0IHRvVVJMU3RyaW5nID0gKGZpbGVQYXRoKSA9PiB7XHJcbiAgICBjb25zdCBwYXRoRnJhZ21lbnRzID0gcGF0aC5qb2luKGZpbGVQYXRoKS5cclxuICAgICAgICByZXBsYWNlKGZzUHJlZml4LCByb290UGF0aCkuXHJcbiAgICAgICAgc3BsaXQocGF0aC5zZXApO1xyXG4gICAgaWYgKCFwYXRoLmlzQWJzb2x1dGUoZmlsZVBhdGgpKSB7XHJcbiAgICAgICAgcGF0aEZyYWdtZW50cy51bnNoaWZ0KGAuYCk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIHJldHVybiBwYXRoRnJhZ21lbnRzLmpvaW4oYC9gKTtcclxufTtcclxuXHJcbmNvbnN0IHJlc29sdmVOYW1lID0gKGZyb20pID0+IFxyXG4gICAgZnJvbS5zcGxpdChgL2ApLlxyXG4gICAgICAgIHBvcCgpLlxyXG4gICAgICAgIHNwbGl0KGAuYCkuXHJcbiAgICAgICAgc2hpZnQoKTtcclxuXHJcbmV4cG9ydCBkZWZhdWx0ICh7IFxyXG4gICAgaW5jbHVkZSwgXHJcbiAgICBleGNsdWRlIFxyXG59ID0gZmFsc2UpID0+IHtcclxuICAgIGNvbnN0IGZpbHRlciA9IGNyZWF0ZUZpbHRlcihpbmNsdWRlLCBleGNsdWRlKTtcclxuICAgIFxyXG4gICAgcmV0dXJuIHtcclxuICAgICAgICBuYW1lOiBgcm9sbHVwLWdsb2JgLFxyXG4gICAgICAgIGxvYWQ6IChpZCkgPT4ge1xyXG4gICAgICAgICAgICBjb25zdCBzcmNGaWxlID0gcGF0aC5qb2luKG9zLnRtcGRpcigpLCBpZCk7XHJcblxyXG4gICAgICAgICAgICBsZXQgb3B0aW9ucztcclxuICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICAgIG9wdGlvbnMgPSBKU09OLnBhcnNlKGZzLnJlYWRGaWxlU3luYyhzcmNGaWxlKSk7XHJcbiAgICAgICAgICAgIH0gY2F0Y2goZXJyKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGNvbnN0IHsgaW1wb3J0ZWUsIGltcG9ydGVyIH0gPSBvcHRpb25zO1xyXG5cclxuICAgICAgICAgICAgY29uc3QgaW1wb3J0ZWVJc0Fic29sdXRlID0gcGF0aC5pc0Fic29sdXRlKGltcG9ydGVlKTtcclxuICAgICAgICAgICAgY29uc3QgY3dkID0gcGF0aC5kaXJuYW1lKGltcG9ydGVyKTtcclxuICAgICAgICAgICAgY29uc3QgZ2xvYlBhdHRlcm4gPSBpbXBvcnRlZTtcclxuXHJcbiAgICAgICAgICAgIGNvbnN0IGZpbGVzID0gZ2xvYi5zeW5jKGdsb2JQYXR0ZXJuLCB7XHJcbiAgICAgICAgICAgICAgICBjd2RcclxuICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICBsZXQgY29kZSA9IFsgYGNvbnN0IHJlcyA9IHt9O2AgXTtcclxuICAgICAgICAgICAgbGV0IGltcG9ydEFycmF5ID0gW107XHJcblxyXG4gICAgICAgICAgICBmaWxlcy5mb3JFYWNoKChmaWxlLCBpKSA9PiB7XHJcbiAgICAgICAgICAgICAgICBsZXQgZnJvbTtcclxuICAgICAgICAgICAgICAgIGlmIChpbXBvcnRlZUlzQWJzb2x1dGUpIHtcclxuICAgICAgICAgICAgICAgICAgICBmcm9tID0gdG9VUkxTdHJpbmcoZmlsZSk7XHJcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgIGZyb20gPSB0b1VSTFN0cmluZyhwYXRoLnJlc29sdmUoY3dkLCBmaWxlKSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBjb2RlLnB1c2goYGltcG9ydCBmJHtpfSBmcm9tIFwiJHtmcm9tfVwiO2ApO1xyXG4gICAgICAgICAgICAgICAgY29kZS5wdXNoKGByZXNbXCIke3Jlc29sdmVOYW1lKGZyb20pfVwiXSA9IGYke2l9O2ApO1xyXG4gICAgICAgICAgICAgICAgaW1wb3J0QXJyYXkucHVzaChmcm9tKTtcclxuICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICBjb2RlLnB1c2goYGV4cG9ydCBkZWZhdWx0IHJlcztgKTtcclxuXHJcbiAgICAgICAgICAgIGNvZGUgPSBjb2RlLmpvaW4oYFxcbmApO1xyXG4gICAgICAgIFxyXG4gICAgICAgICAgICByZXR1cm4gY29kZTtcclxuXHJcbiAgICAgICAgfSxcclxuICAgICAgICByZXNvbHZlSWQ6IChpbXBvcnRlZSwgaW1wb3J0ZXIpID0+IHtcclxuICAgICAgICAgICAgaWYgKCFmaWx0ZXIoaW1wb3J0ZWUpIHx8ICFpbXBvcnRlZS5pbmNsdWRlcyhgKmApKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGNvbnN0IGhhc2ggPSBtZDUoaW1wb3J0ZWUgKyBpbXBvcnRlcik7XHJcblxyXG4gICAgICAgICAgICBmcy53cml0ZUZpbGVTeW5jKHBhdGguam9pbihvcy50bXBkaXIoKSwgaGFzaCksIEpTT04uc3RyaW5naWZ5KHtcclxuICAgICAgICAgICAgICAgIGltcG9ydGVlLFxyXG4gICAgICAgICAgICAgICAgaW1wb3J0ZXJcclxuICAgICAgICAgICAgfSkpO1xyXG5cclxuICAgICAgICAgICAgcmV0dXJuIGhhc2g7XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxufTsiLCJpbXBvcnQgZnMgZnJvbSBcImZzXCI7XHJcblxyXG5leHBvcnQgZGVmYXVsdCAoe1xyXG4gICAgcGF0aCxcclxuICAgIHZlcnNpb25cclxufSkgPT4gXHJcbiAgICAoe1xyXG4gICAgICAgIG5hbWU6IGByb2xsdXAtd3JpdGVgLFxyXG4gICAgICAgIGJ1aWxkU3RhcnQ6ICgpID0+IHtcclxuICAgICAgICAgICAgZnMud3JpdGVGaWxlU3luYyhwYXRoLCB2ZXJzaW9uKCkpO1xyXG4gICAgICAgIH1cclxuICAgIH0pOyIsImltcG9ydCBwYXRoIGZyb20gXCJwYXRoXCI7XHJcblxyXG5pbXBvcnQgdG9tbCBmcm9tIFwicm9sbHVwLXBsdWdpbi10b21sXCI7XHJcbmltcG9ydCBzdmVsdGUgZnJvbSBcInJvbGx1cC1wbHVnaW4tc3ZlbHRlXCI7XHJcbmltcG9ydCByZXNvbHZlIGZyb20gXCJyb2xsdXAtcGx1Z2luLW5vZGUtcmVzb2x2ZVwiO1xyXG5cclxuaW1wb3J0IHJlcGxhY2UgZnJvbSBcInJvbGx1cC1wbHVnaW4tcmVwbGFjZVwiO1xyXG5cclxuaW1wb3J0IGpzb24gZnJvbSBcInJvbGx1cC1wbHVnaW4tanNvblwiO1xyXG5pbXBvcnQgbWQgZnJvbSBcInJvbGx1cC1wbHVnaW4tY29tbW9ubWFya1wiO1xyXG5pbXBvcnQgY2pzIGZyb20gXCJyb2xsdXAtcGx1Z2luLWNvbW1vbmpzXCI7XHJcblxyXG5pbXBvcnQgeyB0ZXJzZXIgfSBmcm9tIFwicm9sbHVwLXBsdWdpbi10ZXJzZXJcIjtcclxuaW1wb3J0IHV1aWQgZnJvbSBcInV1aWQvdjFcIjtcclxuXHJcbi8qXHJcbiAqIGltcG9ydCBzcHJpdGVzbWl0aCBmcm9tIFwicm9sbHVwLXBsdWdpbi1zcHJpdGVcIjtcclxuICogaW1wb3J0IHRleHR1cmVQYWNrZXIgZnJvbSBcInNwcml0ZXNtaXRoLXRleHR1cmVwYWNrZXJcIjtcclxuICovXHJcblxyXG5pbXBvcnQgZ2xvYiBmcm9tIFwiLi9wbHVnaW4tZ2xvYi5qc1wiO1xyXG5pbXBvcnQgdmVyc2lvbiBmcm9tIFwiLi92ZXJzaW9uLmpzXCI7XHJcblxyXG5jb25zdCBDT0RFX1ZFUlNJT04gPSB1dWlkKCk7XHJcbmNvbnN0IHByb2R1Y3Rpb24gPSB0cnVlO1xyXG5cclxubGV0IENMSUVOVF9WRVJTSU9OID0gdXVpZCgpO1xyXG5cclxuY29uc3QgZXh0ZXJuYWwgPSBbXHJcbiAgICBgZXhwcmVzc2AsXHJcbiAgICBgaXNla2FpYCxcclxuICAgIGBmc2AsXHJcbiAgICBgaHR0cGAsXHJcbiAgICBgaHR0cHNgXHJcbl07XHJcblxyXG5jb25zdCBub2RlID0gKHtcclxuICAgIGlucHV0LFxyXG4gICAgb3V0cHV0LFxyXG59KSA9PiAoe1xyXG4gICAgaW5wdXQsXHJcbiAgICBvdXRwdXQ6IHtcclxuICAgICAgICBzb3VyY2VtYXA6IGBpbmxpbmVgLFxyXG4gICAgICAgIGZpbGU6IG91dHB1dCxcclxuICAgICAgICBmb3JtYXQ6IGBjanNgLFxyXG4gICAgfSxcclxuICAgIGV4dGVybmFsLFxyXG4gICAgcGx1Z2luczogW1xyXG4gICAgICAgIGdsb2IoKSxcclxuICAgICAgICByZXBsYWNlKHtcclxuICAgICAgICAgICAgQ09ERV9WRVJTSU9OLFxyXG4gICAgICAgIH0pLFxyXG4gICAgICAgIG1kKCksXHJcbiAgICAgICAganNvbigpLFxyXG4gICAgICAgIHRvbWxcclxuICAgIF0sXHJcbn0pO1xyXG5cclxuLy8gVE9ETzogT2ZmZXIgdXAgc29tZSBvZiB0aGVzZSBvcHRpb25zIHRvIHRoZSBEYWVtb24gZmlsZXNcclxuY29uc3QgYnJvd3NlciA9ICh7XHJcbiAgICBpbnB1dCxcclxuICAgIG91dHB1dCxcclxuICAgIGNzczogY3NzUGF0aCA9IGAuL0RBVEEvcHVibGljLyR7cGF0aC5iYXNlbmFtZShvdXRwdXQsIGAuanNgKX0uY3NzYFxyXG59KSA9PiAoe1xyXG4gICAgaW5wdXQsXHJcbiAgICBvdXRwdXQ6IHtcclxuICAgICAgICBmaWxlOiBvdXRwdXQsXHJcbiAgICAgICAgZm9ybWF0OiBgaWlmZWAsXHJcbiAgICAgICAgZ2xvYmFsczoge1xyXG4gICAgICAgICAgICBcInBpeGkuanNcIjogYFBJWElgLFxyXG4gICAgICAgIH0sXHJcbiAgICB9LFxyXG4gICAgZXh0ZXJuYWw6IFsgYHV1aWRgLCBgdXVpZC92MWAsIGBwaXhpLmpzYCBdLFxyXG4gICAgcGx1Z2luczogW1xyXG4gICAgICAgIC8vIC8vIG1ha2UgdGhpcyBhIHJlYWN0aXZlIHBsdWdpbiB0byBcIi50aWxlbWFwLmpzb25cIlxyXG4gICAgICAgIC8vICAgICBzcHJpdGVzbWl0aCh7XHJcbiAgICAgICAgLy8gICAgICAgICBzcmM6IHtcclxuICAgICAgICAvLyAgICAgICAgICAgICBjd2Q6IFwiLi9nb2JsaW4ubGlmZS9CUk9XU0VSLlBJWEkvXHJcbiAgICAgICAgLy8gICAgICAgICAgICAgZ2xvYjogXCIqKi8qLnBuZ1wiXHJcbiAgICAgICAgLy8gICAgICAgICB9LFxyXG4gICAgICAgIC8vICAgICAgICAgdGFyZ2V0OiB7XHJcbiAgICAgICAgLy8gICAgICAgICAgICAgaW1hZ2U6IFwiLi9iaW4vcHVibGljL2ltYWdlcy9zcHJpdGUucG5nXCIsXHJcbiAgICAgICAgLy8gICAgICAgICAgICAgY3NzOiBcIi4vYmluL3B1YmxpYy9hcnQvZGVmYXVsdC5qc29uXCJcclxuICAgICAgICAvLyAgICAgICAgIH0sXHJcbiAgICAgICAgLy8gICAgICAgICBvdXRwdXQ6IHtcclxuICAgICAgICAvLyAgICAgICAgICAgICBpbWFnZTogXCIuL2Jpbi9wdWJsaWMvaW1hZ2VzL3Nwcml0ZS5wbmdcIlxyXG4gICAgICAgIC8vICAgICAgICAgfSxcclxuICAgICAgICAvLyAgICAgICAgIHNwcml0ZXNtaXRoT3B0aW9uczoge1xyXG4gICAgICAgIC8vICAgICAgICAgICAgIHBhZGRpbmc6IDBcclxuICAgICAgICAvLyAgICAgICAgIH0sXHJcbiAgICAgICAgLy8gICAgICAgICBjdXN0b21UZW1wbGF0ZTogdGV4dHVyZVBhY2tlclxyXG4gICAgICAgIC8vICAgICB9KSxcclxuICAgICAgICBnbG9iKCksXHJcbiAgICAgICAgcmVzb2x2ZSgpLFxyXG4gICAgICAgIGNqcyh7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgIH0pLFxyXG4gICAgICAgIGpzb24oKSxcclxuICAgICAgICByZXBsYWNlKHtcclxuICAgICAgICAgICAgQ09ERV9WRVJTSU9OLFxyXG4gICAgICAgICAgICBDTElFTlRfVkVSU0lPTjogKCkgPT4gQ0xJRU5UX1ZFUlNJT05cclxuICAgICAgICB9KSxcclxuICAgICAgICB0b21sLFxyXG4gICAgICAgIG1kKCksXHJcbiAgICAgICAgc3ZlbHRlKHtcclxuICAgICAgICAgICAgY3NzOiAoY3NzKSA9PiB7XHJcbiAgICAgICAgICAgICAgICBjc3Mud3JpdGUoY3NzUGF0aCk7XHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgfSksXHJcbiAgICAgICAgcHJvZHVjdGlvbiAmJiB0ZXJzZXIoKSxcclxuICAgICAgICB2ZXJzaW9uKHtcclxuICAgICAgICAgICAgcGF0aDogYC4vLkJJTi9jbGllbnQudmVyc2lvbmAsXHJcbiAgICAgICAgICAgIHZlcnNpb246ICgpID0+IENMSUVOVF9WRVJTSU9OXHJcbiAgICAgICAgfSlcclxuICAgIF1cclxufSk7XHJcblxyXG5leHBvcnQgZGVmYXVsdCB7XHJcbiAgICBub2RlLFxyXG4gICAgYnJvd3NlclxyXG59OyIsImltcG9ydCBwYXRoIGZyb20gXCJwYXRoXCI7XHJcbmltcG9ydCBnbG9iIGZyb20gXCJnbG9iXCI7XHJcblxyXG4vLyBkb24ndCByZWFsbHkgc3VwcG9ydCBvdmVycmlkZXNcclxuY29uc3QgZ2xvYl9vYmogPSAob2JqID0ge30sIGdsb2JfcGF0aCkgPT4gZ2xvYi5zeW5jKGdsb2JfcGF0aCkuXHJcbiAgICByZWR1Y2UoKG9iaiwgZXF1aXBfcGF0aCkgPT4ge1xyXG4gICAgICAgIGNvbnN0IHByb2plY3RfbmFtZSA9IHBhdGguYmFzZW5hbWUocGF0aC5yZXNvbHZlKGVxdWlwX3BhdGgsIGAuLmAsIGAuLmApKTtcclxuICAgICAgICBjb25zdCBza2lsbF9uYW1lID0gcGF0aC5iYXNlbmFtZShlcXVpcF9wYXRoKTtcclxuXHJcbiAgICAgICAgaWYob2JqW3NraWxsX25hbWVdKSB7XHJcbiAgICAgICAgLy8gcHJldmVudHMgaGlqYWNraW5nXHJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgJHtza2lsbF9uYW1lfSBmcm9tICR7cHJvamVjdF9uYW1lfSBvdmVybGFwcyAke29ialtza2lsbF9uYW1lXX1gKTtcclxuICAgICAgICB9XHJcbiAgICBcclxuICAgICAgICByZXR1cm4geyBcclxuICAgICAgICAgICAgW3NraWxsX25hbWVdOiBwYXRoLnJlbGF0aXZlKHByb2Nlc3MuY3dkKCksIHBhdGgucmVzb2x2ZShlcXVpcF9wYXRoLCBgLi5gLCBgLi5gKSksXHJcbiAgICAgICAgICAgIC4uLm9iaiBcclxuICAgICAgICB9O1xyXG4gICAgfSwgb2JqKTtcclxuXHJcbmV4cG9ydCBkZWZhdWx0ICgpID0+ICh7XHJcbiAgICBTS0lMTFM6IFtcclxuICAgICAgICBgLi9TS0lMTFMvKi9gLCBcclxuICAgICAgICBgLi9ub2RlX21vZHVsZXMvKi9TS0lMTFMvKi9gLFxyXG4gICAgICAgIGAuL25vZGVfbW9kdWxlcy9AKi8qL1NLSUxMUy8qL2BcclxuICAgIF0ucmVkdWNlKGdsb2Jfb2JqLCB7fSlcclxufSk7XHJcbiIsImltcG9ydCB0b21sIGZyb20gXCJ0b21sXCI7XHJcbmltcG9ydCBmcyBmcm9tIFwiZnNcIjtcclxuXHJcbmNvbnN0IGdldF9jb25maWcgPSAoY29uZmlnRmlsZSkgPT4ge1xyXG4gICAgLy8gdmVyaWZ5IHRvbWwgZXhpc3RzXHJcbiAgICBsZXQgcmF3O1xyXG5cclxuICAgIHRyeSB7XHJcbiAgICAgICAgcmF3ID0gZnMucmVhZEZpbGVTeW5jKGNvbmZpZ0ZpbGUsIGB1dGYtOGApO1xyXG4gICAgfSBjYXRjaCAoZXhjZXB0aW9uKSB7XHJcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBDb3VsZG4ndCByZWFkICR7Y29uZmlnRmlsZX0uIEFyZSB5b3Ugc3VyZSB0aGlzIHBhdGggaXMgY29ycmVjdD9gKTtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBjb25maWcgPSB0b21sLnBhcnNlKHJhdyk7XHJcblxyXG4gICAgLy8gaGFzIGltcGxlbWVudGVkXHJcbiAgICBpZihjb25maWcuaGFzKSB7XHJcbiAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgLi4uY29uZmlnLmhhcy5yZWR1Y2UoKG9iaiwgb3RoZXJfZmlsZSkgPT4gKHtcclxuICAgICAgICAgICAgICAgIC4uLmdldF9jb25maWcoYC4vREFFTU9OUy8ke290aGVyX2ZpbGV9LnRvbWxgKSxcclxuICAgICAgICAgICAgICAgIC4uLm9ialxyXG4gICAgICAgICAgICB9KSwge30pLCBcclxuICAgICAgICAgICAgLi4uY29uZmlnXHJcbiAgICAgICAgfTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgcmV0dXJuIGNvbmZpZztcclxufTtcclxuXHJcbmV4cG9ydCBkZWZhdWx0IGdldF9jb25maWc7XHJcbiIsImltcG9ydCBmcyBmcm9tIFwiZnNcIjtcclxuaW1wb3J0IHBhdGggZnJvbSBcInBhdGhcIjtcclxuXHJcbmltcG9ydCBjIGZyb20gXCJjaGFsa1wiO1xyXG5pbXBvcnQgYnVpbGRlcnMgZnJvbSBcIi4uL3JvbGx1cC9idWlsZGVycy5qc1wiO1xyXG5pbXBvcnQgZ2V0X3NraWxscyBmcm9tIFwiLi4vbGliL2dldF9za2lsbHMuanNcIjtcclxuaW1wb3J0IGdldF9jb25maWcgZnJvbSBcIi4uL2xpYi9nZXRfY29uZmlnLmpzXCI7XHJcblxyXG4vLyBNaXggQ29uZmlnIEZpbGUgaW4gYW5kIHJ1biB0aGVzZSBpbiBvcmRlclxyXG5leHBvcnQgZGVmYXVsdCAoY29uZmlnRmlsZSkgPT4gT2JqZWN0LnZhbHVlcyh7XHJcbiAgICBnZXRfc2tpbGxzLFxyXG5cclxuICAgIGdldF9jb25maWc6ICh7IGNvbmZpZ0ZpbGUgfSkgPT4gKHtcclxuICAgICAgICBjb25maWc6IGdldF9jb25maWcoY29uZmlnRmlsZSlcclxuICAgIH0pLFxyXG4gICAgXHJcbiAgICBzZXRfbmFtZXM6ICh7XHJcbiAgICAgICAgY29uZmlnRmlsZSxcclxuICAgIH0pID0+IHtcclxuICAgICAgICBjb25zdCBuYW1lID0gcGF0aC5iYXNlbmFtZShjb25maWdGaWxlLCBgLnRvbWxgKTtcclxuXHJcbiAgICAgICAgY29uc3QgcGFja2FnZV9wYXRoID0gcGF0aC5kaXJuYW1lKHBhdGgucmVzb2x2ZShjb25maWdGaWxlKSk7XHJcbiAgICAgICAgY29uc3QgcGFja2FnZV9uYW1lID0gcGFja2FnZV9wYXRoLlxyXG4gICAgICAgICAgICBzcGxpdChwYXRoLnNlcCkuXHJcbiAgICAgICAgICAgIHBvcCgpO1xyXG5cclxuICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICBwYWNrYWdlX3BhdGgsXHJcbiAgICAgICAgICAgIHBhY2thZ2VfbmFtZSxcclxuICAgICAgICAgICAgbmFtZSxcclxuICAgICAgICB9O1xyXG4gICAgfSxcclxuXHJcbiAgICB3cml0ZV9lbnRyeTogKHtcclxuICAgICAgICBjb25maWcsXHJcbiAgICAgICAgbmFtZSxcclxuICAgICAgICBTS0lMTFNcclxuICAgIH0pID0+IHtcclxuICAgICAgICAvLyBXUklURSBPVVQgRklMRVxyXG4gICAgICAgIGxldCBlbnRyeSA9IGBgO1xyXG4gICAgICAgIGNvbnN0IHR5cGUgPSBjb25maWcuTk9ERSBcclxuICAgICAgICAgICAgPyBgbm9kZWAgXHJcbiAgICAgICAgICAgIDogYGJyb3dzZXJgO1xyXG5cclxuICAgICAgICBjb25zdCB3cml0ZSA9IChkYXRhKSA9PiB7XHJcbiAgICAgICAgICAgIGVudHJ5ICs9IGAke2RhdGF9XFxyXFxuYDtcclxuICAgICAgICB9O1xyXG4gICAgICAgIFxyXG4gICAgICAgIHdyaXRlKGBpbXBvcnQgaXNla2FpIGZyb20gXCJpc2VrYWlcIjtgKTtcclxuICAgICAgICB3cml0ZShgaXNla2FpLlNFVCgke0pTT04uc3RyaW5naWZ5KGNvbmZpZyl9KTtgKTtcclxuICAgICAgICB3cml0ZShgYCk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgIGNvbnN0IGZhaWxzID0gW107XHJcbiAgICAgICAgY29uc3QgZXF1aXBlZCA9IE9iamVjdC5rZXlzKGNvbmZpZykuXHJcbiAgICAgICAgICAgIGZpbHRlcigoa2V5KSA9PiB7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBpc191cHBlciA9IGtleSA9PT0ga2V5LnRvVXBwZXJDYXNlKCk7XHJcbiAgICAgICAgICAgICAgICBpZighaXNfdXBwZXIpIHtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgY29uc3QgaGFzX3NraWxsID0gU0tJTExTW2tleV0gIT09IHVuZGVmaW5lZDtcclxuXHJcbiAgICAgICAgICAgICAgICBjb25zdCBpc190YXJnZXQgPSBbIGBCUk9XU0VSYCwgYE5PREVgIF0uaW5kZXhPZihrZXkpICE9PSAtMTtcclxuXHJcbiAgICAgICAgICAgICAgICBpZighaGFzX3NraWxsICYmICFpc190YXJnZXQpIHtcclxuICAgICAgICAgICAgICAgICAgICBmYWlscy5wdXNoKGtleSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGlzX3VwcGVyICYmIGhhc19za2lsbDtcclxuICAgICAgICAgICAgfSkuXHJcbiAgICAgICAgICAgIG1hcCgoa2V5KSA9PiB7XHJcbiAgICAgICAgICAgICAgICBjb25zdCB3aGVyZSA9IFNLSUxMU1trZXldID09PSBgYFxyXG4gICAgICAgICAgICAgICAgICAgID8gYC4uYFxyXG4gICAgICAgICAgICAgICAgICAgIDogYC4uLyR7U0tJTExTW2tleV0uc3BsaXQocGF0aC5zZXApLlxyXG4gICAgICAgICAgICAgICAgICAgICAgICBqb2luKGAvYCl9YDtcclxuXHJcbiAgICAgICAgICAgICAgICB3cml0ZShgaW1wb3J0ICR7a2V5fSBmcm9tIFwiJHt3aGVyZX0vU0tJTExTLyR7a2V5fS8ke3R5cGV9LmpzXCI7YCk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGtleTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgIGNvbnN0IGZhaWxlZCA9IGZhaWxzLmxlbmd0aCA+IDBcclxuICAgICAgICAgICAgPyBgRkFJTEVEIFRPIEZJTkRcXHJcXG4ke2ZhaWxzLm1hcCgoZikgPT4gYFske2Z9XWApLlxyXG4gICAgICAgICAgICAgICAgam9pbihgIHggYCl9YFxyXG4gICAgICAgICAgICA6IGBgO1xyXG5cclxuICAgICAgICBjb25zdCBrZXlzID0gZXF1aXBlZC5yZWR1Y2UoKG91dHB1dCwga2V5KSA9PiBgJHtvdXRwdXR9ICAgICR7a2V5fSxcXHJcXG5gLCBgYCk7XHJcblxyXG4gICAgICAgIHdyaXRlKGBcclxuaXNla2FpLkVRVUlQKHtcXHJcXG4ke2tleXN9fSk7YCk7XHJcblxyXG4gICAgICAgIGNvbnN0IEJJTiA9IGAuQklOYDtcclxuICAgICAgICBjb25zdCBpbnB1dCA9IHBhdGguam9pbihCSU4sIGAke25hbWV9LmVudHJ5LmpzYCk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgIGlmICghZnMuZXhpc3RzU3luYyhCSU4pKSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGBDUkVBVElORyAke0JJTn1gKTtcclxuICAgICAgICAgICAgZnMubWtkaXJTeW5jKEJJTik7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIC8vIHdyaXRlIG91dCB0aGVpciBpbmRleC5qc1xyXG4gICAgICAgIGZzLndyaXRlRmlsZVN5bmMoaW5wdXQsIGVudHJ5LCBgdXRmLThgKTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgY29uc29sZS5sb2coYFxyXG5bJHtuYW1lfV1bJHt0eXBlfV1cclxuXHJcblNLSUxMU1xyXG4ke2MuYmx1ZUJyaWdodChlcXVpcGVkLm1hcCgoZSkgPT4gYFske2V9XWApLlxyXG4gICAgICAgIGpvaW4oYCArIGApKX1cclxuXHJcbiR7Yy5yZWQoZmFpbGVkKX1cclxuYCk7XHJcblxyXG4gICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgIGlucHV0XHJcbiAgICAgICAgfTtcclxuICAgIH0sXHJcblxyXG4gICAgcnVuX2J1aWxkZXJzOiAoe1xyXG4gICAgICAgIGlucHV0LFxyXG4gICAgICAgIG5hbWUsXHJcbiAgICAgICAgY29uZmlnLFxyXG4gICAgfSkgPT4ge1xyXG4gICAgICAgIGlmKGNvbmZpZy5OT0RFICYmIGNvbmZpZy5CUk9XU0VSKSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgWW91IGNhbm5vdCB0YXJnZXQgYm90aCBbTk9ERV0gYW5kIFtCUk9XU0VSXWApO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYoY29uZmlnLk5PREUpIHtcclxuICAgICAgICAgICAgY29uc3Qgb3V0cHV0ID0gYC5CSU4vJHtuYW1lfS5qc2A7ICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICAgICAgb3V0cHV0LFxyXG4gICAgICAgICAgICAgICAgYnVpbGRfaW5mbzogYnVpbGRlcnMubm9kZSh7XHJcbiAgICAgICAgICAgICAgICAgICAgaW5wdXQsXHJcbiAgICAgICAgICAgICAgICAgICAgb3V0cHV0XHJcbiAgICAgICAgICAgICAgICB9KVxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICBpZihjb25maWcuQlJPV1NFUikge1xyXG4gICAgICAgICAgICBjb25zdCBvdXRwdXQgPSBgREFUQS9wdWJsaWMvJHtuYW1lfS5qc2A7XHJcblxyXG4gICAgICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICAgICAgb3V0cHV0LFxyXG4gICAgICAgICAgICAgICAgYnVpbGRfaW5mbzogYnVpbGRlcnMuYnJvd3Nlcih7XHJcbiAgICAgICAgICAgICAgICAgICAgaW5wdXQsXHJcbiAgICAgICAgICAgICAgICAgICAgb3V0cHV0XHJcbiAgICAgICAgICAgICAgICB9KVxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBZb3UgbXVzdCBzcGVjaWZ5IGVpdGhlciBbTk9ERV0gb3IgW0JST1dTRVJdIGZvciB5b3VyIHRhcmdldCBpbiB5b3VyIFtEQUVNT05dIHRvbWxgKTtcclxuICAgIH1cclxufSkuXHJcbiAgICByZWR1Y2UoKHN0YXRlLCBmbikgPT4gKHtcclxuICAgICAgICAuLi5zdGF0ZSxcclxuICAgICAgICAuLi5mbihzdGF0ZSlcclxuICAgIH0pLCB7IGNvbmZpZ0ZpbGUgfSk7XHJcbiIsImltcG9ydCBnbG9iIGZyb20gXCJnbG9iXCI7XHJcbmltcG9ydCBwYXRoIGZyb20gXCJwYXRoXCI7XHJcbmltcG9ydCBnZXRfY29uZmlnIGZyb20gXCIuL2dldF9jb25maWcuanNcIjtcclxuXHJcbmV4cG9ydCBkZWZhdWx0IChleGNsdWRlID0gZmFsc2UpID0+IHtcclxuICAgIGlmKCFleGNsdWRlKSB7XHJcbiAgICAgICAgcmV0dXJuIGdsb2Iuc3luYyhgLi9EQUVNT05TLyoudG9tbGApLlxyXG4gICAgICAgICAgICBtYXAoKGNsYXNzX3BhdGgpID0+IHBhdGguYmFzZW5hbWUoY2xhc3NfcGF0aCwgYC50b21sYCkpO1xyXG4gICAgfVxyXG5cclxuXHJcbiAgICByZXR1cm4gZ2xvYi5zeW5jKGAuL0RBRU1PTlMvKi50b21sYCkuXHJcbiAgICAgICAgZmlsdGVyKChkYWVtb24pID0+IGdldF9jb25maWcoZGFlbW9uKS5OT0RFKS5cclxuICAgICAgICBtYXAoKGNsYXNzX3BhdGgpID0+IHBhdGguYmFzZW5hbWUoY2xhc3NfcGF0aCwgYC50b21sYCkpO1xyXG59OyIsImltcG9ydCBnZXRfbGlzdCBmcm9tIFwiLi9nZXRfbGlzdC5qc1wiO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgKGNsYXNzZXMpID0+IGNsYXNzZXMuZmlsdGVyKCh0YXJnZXQpID0+IHtcclxuICAgIGNvbnN0IGlzX29rYXkgPSBnZXRfbGlzdCgpLlxyXG4gICAgICAgIGluZGV4T2YodGFyZ2V0KSAhPT0gLTE7XHJcblxyXG4gICAgaWYoIWlzX29rYXkpIHtcclxuICAgICAgICBjb25zb2xlLmxvZyhgJHt0YXJnZXR9IGlzIG5vdCBhbiBhdmFpbGFibGUgW0RBRU1PTl1gKTtcclxuICAgIH1cclxuICAgICAgICBcclxuICAgIHJldHVybiBpc19va2F5O1xyXG59KTtcclxuIiwiaW1wb3J0IGdldF9saXN0IGZyb20gXCIuL2dldF9saXN0LmpzXCI7XHJcbmltcG9ydCBmaWx0ZXJfbGlzdCBmcm9tIFwiLi9maWx0ZXJfbGlzdC5qc1wiO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgKHtcclxuICAgIGNtZCxcclxuICAgIERBRU1PTlNcclxufSkgPT4ge1xyXG4gICAgaWYoIURBRU1PTlMpIHtcclxuICAgICAgICByZXR1cm4gY21kLnByb21wdCh7XHJcbiAgICAgICAgICAgIHR5cGU6IGBsaXN0YCxcclxuICAgICAgICAgICAgbmFtZTogYERBRU1PTmAsXHJcbiAgICAgICAgICAgIG1lc3NhZ2U6IGBXaGljaCBbREFFTU9OXT9gLFxyXG4gICAgICAgICAgICBjaG9pY2VzOiBbIGBhbGxgLCAuLi5nZXRfbGlzdCgpIF1cclxuICAgICAgICB9KS5cclxuICAgICAgICAgICAgdGhlbigoeyBEQUVNT04gfSkgPT4gREFFTU9OID09PSBgYWxsYCBcclxuICAgICAgICAgICAgICAgID8gZ2V0X2xpc3QoKSBcclxuICAgICAgICAgICAgICAgIDogZmlsdGVyX2xpc3QoWyBEQUVNT04gXSkpO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICBpZihEQUVNT05TWzBdID09PSBgYWxsYCkge1xyXG4gICAgICAgIHJldHVybiBnZXRfbGlzdCgpO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiBmaWx0ZXJfbGlzdChEQUVNT05TKTtcclxufTsiLCJpbXBvcnQgdG9tbF90b19qcyBmcm9tIFwiLi4vdHJhbnNmb3Jtcy90b21sX3RvX2pzLmpzXCI7XHJcbmltcG9ydCByb2xsdXAgZnJvbSBcInJvbGx1cFwiO1xyXG5cclxuaW1wb3J0IHByb21wdF9kYWVtb25zIGZyb20gXCIuLi9saWIvcHJvbXB0X2RhZW1vbnMuanNcIjtcclxuXHJcbmV4cG9ydCBkZWZhdWx0ICh7XHJcbiAgICBjb21tYW5kOiBgYnVpbGQgW0RBRU1PTlMuLi5dYCxcclxuICAgIGhlbHA6IGBidWlsZCBhbGwgW0RBRU1PTl0gc2F2ZShzKS5gLFxyXG4gICAgaGlkZGVuOiB0cnVlLFxyXG4gICAgYXN5bmMgaGFuZGxlcih7IERBRU1PTlMgfSkge1xyXG4gICAgICAgIGNvbnN0IERBRU1PTnMgPSBhd2FpdCBwcm9tcHRfZGFlbW9ucyh7IFxyXG4gICAgICAgICAgICBjbWQ6IHRoaXMsXHJcbiAgICAgICAgICAgIERBRU1PTlMgXHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIGNvbnN0IGJ1aWx0ID0gYXdhaXQgUHJvbWlzZS5hbGwoREFFTU9Ocy5tYXAoYXN5bmMgKHRhcmdldCkgPT4ge1xyXG4gICAgICAgICAgICBjb25zdCB7IGJ1aWxkX2luZm8sIG5hbWUgfSA9IGF3YWl0IHRvbWxfdG9fanMoYC4vREFFTU9OUy8ke3RhcmdldH0udG9tbGApO1xyXG4gICAgICAgICAgICBjb25zdCBidW5kbGUgPSBhd2FpdCByb2xsdXAucm9sbHVwKGJ1aWxkX2luZm8pO1xyXG5cclxuICAgICAgICAgICAgYXdhaXQgYnVuZGxlLndyaXRlKGJ1aWxkX2luZm8ub3V0cHV0KTtcclxuICAgICAgICAgICAgY29uc29sZS5sb2coYFske25hbWV9XSBCdWlsZCBDb21wbGV0ZS5cXHJcXG5gKTtcclxuICAgICAgICB9KSk7XHJcblxyXG4gICAgICAgIGNvbnNvbGUubG9nKGBCdWlsdCAke2J1aWx0Lmxlbmd0aH0gW0RBRU1PTl0ocykuYCk7XHJcbiAgICB9XHJcbn0pOyIsImltcG9ydCBHaXQgZnJvbSBcInNpbXBsZS1naXQvcHJvbWlzZVwiO1xyXG5cclxuY29uc3QgZ2l0ID0gR2l0KCk7XHJcblxyXG5leHBvcnQgZGVmYXVsdCAoe1xyXG4gICAgY29tbWFuZDogYGNvbW1pdCBbbWVzc2FnZS4uLl1gLFxyXG4gICAgaGVscDogYGNvbW1pdCBjdXJyZW50IGZpbGVzIHRvIHNvdXJjZSBjb250cm9sYCxcclxuICAgIGhhbmRsZXI6ICh7XHJcbiAgICAgICAgbWVzc2FnZSA9IFsgYFVwZGF0ZSwgbm8gY29tbWl0IG1lc3NhZ2VgIF1cclxuICAgIH0pID0+IGdpdC5hZGQoWyBgLmAgXSkuXHJcbiAgICAgICAgdGhlbigoKSA9PiBnaXQuc3RhdHVzKCkpLlxyXG4gICAgICAgIHRoZW4oKCkgPT4gZ2l0LmNvbW1pdChtZXNzYWdlLmpvaW4oYCBgKSkpLlxyXG4gICAgICAgIHRoZW4oKCkgPT4gZ2l0LnB1c2goYG9yaWdpbmAsIGBtYXN0ZXJgKSkuXHJcbiAgICAgICAgdGhlbigoKSA9PiBjb25zb2xlLmxvZyhgQ29tbWl0ZWQgd2l0aCBtZXNzYWdlICR7bWVzc2FnZS5qb2luKGAgYCl9YCkpXHJcbn0pO1xyXG4iLCJpbXBvcnQgZGVnaXQgZnJvbSBcImRlZ2l0XCI7XHJcbmltcG9ydCB7IGV4ZWMgfSBmcm9tIFwiY2hpbGRfcHJvY2Vzc1wiO1xyXG5pbXBvcnQgR2l0IGZyb20gXCJzaW1wbGUtZ2l0L3Byb21pc2VcIjtcclxuXHJcbmNvbnN0IGdpdCA9IEdpdCgpO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgKHtcclxuICAgIGNvbW1hbmQ6IGBjcmVhdGUgW3RlbXBsYXRlXSBbbmFtZV1gLFxyXG4gICAgaGVscDogYENyZWF0ZSBhIG5ldyBpc2VrYWkgcHJvamVjdCBmcm9tIFt0ZW1wbGF0ZV0gb3IgQGlzZWthaS90ZW1wbGF0ZWAsXHJcbiAgICBhbGlhczogWyBgaW5pdGAgXSxcclxuICAgIG9wdGlvbnM6IHtcclxuICAgICAgICBcIi1mLCAtLWZvcmNlXCI6IGBmb3JjZSBvdmVyd3JpdGUgZnJvbSB0ZW1wbGF0ZWBcclxuICAgIH0sXHJcbiAgICBoYW5kbGVyOiAoe1xyXG4gICAgICAgIHRlbXBsYXRlID0gYGlzZWthaS1kZXYvdGVtcGxhdGVgLFxyXG4gICAgICAgIG5hbWUgPSBgLmAsXHJcbiAgICAgICAgb3B0aW9uczoge1xyXG4gICAgICAgICAgICBmb3JjZSA9IGZhbHNlXHJcbiAgICAgICAgfSA9IGZhbHNlXHJcbiAgICB9KSA9PiBkZWdpdCh0ZW1wbGF0ZSwgeyBmb3JjZSB9KS5cclxuICAgICAgICBjbG9uZShuYW1lKS5cclxuICAgICAgICB0aGVuKCgpID0+IGdpdC5pbml0KCkpLlxyXG4gICAgICAgIHRoZW4oKCkgPT4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xyXG4gICAgICAgICAgICBjb25zb2xlLmxvZyhgJHt0ZW1wbGF0ZX0gY29waWVkIHRvICR7bmFtZX1gKTtcclxuICAgICAgICAgICAgY29uc29sZS5sb2coYElOU1RBTExJTkc6IFRISVMgTUFZIFRBS0UgQVdISUxFYCk7XHJcbiAgICAgICAgICAgIGV4ZWMoYG5wbSBpbnN0YWxsYCwgKGVycikgPT4ge1xyXG4gICAgICAgICAgICAgICAgaWYoZXJyKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmVqZWN0KGVycik7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICByZXNvbHZlKCk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0pKS5cclxuICAgICAgICB0aGVuKCgpID0+IHtcclxuICAgICAgICAgICAgY29uc29sZS5sb2coYENPTVBMRVRFOiBbcnVuXSB0byBzdGFydCB5b3VyIERBRU1PTnMuYCk7XHJcbiAgICAgICAgfSlcclxufSk7IiwiaW1wb3J0IGdldF9saXN0IGZyb20gXCIuLi9saWIvZ2V0X2xpc3QuanNcIjtcclxuXHJcbmV4cG9ydCBkZWZhdWx0ICh7XHJcbiAgICBoZWxwOiBgU2hvdyBhdmFpbGFibGUgW0RBRU1PTl0gc2F2ZXMuYCxcclxuICAgIGFsaWFzOiBbIGBsc2AsIGBzYXZlc2AgXSxcclxuICAgIGhhbmRsZXI6IChhcmdzLCBjYikgPT4ge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKGdldF9saXN0KCkuXHJcbiAgICAgICAgICAgIG1hcCgoaSkgPT4gYFske2l9XWApLlxyXG4gICAgICAgICAgICBqb2luKGAgLSBgKSwgYFxcclxcbmApOyAgICBcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgY2IoKTtcclxuICAgIH1cclxufSk7IiwiZXhwb3J0IGRlZmF1bHQgKFxyXG4gICAgYWN0aW9uX21hcCwgXHJcbiAgICByZWR1Y2VyID0gKGkpID0+IGlcclxuKSA9PiAoaW5wdXQpID0+IHtcclxuICAgIGNvbnN0IGtleSA9IHJlZHVjZXIoaW5wdXQpO1xyXG5cclxuICAgIGlmKCFhY3Rpb25fbWFwW2tleV0pIHtcclxuICAgICAgICByZXR1cm47XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIGFjdGlvbl9tYXBba2V5XShpbnB1dCk7XHJcbn07IiwiaW1wb3J0IGNob2tpZGFyIGZyb20gXCJjaG9raWRhclwiO1xyXG5pbXBvcnQgcm9sbHVwIGZyb20gXCJyb2xsdXBcIjtcclxuaW1wb3J0IGMgZnJvbSBcImNoYWxrXCI7XHJcblxyXG5pbXBvcnQgdG9tbF90b19qcyBmcm9tIFwiLi4vdHJhbnNmb3Jtcy90b21sX3RvX2pzLmpzXCI7XHJcblxyXG5pbXBvcnQgYWN0aW9uIGZyb20gXCIuLi9saWIvYWN0aW9uLmpzXCI7XHJcbmltcG9ydCBwcm9tcHRfZGFlbW9ucyBmcm9tIFwiLi4vbGliL3Byb21wdF9kYWVtb25zLmpzXCI7XHJcblxyXG5leHBvcnQgZGVmYXVsdCAoe1xyXG4gICAgY29tbWFuZDogYGxvYWQgW0RBRU1PTlMuLi5dYCxcclxuICAgIGhlbHA6IGBsb2FkIFtEQUVNT05dIHNhdmVzYCxcclxuICAgIGFsaWFzOiBbIGByZWdlbmVyYXRlYCwgYHJlY3JlYXRlYCwgYHdhdGNoYCBdLFxyXG4gICAgaGlkZGVuOiB0cnVlLFxyXG4gICAgY2FuY2VsICgpIHtcclxuICAgICAgICB0aGlzLndhdGNoZXJzLmZvckVhY2goKHdhdGNoZXIpID0+IHdhdGNoZXIuY2xvc2UoKSk7XHJcbiAgICAgICAgY29uc29sZS5sb2coYFlPVVIgV0FUQ0ggSEFTIEVOREVEYCk7XHJcbiAgICB9LFxyXG4gICAgYXN5bmMgaGFuZGxlcih7IERBRU1PTlMgfSkge1xyXG4gICAgICAgIHRoaXMud2F0Y2hlcnMgPSBbXTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgY29uc3QgREFFTU9OcyA9IGF3YWl0IHByb21wdF9kYWVtb25zKHtcclxuICAgICAgICAgICAgY21kOiB0aGlzLFxyXG4gICAgICAgICAgICBEQUVNT05TXHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgREFFTU9Ocy5mb3JFYWNoKCh0YXJnZXQpID0+IHtcclxuICAgICAgICAgICAgY29uc3QgZmlsZV9wYXRoID0gYC4vREFFTU9OUy8ke3RhcmdldH0udG9tbGA7XHJcblxyXG4gICAgICAgICAgICBjb25zdCBkYXRhID0gdG9tbF90b19qcyhmaWxlX3BhdGgpO1xyXG5cclxuICAgICAgICAgICAgY29uc3QgeyBidWlsZF9pbmZvIH0gPSBkYXRhO1xyXG4gICAgICAgIFxyXG4gICAgICAgICAgICAvLyByZWJ1aWxkIG9uIGZpbGUgY2hhZ25lXHJcbiAgICAgICAgICAgIGNvbnN0IHdhdGNoZXIgPSBjaG9raWRhci53YXRjaChmaWxlX3BhdGgpO1xyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHdhdGNoZXIub24oYGNoYW5nZWAsICgpID0+IHtcclxuICAgICAgICAgICAgICAgIHRvbWxfdG9fanMoZmlsZV9wYXRoKTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgdGhpcy53YXRjaGVycy5wdXNoKHdhdGNoZXIpO1xyXG5cclxuICAgICAgICAgICAgY29uc3Qgcm9sbHVwX3dhdGNoZXIgPSByb2xsdXAud2F0Y2goe1xyXG4gICAgICAgICAgICAgICAgLi4uYnVpbGRfaW5mbyxcclxuICAgICAgICAgICAgICAgIHdhdGNoOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgY2xlYXJTY3JlZW46IHRydWVcclxuICAgICAgICAgICAgICAgIH0gICBcclxuICAgICAgICAgICAgfSkuXHJcbiAgICAgICAgICAgICAgICBvbihgZXZlbnRgLCBhY3Rpb24oe1xyXG4gICAgICAgICAgICAgICAgICAgIEJVTkRMRV9FTkQ6ICgpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coYFske3RhcmdldH1dW1dBVENIXSBCdWlsdC5gKTtcclxuICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgIEVSUk9SOiAoZSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhlKTtcclxuICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgIEZBVEFMOiAoeyBlcnJvciB9KSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoYy5yZWQuYm9sZChlcnJvcikpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH0sICh7IGNvZGUgfSkgPT4gY29kZSBcclxuICAgICAgICAgICAgICAgICkpO1xyXG5cclxuICAgICAgICAgICAgdGhpcy53YXRjaGVycy5wdXNoKHJvbGx1cF93YXRjaGVyKTtcclxuICAgICAgICB9KTtcclxuICAgIH1cclxufSk7XHJcbiIsImltcG9ydCBwbTIgZnJvbSBcInBtMlwiO1xyXG5cclxuaW1wb3J0IHRvbWxfdG9fanMgZnJvbSBcIi4uL3RyYW5zZm9ybXMvdG9tbF90b19qcy5qc1wiO1xyXG5cclxuaW1wb3J0IHByb21wdF9kYWVtb25zIGZyb20gXCIuLi9saWIvcHJvbXB0X2RhZW1vbnMuanNcIjtcclxuXHJcbmV4cG9ydCBkZWZhdWx0ICh7XHJcbiAgICBjb21tYW5kZXI6IGBzcGF3biBbREFFTU9OUy4uLl1gLFxyXG4gICAgaGVscDogYHNwYXduIFtEQUVNT05TXSBmaWxlc2AsXHJcbiAgICBoaWRkZW46IHRydWUsXHJcbiAgICBhc3luYyBoYW5kbGVyKHsgREFFTU9OUyB9KSB7XHJcbiAgICAgICAgY29uc3QgZGFlbW9ucyA9IGF3YWl0IHByb21wdF9kYWVtb25zKHtcclxuICAgICAgICAgICAgY21kOiB0aGlzLFxyXG4gICAgICAgICAgICBEQUVNT05TXHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIGRhZW1vbnMuZm9yRWFjaCgoREFFTU9OKSA9PiB7XHJcbiAgICAgICAgICAgIGNvbnN0IHtcclxuICAgICAgICAgICAgICAgIG91dHB1dCxcclxuICAgICAgICAgICAgICAgIGNvbmZpZzoge1xyXG4gICAgICAgICAgICAgICAgICAgIE5PREVcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSA9IHRvbWxfdG9fanMoYC4vREFFTU9OUy8ke0RBRU1PTn0udG9tbGApO1xyXG5cclxuICAgICAgICAgICAgaWYoIU5PREUpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgLy8gSEFDSzogY291bGQgbmFtZSB0aGUgZmlsZSBvZiB0aGUgVE9NTCBzb21ldGhpbmcgZ25hcmx5XHJcbiAgICAgICAgICAgIHBtMi5zdGFydCh7XHJcbiAgICAgICAgICAgICAgICBuYW1lOiBEQUVNT04sXHJcbiAgICAgICAgICAgICAgICBzY3JpcHQ6IG91dHB1dCxcclxuICAgICAgICAgICAgICAgIHdhdGNoOiBgLi8ke291dHB1dH1gLFxyXG4gICAgICAgICAgICAgICAgZm9yY2U6IHRydWUsXHJcbiAgICAgICAgICAgICAgICB3YXRjaF9vcHRpb25zOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgLy8geXVwIFBNMiB3YXMgc2V0dGluZyBhIGRlZmF1bHQgaWdub3JlXHJcbiAgICAgICAgICAgICAgICAgICAgaWdub3JlZDogYGAsXHJcbiAgICAgICAgICAgICAgICAgICAgdXNlUG9sbGluZzogdHJ1ZVxyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIG1heF9yZXN0YXJ0OiAwXHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICBjb25zb2xlLmxvZyhgU3Bhd25lZCAke2RhZW1vbnMuam9pbihgIC0gYCl9YCk7XHJcbiAgICB9XHJcbn0pO1xyXG4iLCJpbXBvcnQgd2F0Y2ggZnJvbSBcIi4vd2F0Y2guanNcIjtcclxuaW1wb3J0IHNwYXduIGZyb20gXCIuL3NwYXduLmpzXCI7XHJcblxyXG5leHBvcnQgZGVmYXVsdCAoe1xyXG4gICAgY29tbWFuZHM6IGBkZXZgLFxyXG4gICAgaGVscDogYHJ1biBhbmQgd2F0Y2ggZXZlcnl0aGluZ2AsXHJcbiAgICBoYW5kbGVyczogYXN5bmMgKCkgPT4ge1xyXG4gICAgICAgIGF3YWl0IHdhdGNoLmhhbmRsZXIoeyBEQUVNT05TOiBgYWxsYCB9KTtcclxuICAgICAgICBhd2FpdCBzcGF3bi5oYW5kbGVyKHsgREFFTU9OUzogYGFsbGAgfSk7XHJcbiAgICB9XHJcbn0pO1xyXG4iLCIvLyBwaXBlIG91dCB0byBwbTJcclxuaW1wb3J0IHsgc3Bhd24gfSBmcm9tIFwiY2hpbGRfcHJvY2Vzc1wiO1xyXG5pbXBvcnQgcGF0aCBmcm9tIFwicGF0aFwiO1xyXG5cclxuY29uc3QgcG0yX3BhdGggPSBwYXRoLmRpcm5hbWUocmVxdWlyZS5yZXNvbHZlKGBwbTJgKSk7XHJcblxyXG5leHBvcnQgZGVmYXVsdCAoeyBjb21tYW5kcyB9KSA9PiB7XHJcbiAgICBsZXQgbm9kZSA9IHNwYXduKGBub2RlYCwgYCR7cG0yX3BhdGh9L2Jpbi9wbTIgJHtjb21tYW5kcy5qb2luKGAgYCl9YC5zcGxpdChgIGApLCB7XHJcbiAgICAgICAgY3dkOiBwcm9jZXNzLmN3ZCgpLFxyXG4gICAgICAgIGVudjogcHJvY2Vzcy5lbnYsXHJcbiAgICAgICAgc3RkaW86IGBpbmhlcml0YFxyXG4gICAgfSk7XHJcblxyXG4gICAgcmV0dXJuIHtcclxuICAgICAgICBkb25lOiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xyXG4gICAgICAgICAgICBub2RlLm9uKGBjbG9zZWAsICgpID0+IHtcclxuICAgICAgICAgICAgICAgIHJlc29sdmUoKTtcclxuICAgICAgICAgICAgICAgIG5vZGUgPSBmYWxzZTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfSksXHJcblxyXG4gICAgICAgIGNhbmNlbDogKCkgPT4ge1xyXG4gICAgICAgICAgICBpZighbm9kZSkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICB9XHJcbiAgICBcclxuICAgICAgICAgICAgbm9kZS5raWxsKCk7XHJcbiAgICAgICAgfSAgIFxyXG4gICAgfTtcclxufTtcclxuIiwiaW1wb3J0IHBtMiBmcm9tIFwiLi4vbGliL3BtMi5qc1wiO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgKHtcclxuICAgIGNvbW1hbmQ6IGBsb2dzIFtEQUVNT05TLi4uXWAsXHJcbiAgICBoZWxwOiBgZm9sbG93IHRoZSBhY3RpdmUgW0RBRU1PTl0gbG9nc2AsXHJcbiAgICBoYW5kbGVyOiAoeyBEQUVNT05TID0gW10gfSkgPT4gcG0yKHtcclxuICAgICAgICBjb21tYW5kczogWyBgbG9nc2AsIC4uLkRBRU1PTlMgXVxyXG4gICAgfSkuZG9uZVxyXG4gICAgXHJcbn0pOyIsImltcG9ydCBHaXQgZnJvbSBcInNpbXBsZS1naXQvcHJvbWlzZVwiO1xyXG5pbXBvcnQgeyBleGVjIH0gZnJvbSBcImNoaWxkX3Byb2Nlc3NcIjtcclxuXHJcbmNvbnN0IGdpdCA9IEdpdCgpO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgKHtcclxuICAgIGNvbW1hbmQ6IGBwdWxsYCxcclxuICAgIGhlbHA6IGBnZXQgY3VycmVudCBmaWxlcyBmcm9tIHNvdXJjZSBjb250cm9sYCxcclxuICAgIGhhbmRsZXI6ICgpID0+IGdpdC5wdWxsKGBvcmlnaW5gLCBgbWFzdGVyYCkuXHJcbiAgICAgICAgdGhlbigoKSA9PiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XHJcbiAgICAgICAgICAgIGV4ZWMoYG5wbSBpbnN0YWxsYCwgKGVycikgPT4ge1xyXG4gICAgICAgICAgICAgICAgaWYoZXJyKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmVqZWN0KGVycik7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICByZXNvbHZlKCk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0pKS5cclxuICAgICAgICB0aGVuKCgpID0+IGNvbnNvbGUubG9nKGBQdWxsZWQgbGF0ZXN0IGZyb20gc291cmNlIGNvbnRyb2wuYCkpXHJcbn0pO1xyXG4iLCJpbXBvcnQgZmV0Y2ggZnJvbSBcIm5vZGUtZmV0Y2hcIjtcclxuaW1wb3J0IGdsb2IgZnJvbSBcImdsb2JcIjtcclxuaW1wb3J0IGdldF9jb25maWcgZnJvbSBcIi4uL2xpYi9nZXRfY29uZmlnLmpzXCI7XHJcbmltcG9ydCBwYXRoIGZyb20gXCJwYXRoXCI7XHJcblxyXG4vLyBUT0RPOiBUaGlzIHNob3VsZCByZWFsbHkgYmUgZXhwb3NlZCBieSBpc2VrYWkgY29yZSBzb21lIGhvdy4gTGlrZSBhIHdheSB0byBhZGQgaW4gdG9vbHNcclxuZXhwb3J0IGRlZmF1bHQgKHtcclxuICAgIGNvbW1hbmQ6IGBwdXNoYCxcclxuICAgIGFsaWFzOiBbIGBwdWJsaXNoYCBdLFxyXG4gICAgYXN5bmMgaGFuZGxlcigpIHtcclxuICAgICAgICBhd2FpdCBQcm9taXNlLmFsbChnbG9iLnN5bmMoYC4vREFFTU9OUy8qLnRvbWxgKS5cclxuICAgICAgICAgICAgbWFwKChEQUVNT04pID0+IHtcclxuICAgICAgICAgICAgICAgIGNvbnN0IHsgQURNSU4gfSA9IGdldF9jb25maWcoREFFTU9OKTtcclxuICAgICAgICAgICAgICAgIGlmKEFETUlOICYmIEFETUlOLnphbGdvKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgeyBcclxuICAgICAgICAgICAgICAgICAgICAgICAgdXJsID0gYGh0dHA6Ly9sb2NhbGhvc3Q6ODA4MGAsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHphbGdvIFxyXG4gICAgICAgICAgICAgICAgICAgIH0gPSBBRE1JTjtcclxuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgUFVTSElORyBbJHtwYXRoLmJhc2VuYW1lKERBRU1PTiwgYC50b21sYCl9XSAtICR7dXJsfWApO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmV0Y2goYCR7dXJsfS96YWxnb2AsIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgbWV0aG9kOiBgUE9TVGAsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhY2hlOiBgbm8tY2FjaGVgLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBoZWFkZXJzOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBcIkNvbnRlbnQtVHlwZVwiOiBgYXBwbGljYXRpb24vanNvbmBcclxuICAgICAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoe1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgemFsZ29cclxuICAgICAgICAgICAgICAgICAgICAgICAgfSlcclxuICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XHJcbiAgICAgICAgICAgIH0pKTtcclxuXHJcbiAgICB9XHJcbn0pOyIsImltcG9ydCBnZXRfc2tpbGxzIGZyb20gXCIuLi9saWIvZ2V0X3NraWxscy5qc1wiO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgKHtcclxuICAgIGNvbW1hbmQ6IGBza2lsbHNgLFxyXG4gICAgaGVscDogYExpc3QgYXZhaWxhYmxlIHNraWxsc2AsXHJcblxyXG4gICAgaGFuZGxlcjogKCkgPT4ge1xyXG4gICAgICAgIGNvbnN0IHtcclxuICAgICAgICAgICAgU0hPUCxcclxuICAgICAgICAgICAgU0tJTExTXHJcbiAgICAgICAgfSA9IGdldF9za2lsbHMoKTtcclxuXHJcbiAgICAgICAgY29uc29sZS5sb2coYFxyXG5TSE9QXHJcbiR7T2JqZWN0LmtleXMoU0hPUCkuXHJcbiAgICAgICAgbWFwKChzKSA9PiBgWyR7c31dYCkuXHJcbiAgICAgICAgam9pbihgID0gYCl9XHJcblxyXG5TS0lMTFNcclxuJHtPYmplY3Qua2V5cyhTS0lMTFMpLlxyXG4gICAgICAgIG1hcCgocykgPT4gYFske3N9XWApLlxyXG4gICAgICAgIGpvaW4oYCBvIGApfVxyXG5gKTtcclxuICAgIH1cclxufSk7IiwiaW1wb3J0IHBtMiBmcm9tIFwiLi4vbGliL3BtMi5qc1wiO1xyXG5pbXBvcnQgZ2V0X2xpc3QgZnJvbSBcIi4uL2xpYi9nZXRfbGlzdC5qc1wiO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgKHtcclxuICAgIGNvbW1hbmQ6IGBzbGF5IFtEQUVNT05TLi4uXWAsXHJcbiAgICBoZWxwOiBgc2xheSBhY3RpdmUgW0RBRU1PTlNdYCwgXHJcbiAgICBhbGlhczogWyBgdW5zdW1tb25gLCBga2lsbGAsIGBzbGF5YCwgYHN0b3BgIF0sXHJcbiAgICBjYW5jZWwoKSB7XHJcbiAgICAgICAgdGhpcy5jYW5jZWxlcigpO1xyXG4gICAgfSxcclxuICAgIFxyXG4gICAgaGFuZGxlcih7IERBRU1PTlMgPSBnZXRfbGlzdCgpIH0gPSBmYWxzZSkge1xyXG4gICAgICAgIGNvbnN0IHdob20gPSBEQUVNT05TLm1hcCgoY2hhcikgPT4gYFske2NoYXJ9XWApLlxyXG4gICAgICAgICAgICBqb2luKGAgLSBgKTtcclxuXHJcbiAgICAgICAgY29uc29sZS5sb2coYFNMQVlJTkcgJHt3aG9tfWApO1xyXG5cclxuICAgICAgICBjb25zdCB7IGNhbmNlbCwgZG9uZSB9ID0gcG0yKHtcclxuICAgICAgICAgICAgY29tbWFuZHM6IFsgYGRlbGV0ZWAsIGBhbGxgIF1cclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgdGhpcy5jYW5jZWxlciA9IGNhbmNlbDtcclxuXHJcbiAgICAgICAgcmV0dXJuIGRvbmU7XHJcbiAgICB9XHJcbn0pO1xyXG5cclxuIiwiaW1wb3J0IHdhdGNoIGZyb20gXCIuL3dhdGNoLmpzXCI7XHJcbmltcG9ydCBzcGF3biBmcm9tIFwiLi9zcGF3bi5qc1wiO1xyXG5pbXBvcnQgcG0yIGZyb20gXCIuLi9saWIvcG0yLmpzXCI7XHJcblxyXG5pbXBvcnQgc3RvcCBmcm9tIFwiLi9zdG9wLmpzXCI7XHJcbmltcG9ydCBwcm9tcHRfZGFlbW9ucyBmcm9tIFwiLi4vbGliL3Byb21wdF9kYWVtb25zLmpzXCI7XHJcblxyXG5jb25zdCBydW5fZGFlbW9ucyA9ICh7IERBRU1PTlMgfSkgPT4ge1xyXG4gICAgd2F0Y2guaGFuZGxlcih7IERBRU1PTlMgfSk7XHJcbiAgICBzcGF3bi5oYW5kbGVyKHsgREFFTU9OUyB9KTtcclxuXHJcbiAgICByZXR1cm4gcG0yKHtcclxuICAgICAgICBjb21tYW5kczogWyBgbG9nc2AgXVxyXG4gICAgfSkuZG9uZTtcclxufTtcclxuXHJcbmV4cG9ydCBkZWZhdWx0ICh7XHJcbiAgICBjb21tYW5kOiBgc3VtbW9uIFtEQUVNT05TLi4uXWAsXHJcbiAgICBoZWxwOiBgc3VtbW9uIGFuZCB3YXRjaCBbREFFTU9OUy4uLl1gLFxyXG4gICAgYWxpYXM6IFsgYGRldmAsIGBzdGFydGAsIGBydW5gIF0sXHJcbiAgICBhc3luYyBoYW5kbGVyKHsgREFFTU9OUyB9KSB7XHJcbiAgICAgICAgY29uc3QgREFFTU9OcyA9IGF3YWl0IHByb21wdF9kYWVtb25zKHtcclxuICAgICAgICAgICAgY21kOiB0aGlzLFxyXG4gICAgICAgICAgICBEQUVNT05TXHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIGF3YWl0IHN0b3AuaGFuZGxlcigpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHJldHVybiBydW5fZGFlbW9ucyh7IERBRU1PTlM6IERBRU1PTnMgfSk7XHJcbiAgICB9LFxyXG5cclxuICAgIGNhbmNlbCgpIHtcclxuICAgICAgICB3YXRjaC5jYW5jZWwoKTtcclxuICAgIH1cclxufSk7XHJcblxyXG4iLCJpbXBvcnQgcG0yIGZyb20gXCIuLi9saWIvcG0yLmpzXCI7XHJcblxyXG5leHBvcnQgZGVmYXVsdCh7XHJcbiAgICBjb21tYW5kOiBgc3RhdHVzIFtEQUVNT05dYCxcclxuICAgIGhlbHA6IGBzdGF0dXMgb2YgYWN0aXZlIFtEQUVNT05dcy5gLFxyXG4gICAgYWxpYXM6IFsgYHBzYCwgYGFjdGl2ZWAsIGBzdGF0c2AgXSxcclxuICAgIGhhbmRsZXI6ICgpID0+IHBtMih7XHJcbiAgICAgICAgY29tbWFuZHM6IFsgYHBzYCBdXHJcbiAgICB9KS5kb25lXHJcbn0pOyIsImltcG9ydCB7IHZlcnNpb24gfSBmcm9tIFwiLi4vLi4vcGFja2FnZS5qc29uXCI7XHJcblxyXG5leHBvcnQgZGVmYXVsdCAoe1xyXG4gICAgY29tbWFuZDogYHZlcnNpb25gLFxyXG4gICAgaGVscDogYFZlcnNpb24gaXMgJHt2ZXJzaW9ufWAsXHJcbiAgICBoYW5kbGVyOiAoKSA9PiB7XHJcbiAgICAgICAgY29uc29sZS5sb2codmVyc2lvbik7XHJcbiAgICB9XHJcbn0pOyIsImNvbnN0IHJlcyA9IHt9O1xuaW1wb3J0IGYwIGZyb20gXCIvVXNlcnMvR2FtZXMvUHJvamVjdHMvaXNla2FpL3NyYy9jb21tYW5kcy9idWlsZC5qc1wiO1xucmVzW1wiYnVpbGRcIl0gPSBmMDtcbmltcG9ydCBmMSBmcm9tIFwiL1VzZXJzL0dhbWVzL1Byb2plY3RzL2lzZWthaS9zcmMvY29tbWFuZHMvY29tbWl0LmpzXCI7XG5yZXNbXCJjb21taXRcIl0gPSBmMTtcbmltcG9ydCBmMiBmcm9tIFwiL1VzZXJzL0dhbWVzL1Byb2plY3RzL2lzZWthaS9zcmMvY29tbWFuZHMvY3JlYXRlLmpzXCI7XG5yZXNbXCJjcmVhdGVcIl0gPSBmMjtcbmltcG9ydCBmMyBmcm9tIFwiL1VzZXJzL0dhbWVzL1Byb2plY3RzL2lzZWthaS9zcmMvY29tbWFuZHMvZGFlbW9ucy5qc1wiO1xucmVzW1wiZGFlbW9uc1wiXSA9IGYzO1xuaW1wb3J0IGY0IGZyb20gXCIvVXNlcnMvR2FtZXMvUHJvamVjdHMvaXNla2FpL3NyYy9jb21tYW5kcy9kZXYuanNcIjtcbnJlc1tcImRldlwiXSA9IGY0O1xuaW1wb3J0IGY1IGZyb20gXCIvVXNlcnMvR2FtZXMvUHJvamVjdHMvaXNla2FpL3NyYy9jb21tYW5kcy9sb2dzLmpzXCI7XG5yZXNbXCJsb2dzXCJdID0gZjU7XG5pbXBvcnQgZjYgZnJvbSBcIi9Vc2Vycy9HYW1lcy9Qcm9qZWN0cy9pc2VrYWkvc3JjL2NvbW1hbmRzL3B1bGwuanNcIjtcbnJlc1tcInB1bGxcIl0gPSBmNjtcbmltcG9ydCBmNyBmcm9tIFwiL1VzZXJzL0dhbWVzL1Byb2plY3RzL2lzZWthaS9zcmMvY29tbWFuZHMvcHVzaC5qc1wiO1xucmVzW1wicHVzaFwiXSA9IGY3O1xuaW1wb3J0IGY4IGZyb20gXCIvVXNlcnMvR2FtZXMvUHJvamVjdHMvaXNla2FpL3NyYy9jb21tYW5kcy9za2lsbHMuanNcIjtcbnJlc1tcInNraWxsc1wiXSA9IGY4O1xuaW1wb3J0IGY5IGZyb20gXCIvVXNlcnMvR2FtZXMvUHJvamVjdHMvaXNla2FpL3NyYy9jb21tYW5kcy9zcGF3bi5qc1wiO1xucmVzW1wic3Bhd25cIl0gPSBmOTtcbmltcG9ydCBmMTAgZnJvbSBcIi9Vc2Vycy9HYW1lcy9Qcm9qZWN0cy9pc2VrYWkvc3JjL2NvbW1hbmRzL3N0YXJ0LmpzXCI7XG5yZXNbXCJzdGFydFwiXSA9IGYxMDtcbmltcG9ydCBmMTEgZnJvbSBcIi9Vc2Vycy9HYW1lcy9Qcm9qZWN0cy9pc2VrYWkvc3JjL2NvbW1hbmRzL3N0YXR1cy5qc1wiO1xucmVzW1wic3RhdHVzXCJdID0gZjExO1xuaW1wb3J0IGYxMiBmcm9tIFwiL1VzZXJzL0dhbWVzL1Byb2plY3RzL2lzZWthaS9zcmMvY29tbWFuZHMvc3RvcC5qc1wiO1xucmVzW1wic3RvcFwiXSA9IGYxMjtcbmltcG9ydCBmMTMgZnJvbSBcIi9Vc2Vycy9HYW1lcy9Qcm9qZWN0cy9pc2VrYWkvc3JjL2NvbW1hbmRzL3ZlcnNpb24uanNcIjtcbnJlc1tcInZlcnNpb25cIl0gPSBmMTM7XG5pbXBvcnQgZjE0IGZyb20gXCIvVXNlcnMvR2FtZXMvUHJvamVjdHMvaXNla2FpL3NyYy9jb21tYW5kcy93YXRjaC5qc1wiO1xucmVzW1wid2F0Y2hcIl0gPSBmMTQ7XG5leHBvcnQgZGVmYXVsdCByZXM7IiwiaW1wb3J0IGMgZnJvbSBcImNoYWxrXCI7XHJcblxyXG5jb25zdCB7IGxvZyB9ID0gY29uc29sZTtcclxuXHJcbmNvbnNvbGUubG9nID0gKC4uLmFyZ3MpID0+IGxvZyhcclxuICAgIC4uLmFyZ3MubWFwKFxyXG4gICAgICAgIChpdGVtKSA9PiB0eXBlb2YgaXRlbSA9PT0gYHN0cmluZ2BcclxuICAgICAgICAgICAgPyBjLmdyZWVuKFxyXG4gICAgICAgICAgICAgICAgaXRlbS5yZXBsYWNlKC8oXFxbLlteXFxdXFxbXSpcXF0pL3VnLCBjLmJvbGQud2hpdGUoYCQxYCkpXHJcbiAgICAgICAgICAgIClcclxuICAgICAgICAgICAgOiBpdGVtXHJcbiAgICApXHJcbik7XHJcbiIsIiMhL3Vzci9iaW4vZW52IG5vZGVcclxuXHJcbmltcG9ydCB2b3JwYWwgZnJvbSBcInZvcnBhbFwiO1xyXG5pbXBvcnQgY29tbWFuZHMgZnJvbSBcIi4vY29tbWFuZHMvKi5qc1wiO1xyXG5pbXBvcnQgeyB2ZXJzaW9uIH0gZnJvbSBcIi4uL3BhY2thZ2UuanNvblwiO1xyXG5cclxuaW1wb3J0IFwiLi9saWIvZm9ybWF0LmpzXCI7XHJcblxyXG5pbXBvcnQgY2hhbGsgZnJvbSBcImNoYWxrXCI7XHJcblxyXG5jb25zdCB2ID0gdm9ycGFsKCk7XHJcblxyXG5PYmplY3QuZW50cmllcyhjb21tYW5kcykuXHJcbiAgICBmb3JFYWNoKChbXHJcbiAgICAgICAgbmFtZSwge1xyXG4gICAgICAgICAgICBoZWxwLFxyXG4gICAgICAgICAgICBoYW5kbGVyLFxyXG4gICAgICAgICAgICBhdXRvY29tcGxldGUsXHJcbiAgICAgICAgICAgIGhpZGRlbixcclxuICAgICAgICAgICAgY29tbWFuZCxcclxuICAgICAgICAgICAgYWxpYXMgPSBbXSxcclxuICAgICAgICAgICAgb3B0aW9ucyA9IHt9LFxyXG4gICAgICAgICAgICBjYW5jZWwgPSAoKSA9PiB7fVxyXG4gICAgICAgIH1cclxuICAgIF0pID0+IHsgXHJcbiAgICAgICAgY29uc3QgaXN0ID0gdi5jb21tYW5kKGNvbW1hbmQgfHwgbmFtZSwgaGVscCkuXHJcbiAgICAgICAgICAgIGFsaWFzKGFsaWFzKS5cclxuICAgICAgICAgICAgYXV0b2NvbXBsZXRlKGF1dG9jb21wbGV0ZSB8fCBbXSkuXHJcbiAgICAgICAgICAgIGNhbmNlbChjYW5jZWwpLlxyXG4gICAgICAgICAgICBhY3Rpb24oaGFuZGxlcik7XHJcblxyXG4gICAgICAgIGlmKGhpZGRlbikge1xyXG4gICAgICAgICAgICBpc3QuaGlkZGVuKCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBPYmplY3QuZW50cmllcyhvcHRpb25zKS5cclxuICAgICAgICAgICAgZm9yRWFjaCgoWyBvcHRpb24sIG9wdGlvbl9oZWxwIF0pID0+IHtcclxuICAgICAgICAgICAgICAgIGlzdC5vcHRpb24ob3B0aW9uLCBvcHRpb25faGVscCk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgfSk7XHJcblxyXG5jb25zdCBzdGFydHVwX2NvbW1hbmRzID0gcHJvY2Vzcy5hcmd2LnNsaWNlKDIpO1xyXG5cclxuaWYoc3RhcnR1cF9jb21tYW5kcy5sZW5ndGggPiAwKSB7XHJcbiAgICB2LmV4ZWMoc3RhcnR1cF9jb21tYW5kcy5qb2luKGAgYCkpO1xyXG59IGVsc2Uge1xyXG5cclxuICAgIHByb2Nlc3Muc3Rkb3V0LndyaXRlKGBcXHgxQmNgKTtcclxuXHJcbiAgICBjb25zb2xlLmxvZyhjaGFsay5ncmVlbihgXHJcbuKWiOKWiOKVl+KWiOKWiOKWiOKWiOKWiOKWiOKWiOKVl+KWiOKWiOKWiOKWiOKWiOKWiOKWiOKVl+KWiOKWiOKVlyAg4paI4paI4pWXIOKWiOKWiOKWiOKWiOKWiOKVlyDilojilojilZcgICAgICDilojilojilojilojilojilojilojilZfilojilojilojilZcgICDilojilojilZcg4paI4paI4paI4paI4paI4paI4pWXIOKWiOKWiOKVl+KWiOKWiOKWiOKVlyAgIOKWiOKWiOKVl+KWiOKWiOKWiOKWiOKWiOKWiOKWiOKVlyAgICBcclxu4paI4paI4pWR4paI4paI4pWU4pWQ4pWQ4pWQ4pWQ4pWd4paI4paI4pWU4pWQ4pWQ4pWQ4pWQ4pWd4paI4paI4pWRIOKWiOKWiOKVlOKVneKWiOKWiOKVlOKVkOKVkOKWiOKWiOKVl+KWiOKWiOKVkeKWhCDilojilojilZfiloTilojilojilZTilZDilZDilZDilZDilZ3ilojilojilojilojilZcgIOKWiOKWiOKVkeKWiOKWiOKVlOKVkOKVkOKVkOKVkOKVnSDilojilojilZHilojilojilojilojilZcgIOKWiOKWiOKVkeKWiOKWiOKVlOKVkOKVkOKVkOKVkOKVnSAgICBcclxu4paI4paI4pWR4paI4paI4paI4paI4paI4paI4paI4pWX4paI4paI4paI4paI4paI4pWXICDilojilojilojilojilojilZTilZ0g4paI4paI4paI4paI4paI4paI4paI4pWR4paI4paI4pWRIOKWiOKWiOKWiOKWiOKVl+KWiOKWiOKWiOKWiOKWiOKVlyAg4paI4paI4pWU4paI4paI4pWXIOKWiOKWiOKVkeKWiOKWiOKVkSAg4paI4paI4paI4pWX4paI4paI4pWR4paI4paI4pWU4paI4paI4pWXIOKWiOKWiOKVkeKWiOKWiOKWiOKWiOKWiOKVlyAgICAgIFxyXG7ilojilojilZHilZrilZDilZDilZDilZDilojilojilZHilojilojilZTilZDilZDilZ0gIOKWiOKWiOKVlOKVkOKWiOKWiOKVlyDilojilojilZTilZDilZDilojilojilZHilojilojilZHiloDilZrilojilojilZTiloDilojilojilZTilZDilZDilZ0gIOKWiOKWiOKVkeKVmuKWiOKWiOKVl+KWiOKWiOKVkeKWiOKWiOKVkSAgIOKWiOKWiOKVkeKWiOKWiOKVkeKWiOKWiOKVkeKVmuKWiOKWiOKVl+KWiOKWiOKVkeKWiOKWiOKVlOKVkOKVkOKVnSAgICAgIFxyXG7ilojilojilZHilojilojilojilojilojilojilojilZHilojilojilojilojilojilojilojilZfilojilojilZEgIOKWiOKWiOKVl+KWiOKWiOKVkSAg4paI4paI4pWR4paI4paI4pWRICDilZrilZDilZ0g4paI4paI4paI4paI4paI4paI4paI4pWX4paI4paI4pWRIOKVmuKWiOKWiOKWiOKWiOKVkeKVmuKWiOKWiOKWiOKWiOKWiOKWiOKVlOKVneKWiOKWiOKVkeKWiOKWiOKVkSDilZrilojilojilojilojilZHilojilojilojilojilojilojilojilZcgICAgXHJcbuKVmuKVkOKVneKVmuKVkOKVkOKVkOKVkOKVkOKVkOKVneKVmuKVkOKVkOKVkOKVkOKVkOKVkOKVneKVmuKVkOKVnSAg4pWa4pWQ4pWd4pWa4pWQ4pWdICDilZrilZDilZ3ilZrilZDilZ0gICAgICDilZrilZDilZDilZDilZDilZDilZDilZ3ilZrilZDilZ0gIOKVmuKVkOKVkOKVkOKVnSDilZrilZDilZDilZDilZDilZDilZ0g4pWa4pWQ4pWd4pWa4pWQ4pWdICDilZrilZDilZDilZDilZ3ilZrilZDilZDilZDilZDilZDilZDilZ0gICAgXHJcblZFUlNJT046ICR7dmVyc2lvbn0gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxyXG5gKSk7XHJcblxyXG4gICAgdi5kZWxpbWl0ZXIoY2hhbGsuYm9sZC5ncmVlbihgPmApKS5cclxuICAgICAgICBzaG93KCk7XHJcbn0iXSwibmFtZXMiOlsiY3JlYXRlRmlsdGVyIiwiZ2xvYiIsInRlcnNlciIsInRvbWwiLCJnaXQiLCJleGVjIiwicG0yIiwid2F0Y2giLCJzcGF3biIsInN0b3AiLCJ2ZXJzaW9uIiwiY29tbWFuZHMiLCJjaGFsayJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQVNBLE1BQU0sV0FBVyxHQUFHLENBQUMsTUFBTSxHQUFHLE9BQU8sQ0FBQyxHQUFHLEVBQUUsS0FBSztJQUM1QyxNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFDdkMsSUFBSSxNQUFNLEtBQUssTUFBTSxFQUFFO1FBQ25CLE9BQU8sTUFBTSxDQUFDO0tBQ2pCOztJQUVELE9BQU8sV0FBVyxDQUFDLE1BQU0sQ0FBQyxDQUFDO0NBQzlCLENBQUM7O0FBRUYsTUFBTSxRQUFRLEdBQUcsV0FBVyxFQUFFLENBQUM7QUFDL0IsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7O0FBRWhDLE1BQU0sV0FBVyxHQUFHLENBQUMsUUFBUSxLQUFLO0lBQzlCLE1BQU0sYUFBYSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDO1FBQ3JDLE9BQU8sQ0FBQyxRQUFRLEVBQUUsUUFBUSxDQUFDO1FBQzNCLEtBQUssQ0FBQyxJQUFJ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
