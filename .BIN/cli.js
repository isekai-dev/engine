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
var copy = _interopDefault(require('rollup-plugin-copy-glob'));
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
const production = !process.env.ROLLUP_WATCH;

const do_copy = (copyObject) => copy(Object.keys(copyObject).
    map(
        (key) => ({
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
        do_copy(copyObject),
        toml
    ],
});

const browser = ({
    input,
    output,
    css: cssPath,
    copy: copyObject,
}) => ({
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
            CLIENT_VERSION: () => CLIENT_VERSION
        }),
        toml,
        md(),
        svelte({
            css: (css) => {
                css.write(cssPath);
            },
        }),
        resolve(),
        production && rollupPluginTerser.terser(),
        do_copy(copyObject),
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
        const target = config.NODE 
            ? `NODE` 
            : `BROWSER`;

        const output = `.BIN/${name}.${target}.js`;

        if(config.NODE && config.BROWSER) {
            throw new Error(`You cannot target both [NODE] and [BROWSER]`);
        }

        if(config.NODE) {               
            return {
                output,
                build_info: builders.node({
                    input,
                    output
                })
            };
        }
        
        if(config.BROWSER) {
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

var get_list = () => glob$1.sync(`./DAEMONS/*.toml`).
    map((class_path) => path.basename(class_path, `.toml`));

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
            then(({ DAEMON }) => {
                console.log(DAEMON, `DAEMON`);
                
                return DAEMON === `all` 
                    ? get_list() 
                    : filter_list([ DAEMON ]);
            });
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
                    console.log(`PUSHING [${DAEMON}] - ${url}`);

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
        const DAEMONs = await prompt_daemons({
            cmd: this,
            DAEMONS
        });

        DAEMONs.forEach((DAEMON) => {
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
    command: `stop [DAEMONS...]`,
    help: `stop active [DAEMON] files. `, 
    alias: [`unsummon`, `kill`],
    cancel() {
        this.canceler();
    },
    
    handler({ DAEMONS = get_list() } = false) {
        const whom = DAEMONS.map((char) => `[${char}]`).
            join(` - `);

        console.log(`STOPPING ${whom}`);

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

var version$1 = "0.0.12";

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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2xpLmpzIiwic291cmNlcyI6WyIuLi9zcmMvcm9sbHVwL3BsdWdpbi1nbG9iLmpzIiwiLi4vc3JjL3JvbGx1cC92ZXJzaW9uLmpzIiwiLi4vc3JjL3JvbGx1cC9idWlsZGVycy5qcyIsIi4uL3NyYy9saWIvZ2V0X3NraWxscy5qcyIsIi4uL3NyYy9saWIvZ2V0X2NvbmZpZy5qcyIsIi4uL3NyYy90cmFuc2Zvcm1zL3RvbWxfdG9fanMuanMiLCIuLi9zcmMvbGliL2dldF9saXN0LmpzIiwiLi4vc3JjL2xpYi9maWx0ZXJfbGlzdC5qcyIsIi4uL3NyYy9saWIvcHJvbXB0X2RhZW1vbnMuanMiLCIuLi9zcmMvY29tbWFuZHMvYnVpbGQuanMiLCIuLi9zcmMvY29tbWFuZHMvY29tbWl0LmpzIiwiLi4vc3JjL2NvbW1hbmRzL2NyZWF0ZS5qcyIsIi4uL3NyYy9jb21tYW5kcy9kYWVtb25zLmpzIiwiLi4vc3JjL2xpYi9wbTIuanMiLCIuLi9zcmMvY29tbWFuZHMvbG9ncy5qcyIsIi4uL3NyYy9jb21tYW5kcy9wdWxsLmpzIiwiLi4vc3JjL2NvbW1hbmRzL3B1c2guanMiLCIuLi9zcmMvY29tbWFuZHMvc2tpbGxzLmpzIiwiLi4vc3JjL2NvbW1hbmRzL3NwYXduLmpzIiwiLi4vc3JjL2xpYi9hY3Rpb24uanMiLCIuLi9zcmMvY29tbWFuZHMvd2F0Y2guanMiLCIuLi9zcmMvY29tbWFuZHMvc3RvcC5qcyIsIi4uL3NyYy9jb21tYW5kcy9zdGFydC5qcyIsIi4uL3NyYy9jb21tYW5kcy9zdGF0dXMuanMiLCIuLi9zcmMvY29tbWFuZHMvdmVyc2lvbi5qcyIsIi4uLzRlZTQ5NWZiMTgwZTJiNGE2NWE3YzE1MjYwOThiYjBkIiwiLi4vc3JjL2xpYi9mb3JtYXQuanMiLCIuLi9zcmMvY2xpLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIlxyXG5pbXBvcnQgZnMgZnJvbSBcImZzXCI7XHJcbmltcG9ydCBvcyBmcm9tIFwib3NcIjtcclxuaW1wb3J0IGdsb2IgZnJvbSBcImdsb2JcIjtcclxuaW1wb3J0IHBhdGggZnJvbSBcInBhdGhcIjtcclxuaW1wb3J0IG1kNSBmcm9tIFwibWQ1XCI7XHJcblxyXG5pbXBvcnQgeyBjcmVhdGVGaWx0ZXIgfSBmcm9tIFwicm9sbHVwLXBsdWdpbnV0aWxzXCI7XHJcblxyXG5jb25zdCBnZXRGU1ByZWZpeCA9IChwcmVmaXggPSBwcm9jZXNzLmN3ZCgpKSA9PiB7XHJcbiAgICBjb25zdCBwYXJlbnQgPSBwYXRoLmpvaW4ocHJlZml4LCBgLi5gKTtcclxuICAgIGlmIChwYXJlbnQgPT09IHByZWZpeCkge1xyXG4gICAgICAgIHJldHVybiBwcmVmaXg7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIHJldHVybiBnZXRGU1ByZWZpeChwYXJlbnQpO1xyXG59O1xyXG5cclxuY29uc3QgZnNQcmVmaXggPSBnZXRGU1ByZWZpeCgpO1xyXG5jb25zdCByb290UGF0aCA9IHBhdGguam9pbihgL2ApO1xyXG5cclxuY29uc3QgdG9VUkxTdHJpbmcgPSAoZmlsZVBhdGgpID0+IHtcclxuICAgIGNvbnN0IHBhdGhGcmFnbWVudHMgPSBwYXRoLmpvaW4oZmlsZVBhdGgpLlxyXG4gICAgICAgIHJlcGxhY2UoZnNQcmVmaXgsIHJvb3RQYXRoKS5cclxuICAgICAgICBzcGxpdChwYXRoLnNlcCk7XHJcbiAgICBpZiAoIXBhdGguaXNBYnNvbHV0ZShmaWxlUGF0aCkpIHtcclxuICAgICAgICBwYXRoRnJhZ21lbnRzLnVuc2hpZnQoYC5gKTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgcmV0dXJuIHBhdGhGcmFnbWVudHMuam9pbihgL2ApO1xyXG59O1xyXG5cclxuY29uc3QgcmVzb2x2ZU5hbWUgPSAoZnJvbSkgPT4gXHJcbiAgICBmcm9tLnNwbGl0KGAvYCkuXHJcbiAgICAgICAgcG9wKCkuXHJcbiAgICAgICAgc3BsaXQoYC5gKS5cclxuICAgICAgICBzaGlmdCgpO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgKHsgXHJcbiAgICBpbmNsdWRlLCBcclxuICAgIGV4Y2x1ZGUgXHJcbn0gPSBmYWxzZSkgPT4ge1xyXG4gICAgY29uc3QgZmlsdGVyID0gY3JlYXRlRmlsdGVyKGluY2x1ZGUsIGV4Y2x1ZGUpO1xyXG4gICAgXHJcbiAgICByZXR1cm4ge1xyXG4gICAgICAgIG5hbWU6IGByb2xsdXAtZ2xvYmAsXHJcbiAgICAgICAgbG9hZDogKGlkKSA9PiB7XHJcbiAgICAgICAgICAgIGNvbnN0IHNyY0ZpbGUgPSBwYXRoLmpvaW4ob3MudG1wZGlyKCksIGlkKTtcclxuXHJcbiAgICAgICAgICAgIGxldCBvcHRpb25zO1xyXG4gICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgb3B0aW9ucyA9IEpTT04ucGFyc2UoZnMucmVhZEZpbGVTeW5jKHNyY0ZpbGUpKTtcclxuICAgICAgICAgICAgfSBjYXRjaChlcnIpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgY29uc3QgeyBpbXBvcnRlZSwgaW1wb3J0ZXIgfSA9IG9wdGlvbnM7XHJcblxyXG4gICAgICAgICAgICBjb25zdCBpbXBvcnRlZUlzQWJzb2x1dGUgPSBwYXRoLmlzQWJzb2x1dGUoaW1wb3J0ZWUpO1xyXG4gICAgICAgICAgICBjb25zdCBjd2QgPSBwYXRoLmRpcm5hbWUoaW1wb3J0ZXIpO1xyXG4gICAgICAgICAgICBjb25zdCBnbG9iUGF0dGVybiA9IGltcG9ydGVlO1xyXG5cclxuICAgICAgICAgICAgY29uc3QgZmlsZXMgPSBnbG9iLnN5bmMoZ2xvYlBhdHRlcm4sIHtcclxuICAgICAgICAgICAgICAgIGN3ZFxyXG4gICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgIGxldCBjb2RlID0gWyBgY29uc3QgcmVzID0ge307YCBdO1xyXG4gICAgICAgICAgICBsZXQgaW1wb3J0QXJyYXkgPSBbXTtcclxuXHJcbiAgICAgICAgICAgIGZpbGVzLmZvckVhY2goKGZpbGUsIGkpID0+IHtcclxuICAgICAgICAgICAgICAgIGxldCBmcm9tO1xyXG4gICAgICAgICAgICAgICAgaWYgKGltcG9ydGVlSXNBYnNvbHV0ZSkge1xyXG4gICAgICAgICAgICAgICAgICAgIGZyb20gPSB0b1VSTFN0cmluZyhmaWxlKTtcclxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgZnJvbSA9IHRvVVJMU3RyaW5nKHBhdGgucmVzb2x2ZShjd2QsIGZpbGUpKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGNvZGUucHVzaChgaW1wb3J0IGYke2l9IGZyb20gXCIke2Zyb219XCI7YCk7XHJcbiAgICAgICAgICAgICAgICBjb2RlLnB1c2goYHJlc1tcIiR7cmVzb2x2ZU5hbWUoZnJvbSl9XCJdID0gZiR7aX07YCk7XHJcbiAgICAgICAgICAgICAgICBpbXBvcnRBcnJheS5wdXNoKGZyb20pO1xyXG4gICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgIGNvZGUucHVzaChgZXhwb3J0IGRlZmF1bHQgcmVzO2ApO1xyXG5cclxuICAgICAgICAgICAgY29kZSA9IGNvZGUuam9pbihgXFxuYCk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgICAgIHJldHVybiBjb2RlO1xyXG5cclxuICAgICAgICB9LFxyXG4gICAgICAgIHJlc29sdmVJZDogKGltcG9ydGVlLCBpbXBvcnRlcikgPT4ge1xyXG4gICAgICAgICAgICBpZiAoIWZpbHRlcihpbXBvcnRlZSkgfHwgIWltcG9ydGVlLmluY2x1ZGVzKGAqYCkpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgY29uc3QgaGFzaCA9IG1kNShpbXBvcnRlZSArIGltcG9ydGVyKTtcclxuXHJcbiAgICAgICAgICAgIGZzLndyaXRlRmlsZVN5bmMocGF0aC5qb2luKG9zLnRtcGRpcigpLCBoYXNoKSwgSlNPTi5zdHJpbmdpZnkoe1xyXG4gICAgICAgICAgICAgICAgaW1wb3J0ZWUsXHJcbiAgICAgICAgICAgICAgICBpbXBvcnRlclxyXG4gICAgICAgICAgICB9KSk7XHJcblxyXG4gICAgICAgICAgICByZXR1cm4gaGFzaDtcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG59OyIsImltcG9ydCBmcyBmcm9tIFwiZnNcIjtcclxuXHJcbmV4cG9ydCBkZWZhdWx0ICh7XHJcbiAgICBwYXRoLFxyXG4gICAgdmVyc2lvblxyXG59KSA9PiBcclxuICAgICh7XHJcbiAgICAgICAgbmFtZTogYHJvbGx1cC13cml0ZWAsXHJcbiAgICAgICAgYnVpbGRTdGFydDogKCkgPT4ge1xyXG4gICAgICAgICAgICBmcy53cml0ZUZpbGVTeW5jKHBhdGgsIHZlcnNpb24oKSk7XHJcbiAgICAgICAgfVxyXG4gICAgfSk7IiwiaW1wb3J0IHRvbWwgZnJvbSBcInJvbGx1cC1wbHVnaW4tdG9tbFwiO1xyXG5pbXBvcnQgc3ZlbHRlIGZyb20gXCJyb2xsdXAtcGx1Z2luLXN2ZWx0ZVwiO1xyXG5pbXBvcnQgcmVzb2x2ZSBmcm9tIFwicm9sbHVwLXBsdWdpbi1ub2RlLXJlc29sdmVcIjtcclxuaW1wb3J0IGNvcHkgZnJvbSBcInJvbGx1cC1wbHVnaW4tY29weS1nbG9iXCI7XHJcbmltcG9ydCByZXBsYWNlIGZyb20gXCJyb2xsdXAtcGx1Z2luLXJlcGxhY2VcIjtcclxuXHJcbmltcG9ydCBqc29uIGZyb20gXCJyb2xsdXAtcGx1Z2luLWpzb25cIjtcclxuaW1wb3J0IG1kIGZyb20gXCJyb2xsdXAtcGx1Z2luLWNvbW1vbm1hcmtcIjtcclxuaW1wb3J0IGNqcyBmcm9tIFwicm9sbHVwLXBsdWdpbi1jb21tb25qc1wiO1xyXG5cclxuaW1wb3J0IHsgdGVyc2VyIH0gZnJvbSBcInJvbGx1cC1wbHVnaW4tdGVyc2VyXCI7XHJcbmltcG9ydCB1dWlkIGZyb20gXCJ1dWlkL3YxXCI7XHJcblxyXG4vKlxyXG4gKiBpbXBvcnQgc3ByaXRlc21pdGggZnJvbSBcInJvbGx1cC1wbHVnaW4tc3ByaXRlXCI7XHJcbiAqIGltcG9ydCB0ZXh0dXJlUGFja2VyIGZyb20gXCJzcHJpdGVzbWl0aC10ZXh0dXJlcGFja2VyXCI7XHJcbiAqL1xyXG5cclxuaW1wb3J0IGdsb2IgZnJvbSBcIi4vcGx1Z2luLWdsb2IuanNcIjtcclxuaW1wb3J0IHZlcnNpb24gZnJvbSBcIi4vdmVyc2lvbi5qc1wiO1xyXG5cclxuY29uc3QgQ09ERV9WRVJTSU9OID0gdXVpZCgpO1xyXG5jb25zdCBwcm9kdWN0aW9uID0gIXByb2Nlc3MuZW52LlJPTExVUF9XQVRDSDtcclxuXHJcbmNvbnN0IGRvX2NvcHkgPSAoY29weU9iamVjdCkgPT4gY29weShPYmplY3Qua2V5cyhjb3B5T2JqZWN0KS5cclxuICAgIG1hcChcclxuICAgICAgICAoa2V5KSA9PiAoe1xyXG4gICAgICAgICAgICBmaWxlczoga2V5LFxyXG4gICAgICAgICAgICBkZXN0OiBjb3B5T2JqZWN0W2tleV1cclxuICAgICAgICB9KVxyXG4gICAgKSk7XHJcblxyXG5sZXQgQ0xJRU5UX1ZFUlNJT04gPSB1dWlkKCk7XHJcblxyXG5jb25zdCBleHRlcm5hbCA9IFtcclxuICAgIGBleHByZXNzYCxcclxuICAgIGBpc2VrYWlgLFxyXG4gICAgYGZzYCxcclxuICAgIGBodHRwYCxcclxuICAgIGBodHRwc2BcclxuXTtcclxuXHJcbmNvbnN0IG5vZGUgPSAoe1xyXG4gICAgaW5wdXQsXHJcbiAgICBvdXRwdXQsXHJcbiAgICBjb3B5OiBjb3B5T2JqZWN0ID0ge31cclxufSkgPT4gKHtcclxuICAgIGlucHV0LFxyXG4gICAgb3V0cHV0OiB7XHJcbiAgICAgICAgc291cmNlbWFwOiBgaW5saW5lYCxcclxuICAgICAgICBmaWxlOiBvdXRwdXQsXHJcbiAgICAgICAgZm9ybWF0OiBgY2pzYCxcclxuICAgIH0sXHJcbiAgICBleHRlcm5hbCxcclxuICAgIHBsdWdpbnM6IFtcclxuICAgICAgICBnbG9iKCksXHJcbiAgICAgICAgcmVwbGFjZSh7XHJcbiAgICAgICAgICAgIENPREVfVkVSU0lPTixcclxuICAgICAgICB9KSxcclxuICAgICAgICBtZCgpLFxyXG4gICAgICAgIGpzb24oKSxcclxuICAgICAgICBkb19jb3B5KGNvcHlPYmplY3QpLFxyXG4gICAgICAgIHRvbWxcclxuICAgIF0sXHJcbn0pO1xyXG5cclxuY29uc3QgYnJvd3NlciA9ICh7XHJcbiAgICBpbnB1dCxcclxuICAgIG91dHB1dCxcclxuICAgIGNzczogY3NzUGF0aCxcclxuICAgIGNvcHk6IGNvcHlPYmplY3QsXHJcbn0pID0+ICh7XHJcbiAgICBpbnB1dCxcclxuICAgIG91dHB1dDoge1xyXG4gICAgICAgIGZpbGU6IG91dHB1dCxcclxuICAgICAgICBmb3JtYXQ6IGBpaWZlYCxcclxuICAgIH0sXHJcbiAgICBleHRlcm5hbDogWyBgdXVpZGAsIGB1dWlkL3YxYCwgYHBpeGkuanNgIF0sXHJcbiAgICBwbHVnaW5zOiBbXHJcbiAgICAgICAgLy8gLy8gbWFrZSB0aGlzIGEgcmVhY3RpdmUgcGx1Z2luIHRvIFwiLnRpbGVtYXAuanNvblwiXHJcbiAgICAgICAgLy8gICAgIHNwcml0ZXNtaXRoKHtcclxuICAgICAgICAvLyAgICAgICAgIHNyYzoge1xyXG4gICAgICAgIC8vICAgICAgICAgICAgIGN3ZDogXCIuL2dvYmxpbi5saWZlL0JST1dTRVIuUElYSS9cclxuICAgICAgICAvLyAgICAgICAgICAgICBnbG9iOiBcIioqLyoucG5nXCJcclxuICAgICAgICAvLyAgICAgICAgIH0sXHJcbiAgICAgICAgLy8gICAgICAgICB0YXJnZXQ6IHtcclxuICAgICAgICAvLyAgICAgICAgICAgICBpbWFnZTogXCIuL2Jpbi9wdWJsaWMvaW1hZ2VzL3Nwcml0ZS5wbmdcIixcclxuICAgICAgICAvLyAgICAgICAgICAgICBjc3M6IFwiLi9iaW4vcHVibGljL2FydC9kZWZhdWx0Lmpzb25cIlxyXG4gICAgICAgIC8vICAgICAgICAgfSxcclxuICAgICAgICAvLyAgICAgICAgIG91dHB1dDoge1xyXG4gICAgICAgIC8vICAgICAgICAgICAgIGltYWdlOiBcIi4vYmluL3B1YmxpYy9pbWFnZXMvc3ByaXRlLnBuZ1wiXHJcbiAgICAgICAgLy8gICAgICAgICB9LFxyXG4gICAgICAgIC8vICAgICAgICAgc3ByaXRlc21pdGhPcHRpb25zOiB7XHJcbiAgICAgICAgLy8gICAgICAgICAgICAgcGFkZGluZzogMFxyXG4gICAgICAgIC8vICAgICAgICAgfSxcclxuICAgICAgICAvLyAgICAgICAgIGN1c3RvbVRlbXBsYXRlOiB0ZXh0dXJlUGFja2VyXHJcbiAgICAgICAgLy8gICAgIH0pLFxyXG4gICAgICAgIGdsb2IoKSxcclxuICAgICAgICBjanMoe1xyXG4gICAgICAgICAgICBpbmNsdWRlOiBgbm9kZV9tb2R1bGVzLyoqYCwgXHJcbiAgICAgICAgfSksXHJcbiAgICAgICAganNvbigpLFxyXG4gICAgICAgIHJlcGxhY2Uoe1xyXG4gICAgICAgICAgICBDT0RFX1ZFUlNJT04sXHJcbiAgICAgICAgICAgIENMSUVOVF9WRVJTSU9OOiAoKSA9PiBDTElFTlRfVkVSU0lPTlxyXG4gICAgICAgIH0pLFxyXG4gICAgICAgIHRvbWwsXHJcbiAgICAgICAgbWQoKSxcclxuICAgICAgICBzdmVsdGUoe1xyXG4gICAgICAgICAgICBjc3M6IChjc3MpID0+IHtcclxuICAgICAgICAgICAgICAgIGNzcy53cml0ZShjc3NQYXRoKTtcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICB9KSxcclxuICAgICAgICByZXNvbHZlKCksXHJcbiAgICAgICAgcHJvZHVjdGlvbiAmJiB0ZXJzZXIoKSxcclxuICAgICAgICBkb19jb3B5KGNvcHlPYmplY3QpLFxyXG4gICAgICAgIHZlcnNpb24oe1xyXG4gICAgICAgICAgICBwYXRoOiBgLi8uQklOL2NsaWVudC52ZXJzaW9uYCxcclxuICAgICAgICAgICAgdmVyc2lvbjogKCkgPT4gQ0xJRU5UX1ZFUlNJT05cclxuICAgICAgICB9KVxyXG4gICAgXVxyXG59KTtcclxuXHJcbmV4cG9ydCBkZWZhdWx0IHtcclxuICAgIG5vZGUsXHJcbiAgICBicm93c2VyXHJcbn07IiwiaW1wb3J0IHBhdGggZnJvbSBcInBhdGhcIjtcclxuaW1wb3J0IGdsb2IgZnJvbSBcImdsb2JcIjtcclxuXHJcbi8vIGRvbid0IHJlYWxseSBzdXBwb3J0IG92ZXJyaWRlc1xyXG5jb25zdCBnbG9iX29iaiA9IChvYmogPSB7fSwgZ2xvYl9wYXRoKSA9PiBnbG9iLnN5bmMoZ2xvYl9wYXRoKS5cclxuICAgIHJlZHVjZSgob2JqLCBlcXVpcF9wYXRoKSA9PiB7XHJcbiAgICAgICAgY29uc3QgcHJvamVjdF9uYW1lID0gcGF0aC5iYXNlbmFtZShwYXRoLnJlc29sdmUoZXF1aXBfcGF0aCwgYC4uYCwgYC4uYCkpO1xyXG4gICAgICAgIGNvbnN0IHNraWxsX25hbWUgPSBwYXRoLmJhc2VuYW1lKGVxdWlwX3BhdGgpO1xyXG5cclxuICAgICAgICBpZihvYmpbc2tpbGxfbmFtZV0pIHtcclxuICAgICAgICAvLyBwcmV2ZW50cyBoaWphY2tpbmdcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGAke3NraWxsX25hbWV9IGZyb20gJHtwcm9qZWN0X25hbWV9IG92ZXJsYXBzICR7b2JqW3NraWxsX25hbWVdfWApO1xyXG4gICAgICAgIH1cclxuICAgIFxyXG4gICAgICAgIHJldHVybiB7IFxyXG4gICAgICAgICAgICBbc2tpbGxfbmFtZV06IHBhdGgucmVsYXRpdmUocHJvY2Vzcy5jd2QoKSwgcGF0aC5yZXNvbHZlKGVxdWlwX3BhdGgsIGAuLmAsIGAuLmApKSxcclxuICAgICAgICAgICAgLi4ub2JqIFxyXG4gICAgICAgIH07XHJcbiAgICB9LCBvYmopO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgKCkgPT4gKHtcclxuICAgIFNLSUxMUzogW1xyXG4gICAgICAgIGAuL1NLSUxMUy8qL2AsIFxyXG4gICAgICAgIGAuL25vZGVfbW9kdWxlcy8qL1NLSUxMUy8qL2AsXHJcbiAgICAgICAgYC4vbm9kZV9tb2R1bGVzL0AqLyovU0tJTExTLyovYFxyXG4gICAgXS5yZWR1Y2UoZ2xvYl9vYmosIHt9KVxyXG59KTtcclxuIiwiaW1wb3J0IHRvbWwgZnJvbSBcInRvbWxcIjtcclxuaW1wb3J0IGZzIGZyb20gXCJmc1wiO1xyXG5cclxuY29uc3QgZ2V0X2NvbmZpZyA9IChjb25maWdGaWxlKSA9PiB7XHJcbiAgICAvLyB2ZXJpZnkgdG9tbCBleGlzdHNcclxuICAgIGxldCByYXc7XHJcblxyXG4gICAgdHJ5IHtcclxuICAgICAgICByYXcgPSBmcy5yZWFkRmlsZVN5bmMoY29uZmlnRmlsZSwgYHV0Zi04YCk7XHJcbiAgICB9IGNhdGNoIChleGNlcHRpb24pIHtcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYENvdWxkbid0IHJlYWQgJHtjb25maWdGaWxlfS4gQXJlIHlvdSBzdXJlIHRoaXMgcGF0aCBpcyBjb3JyZWN0P2ApO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IGNvbmZpZyA9IHRvbWwucGFyc2UocmF3KTtcclxuXHJcbiAgICAvLyBoYXMgaW1wbGVtZW50ZWRcclxuICAgIGlmKGNvbmZpZy5oYXMpIHtcclxuICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICAuLi5jb25maWcuaGFzLnJlZHVjZSgob2JqLCBvdGhlcl9maWxlKSA9PiAoe1xyXG4gICAgICAgICAgICAgICAgLi4uZ2V0X2NvbmZpZyhgLi9EQUVNT05TLyR7b3RoZXJfZmlsZX0udG9tbGApLFxyXG4gICAgICAgICAgICAgICAgLi4ub2JqXHJcbiAgICAgICAgICAgIH0pLCB7fSksIFxyXG4gICAgICAgICAgICAuLi5jb25maWdcclxuICAgICAgICB9O1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICByZXR1cm4gY29uZmlnO1xyXG59O1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgZ2V0X2NvbmZpZztcclxuIiwiaW1wb3J0IGZzIGZyb20gXCJmc1wiO1xyXG5pbXBvcnQgcGF0aCBmcm9tIFwicGF0aFwiO1xyXG5cclxuaW1wb3J0IGMgZnJvbSBcImNoYWxrXCI7XHJcbmltcG9ydCBidWlsZGVycyBmcm9tIFwiLi4vcm9sbHVwL2J1aWxkZXJzLmpzXCI7XHJcbmltcG9ydCBnZXRfc2tpbGxzIGZyb20gXCIuLi9saWIvZ2V0X3NraWxscy5qc1wiO1xyXG5pbXBvcnQgZ2V0X2NvbmZpZyBmcm9tIFwiLi4vbGliL2dldF9jb25maWcuanNcIjtcclxuXHJcbi8vIE1peCBDb25maWcgRmlsZSBpbiBhbmQgcnVuIHRoZXNlIGluIG9yZGVyXHJcbmV4cG9ydCBkZWZhdWx0IChjb25maWdGaWxlKSA9PiBPYmplY3QudmFsdWVzKHtcclxuICAgIGdldF9za2lsbHMsXHJcblxyXG4gICAgZ2V0X2NvbmZpZzogKHsgY29uZmlnRmlsZSB9KSA9PiAoe1xyXG4gICAgICAgIGNvbmZpZzogZ2V0X2NvbmZpZyhjb25maWdGaWxlKVxyXG4gICAgfSksXHJcbiAgICBcclxuICAgIHNldF9uYW1lczogKHtcclxuICAgICAgICBjb25maWdGaWxlLFxyXG4gICAgfSkgPT4ge1xyXG4gICAgICAgIGNvbnN0IG5hbWUgPSBwYXRoLmJhc2VuYW1lKGNvbmZpZ0ZpbGUsIGAudG9tbGApO1xyXG5cclxuICAgICAgICBjb25zdCBwYWNrYWdlX3BhdGggPSBwYXRoLmRpcm5hbWUocGF0aC5yZXNvbHZlKGNvbmZpZ0ZpbGUpKTtcclxuICAgICAgICBjb25zdCBwYWNrYWdlX25hbWUgPSBwYWNrYWdlX3BhdGguXHJcbiAgICAgICAgICAgIHNwbGl0KHBhdGguc2VwKS5cclxuICAgICAgICAgICAgcG9wKCk7XHJcblxyXG4gICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgIHBhY2thZ2VfcGF0aCxcclxuICAgICAgICAgICAgcGFja2FnZV9uYW1lLFxyXG4gICAgICAgICAgICBuYW1lLFxyXG4gICAgICAgIH07XHJcbiAgICB9LFxyXG5cclxuICAgIHdyaXRlX2VudHJ5OiAoe1xyXG4gICAgICAgIGNvbmZpZyxcclxuICAgICAgICBuYW1lLFxyXG4gICAgICAgIFNLSUxMU1xyXG4gICAgfSkgPT4ge1xyXG4gICAgICAgIC8vIFdSSVRFIE9VVCBGSUxFXHJcbiAgICAgICAgbGV0IGVudHJ5ID0gYGA7XHJcbiAgICAgICAgY29uc3QgdHlwZSA9IGNvbmZpZy5OT0RFIFxyXG4gICAgICAgICAgICA/IGBub2RlYCBcclxuICAgICAgICAgICAgOiBgYnJvd3NlcmA7XHJcblxyXG4gICAgICAgIGNvbnN0IHdyaXRlID0gKGRhdGEpID0+IHtcclxuICAgICAgICAgICAgZW50cnkgKz0gYCR7ZGF0YX1cXHJcXG5gO1xyXG4gICAgICAgIH07XHJcbiAgICAgICAgXHJcbiAgICAgICAgd3JpdGUoYGltcG9ydCBpc2VrYWkgZnJvbSBcImlzZWthaVwiO2ApO1xyXG4gICAgICAgIHdyaXRlKGBpc2VrYWkuU0VUKCR7SlNPTi5zdHJpbmdpZnkoY29uZmlnKX0pO2ApO1xyXG4gICAgICAgIHdyaXRlKGBgKTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgY29uc3QgZmFpbHMgPSBbXTtcclxuICAgICAgICBjb25zdCBlcXVpcGVkID0gT2JqZWN0LmtleXMoY29uZmlnKS5cclxuICAgICAgICAgICAgZmlsdGVyKChrZXkpID0+IHtcclxuICAgICAgICAgICAgICAgIGNvbnN0IGlzX3VwcGVyID0ga2V5ID09PSBrZXkudG9VcHBlckNhc2UoKTtcclxuICAgICAgICAgICAgICAgIGlmKCFpc191cHBlcikge1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICBjb25zdCBoYXNfc2tpbGwgPSBTS0lMTFNba2V5XSAhPT0gdW5kZWZpbmVkO1xyXG5cclxuICAgICAgICAgICAgICAgIGNvbnN0IGlzX3RhcmdldCA9IFsgYEJST1dTRVJgLCBgTk9ERWAgXS5pbmRleE9mKGtleSkgIT09IC0xO1xyXG5cclxuICAgICAgICAgICAgICAgIGlmKCFoYXNfc2tpbGwgJiYgIWlzX3RhcmdldCkge1xyXG4gICAgICAgICAgICAgICAgICAgIGZhaWxzLnB1c2goa2V5KTtcclxuICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICByZXR1cm4gaXNfdXBwZXIgJiYgaGFzX3NraWxsO1xyXG4gICAgICAgICAgICB9KS5cclxuICAgICAgICAgICAgbWFwKChrZXkpID0+IHtcclxuICAgICAgICAgICAgICAgIGNvbnN0IHdoZXJlID0gU0tJTExTW2tleV0gPT09IGBgXHJcbiAgICAgICAgICAgICAgICAgICAgPyBgLi5gXHJcbiAgICAgICAgICAgICAgICAgICAgOiBgLi4vJHtTS0lMTFNba2V5XS5zcGxpdChwYXRoLnNlcCkuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGpvaW4oYC9gKX1gO1xyXG5cclxuICAgICAgICAgICAgICAgIHdyaXRlKGBpbXBvcnQgJHtrZXl9IGZyb20gXCIke3doZXJlfS9TS0lMTFMvJHtrZXl9LyR7dHlwZX0uanNcIjtgKTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICByZXR1cm4ga2V5O1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgY29uc3QgZmFpbGVkID0gZmFpbHMubGVuZ3RoID4gMFxyXG4gICAgICAgICAgICA/IGBGQUlMRUQgVE8gRklORFxcclxcbiR7ZmFpbHMubWFwKChmKSA9PiBgWyR7Zn1dYCkuXHJcbiAgICAgICAgICAgICAgICBqb2luKGAgeCBgKX1gXHJcbiAgICAgICAgICAgIDogYGA7XHJcblxyXG4gICAgICAgIGNvbnN0IGtleXMgPSBlcXVpcGVkLnJlZHVjZSgob3V0cHV0LCBrZXkpID0+IGAke291dHB1dH0gICAgJHtrZXl9LFxcclxcbmAsIGBgKTtcclxuXHJcbiAgICAgICAgd3JpdGUoYFxyXG5pc2VrYWkuRVFVSVAoe1xcclxcbiR7a2V5c319KTtgKTtcclxuXHJcbiAgICAgICAgY29uc3QgQklOID0gYC5CSU5gO1xyXG4gICAgICAgIGNvbnN0IGlucHV0ID0gcGF0aC5qb2luKEJJTiwgYCR7bmFtZX0uZW50cnkuanNgKTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgaWYgKCFmcy5leGlzdHNTeW5jKEJJTikpIHtcclxuICAgICAgICAgICAgY29uc29sZS5sb2coYENSRUFUSU5HICR7QklOfWApO1xyXG4gICAgICAgICAgICBmcy5ta2RpclN5bmMoQklOKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgLy8gd3JpdGUgb3V0IHRoZWlyIGluZGV4LmpzXHJcbiAgICAgICAgZnMud3JpdGVGaWxlU3luYyhpbnB1dCwgZW50cnksIGB1dGYtOGApO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICBjb25zb2xlLmxvZyhgXHJcblske25hbWV9XVske3R5cGV9XVxyXG5cclxuU0tJTExTXHJcbiR7Yy5ibHVlQnJpZ2h0KGVxdWlwZWQubWFwKChlKSA9PiBgWyR7ZX1dYCkuXHJcbiAgICAgICAgam9pbihgICsgYCkpfVxyXG5cclxuJHtjLnJlZChmYWlsZWQpfVxyXG5gKTtcclxuXHJcbiAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgaW5wdXRcclxuICAgICAgICB9O1xyXG4gICAgfSxcclxuXHJcbiAgICBydW5fYnVpbGRlcnM6ICh7XHJcbiAgICAgICAgaW5wdXQsXHJcbiAgICAgICAgbmFtZSxcclxuICAgICAgICBjb25maWcsXHJcbiAgICB9KSA9PiB7XHJcbiAgICAgICAgY29uc3QgdGFyZ2V0ID0gY29uZmlnLk5PREUgXHJcbiAgICAgICAgICAgID8gYE5PREVgIFxyXG4gICAgICAgICAgICA6IGBCUk9XU0VSYDtcclxuXHJcbiAgICAgICAgY29uc3Qgb3V0cHV0ID0gYC5CSU4vJHtuYW1lfS4ke3RhcmdldH0uanNgO1xyXG5cclxuICAgICAgICBpZihjb25maWcuTk9ERSAmJiBjb25maWcuQlJPV1NFUikge1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFlvdSBjYW5ub3QgdGFyZ2V0IGJvdGggW05PREVdIGFuZCBbQlJPV1NFUl1gKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmKGNvbmZpZy5OT0RFKSB7ICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgICAgICBvdXRwdXQsXHJcbiAgICAgICAgICAgICAgICBidWlsZF9pbmZvOiBidWlsZGVycy5ub2RlKHtcclxuICAgICAgICAgICAgICAgICAgICBpbnB1dCxcclxuICAgICAgICAgICAgICAgICAgICBvdXRwdXRcclxuICAgICAgICAgICAgICAgIH0pXHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIGlmKGNvbmZpZy5CUk9XU0VSKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgICAgICBvdXRwdXQsXHJcbiAgICAgICAgICAgICAgICBidWlsZF9pbmZvOiBidWlsZGVycy5icm93c2VyKHtcclxuICAgICAgICAgICAgICAgICAgICBpbnB1dCxcclxuICAgICAgICAgICAgICAgICAgICBvdXRwdXRcclxuICAgICAgICAgICAgICAgIH0pXHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFlvdSBtdXN0IHNwZWNpZnkgZWl0aGVyIFtOT0RFXSBvciBbQlJPV1NFUl0gZm9yIHlvdXIgdGFyZ2V0IGluIHlvdXIgW0RBRU1PTl0gdG9tbGApO1xyXG4gICAgfVxyXG59KS5cclxuICAgIHJlZHVjZSgoc3RhdGUsIGZuKSA9PiAoe1xyXG4gICAgICAgIC4uLnN0YXRlLFxyXG4gICAgICAgIC4uLmZuKHN0YXRlKVxyXG4gICAgfSksIHsgY29uZmlnRmlsZSB9KTtcclxuIiwiaW1wb3J0IGdsb2IgZnJvbSBcImdsb2JcIjtcclxuaW1wb3J0IHBhdGggZnJvbSBcInBhdGhcIjtcclxuXHJcbmV4cG9ydCBkZWZhdWx0ICgpID0+IGdsb2Iuc3luYyhgLi9EQUVNT05TLyoudG9tbGApLlxyXG4gICAgbWFwKChjbGFzc19wYXRoKSA9PiBwYXRoLmJhc2VuYW1lKGNsYXNzX3BhdGgsIGAudG9tbGApKTsiLCJpbXBvcnQgZ2V0X2xpc3QgZnJvbSBcIi4vZ2V0X2xpc3QuanNcIjtcclxuXHJcbmV4cG9ydCBkZWZhdWx0IChjbGFzc2VzKSA9PiBjbGFzc2VzLmZpbHRlcigodGFyZ2V0KSA9PiB7XHJcbiAgICBjb25zdCBpc19va2F5ID0gZ2V0X2xpc3QoKS5cclxuICAgICAgICBpbmRleE9mKHRhcmdldCkgIT09IC0xO1xyXG5cclxuICAgIGlmKCFpc19va2F5KSB7XHJcbiAgICAgICAgY29uc29sZS5sb2coYCR7dGFyZ2V0fSBpcyBub3QgYW4gYXZhaWxhYmxlIFtEQUVNT05dYCk7XHJcbiAgICB9XHJcbiAgICAgICAgXHJcbiAgICByZXR1cm4gaXNfb2theTtcclxufSk7XHJcbiIsImltcG9ydCBnZXRfbGlzdCBmcm9tIFwiLi4vbGliL2dldF9saXN0LmpzXCI7XHJcbmltcG9ydCBmaWx0ZXJfbGlzdCBmcm9tIFwiLi4vbGliL2ZpbHRlcl9saXN0LmpzXCI7XHJcblxyXG5leHBvcnQgZGVmYXVsdCAoe1xyXG4gICAgY21kLFxyXG4gICAgREFFTU9OU1xyXG59KSA9PiB7XHJcbiAgICBpZighREFFTU9OUykge1xyXG4gICAgICAgIHJldHVybiBjbWQucHJvbXB0KHtcclxuICAgICAgICAgICAgdHlwZTogYGxpc3RgLFxyXG4gICAgICAgICAgICBuYW1lOiBgREFFTU9OYCxcclxuICAgICAgICAgICAgbWVzc2FnZTogYFdoaWNoIFtEQUVNT05dP2AsXHJcbiAgICAgICAgICAgIGNob2ljZXM6IFsgYGFsbGAsIC4uLmdldF9saXN0KCkgXVxyXG4gICAgICAgIH0pLlxyXG4gICAgICAgICAgICB0aGVuKCh7IERBRU1PTiB9KSA9PiB7XHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhEQUVNT04sIGBEQUVNT05gKTtcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIERBRU1PTiA9PT0gYGFsbGAgXHJcbiAgICAgICAgICAgICAgICAgICAgPyBnZXRfbGlzdCgpIFxyXG4gICAgICAgICAgICAgICAgICAgIDogZmlsdGVyX2xpc3QoWyBEQUVNT04gXSk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICBpZihEQUVNT05TWzBdID09PSBgYWxsYCkge1xyXG4gICAgICAgIHJldHVybiBnZXRfbGlzdCgpO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiBmaWx0ZXJfbGlzdChEQUVNT05TKTtcclxufTsiLCJpbXBvcnQgdG9tbF90b19qcyBmcm9tIFwiLi4vdHJhbnNmb3Jtcy90b21sX3RvX2pzLmpzXCI7XHJcbmltcG9ydCByb2xsdXAgZnJvbSBcInJvbGx1cFwiO1xyXG5cclxuaW1wb3J0IHByb21wdF9kYWVtb25zIGZyb20gXCIuLi9saWIvcHJvbXB0X2RhZW1vbnMuanNcIjtcclxuXHJcbmV4cG9ydCBkZWZhdWx0ICh7XHJcbiAgICBjb21tYW5kOiBgYnVpbGQgW0RBRU1PTlMuLi5dYCxcclxuICAgIGhlbHA6IGBidWlsZCBhbGwgW0RBRU1PTl0gc2F2ZShzKS5gLFxyXG4gICAgaGlkZGVuOiB0cnVlLFxyXG4gICAgYXN5bmMgaGFuZGxlcih7IERBRU1PTlMgfSkge1xyXG4gICAgICAgIGNvbnN0IERBRU1PTnMgPSBhd2FpdCBwcm9tcHRfZGFlbW9ucyh7IFxyXG4gICAgICAgICAgICBjbWQ6IHRoaXMsXHJcbiAgICAgICAgICAgIERBRU1PTlMgXHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIGNvbnN0IGJ1aWx0ID0gYXdhaXQgUHJvbWlzZS5hbGwoREFFTU9Ocy5tYXAoYXN5bmMgKHRhcmdldCkgPT4ge1xyXG4gICAgICAgICAgICBjb25zdCB7IGJ1aWxkX2luZm8sIG5hbWUgfSA9IGF3YWl0IHRvbWxfdG9fanMoYC4vREFFTU9OUy8ke3RhcmdldH0udG9tbGApO1xyXG4gICAgICAgICAgICBjb25zdCBidW5kbGUgPSBhd2FpdCByb2xsdXAucm9sbHVwKGJ1aWxkX2luZm8pO1xyXG5cclxuICAgICAgICAgICAgYXdhaXQgYnVuZGxlLndyaXRlKGJ1aWxkX2luZm8ub3V0cHV0KTtcclxuICAgICAgICAgICAgY29uc29sZS5sb2coYFske25hbWV9XSBCdWlsZCBDb21wbGV0ZS5cXHJcXG5gKTtcclxuICAgICAgICB9KSk7XHJcblxyXG4gICAgICAgIGNvbnNvbGUubG9nKGBCdWlsdCAke2J1aWx0Lmxlbmd0aH0gW0RBRU1PTl0ocykuYCk7XHJcbiAgICB9XHJcbn0pOyIsImltcG9ydCBHaXQgZnJvbSBcInNpbXBsZS1naXQvcHJvbWlzZVwiO1xyXG5cclxuY29uc3QgZ2l0ID0gR2l0KCk7XHJcblxyXG5leHBvcnQgZGVmYXVsdCAoe1xyXG4gICAgY29tbWFuZDogYGNvbW1pdCBbbWVzc2FnZS4uLl1gLFxyXG4gICAgaGVscDogYGNvbW1pdCBjdXJyZW50IGZpbGVzIHRvIHNvdXJjZSBjb250cm9sYCxcclxuICAgIGhhbmRsZXI6ICh7XHJcbiAgICAgICAgbWVzc2FnZSA9IFsgYFVwZGF0ZSwgbm8gY29tbWl0IG1lc3NhZ2VgIF1cclxuICAgIH0pID0+IGdpdC5hZGQoWyBgLmAgXSkuXHJcbiAgICAgICAgdGhlbigoKSA9PiBnaXQuY29tbWl0KG1lc3NhZ2Uuam9pbihgIGApKSkuXHJcbiAgICAgICAgdGhlbigoKSA9PiBnaXQucHVzaChgb3JpZ2luYCwgYG1hc3RlcmApKS5cclxuICAgICAgICB0aGVuKCgpID0+IGNvbnNvbGUubG9nKGBDb21taXRlZCB3aXRoIG1lc3NhZ2UgJHttZXNzYWdlLmpvaW4oYCBgKX1gKSlcclxufSk7XHJcbiIsImltcG9ydCBkZWdpdCBmcm9tIFwiZGVnaXRcIjtcclxuaW1wb3J0IHsgZXhlYyB9IGZyb20gXCJjaGlsZF9wcm9jZXNzXCI7XHJcbmltcG9ydCBHaXQgZnJvbSBcInNpbXBsZS1naXQvcHJvbWlzZVwiO1xyXG5cclxuY29uc3QgZ2l0ID0gR2l0KCk7XHJcblxyXG5leHBvcnQgZGVmYXVsdCAoe1xyXG4gICAgY29tbWFuZDogYGNyZWF0ZSBbdGVtcGxhdGVdIFtuYW1lXWAsXHJcbiAgICBoZWxwOiBgQ3JlYXRlIGEgbmV3IGlzZWthaSBwcm9qZWN0IGZyb20gW3RlbXBsYXRlXSBvciBAaXNla2FpL3RlbXBsYXRlYCxcclxuICAgIGFsaWFzOiBbIGBpbml0YCBdLFxyXG4gICAgb3B0aW9uczoge1xyXG4gICAgICAgIFwiLWYsIC0tZm9yY2VcIjogYGZvcmNlIG92ZXJ3cml0ZSBmcm9tIHRlbXBsYXRlYFxyXG4gICAgfSxcclxuICAgIGhhbmRsZXI6ICh7XHJcbiAgICAgICAgdGVtcGxhdGUgPSBgaXNla2FpLWRldi90ZW1wbGF0ZWAsXHJcbiAgICAgICAgbmFtZSA9IGAuYCxcclxuICAgICAgICBvcHRpb25zOiB7XHJcbiAgICAgICAgICAgIGZvcmNlID0gZmFsc2VcclxuICAgICAgICB9ID0gZmFsc2VcclxuICAgIH0pID0+IGRlZ2l0KHRlbXBsYXRlLCB7IGZvcmNlIH0pLlxyXG4gICAgICAgIGNsb25lKG5hbWUpLlxyXG4gICAgICAgIHRoZW4oKCkgPT4gZ2l0LmluaXQoKSkuXHJcbiAgICAgICAgdGhlbigoKSA9PiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGAke3RlbXBsYXRlfSBjb3BpZWQgdG8gJHtuYW1lfWApO1xyXG4gICAgICAgICAgICBjb25zb2xlLmxvZyhgSU5TVEFMTElORzogVEhJUyBNQVkgVEFLRSBBV0hJTEVgKTtcclxuICAgICAgICAgICAgZXhlYyhgbnBtIGluc3RhbGxgLCAoZXJyKSA9PiB7XHJcbiAgICAgICAgICAgICAgICBpZihlcnIpIHtcclxuICAgICAgICAgICAgICAgICAgICByZWplY3QoZXJyKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIHJlc29sdmUoKTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfSkpLlxyXG4gICAgICAgIHRoZW4oKCkgPT4ge1xyXG4gICAgICAgICAgICBjb25zb2xlLmxvZyhgQ09NUExFVEU6IFtydW5dIHRvIHN0YXJ0IHlvdXIgREFFTU9Ocy5gKTtcclxuICAgICAgICB9KVxyXG59KTsiLCJpbXBvcnQgZ2V0X2xpc3QgZnJvbSBcIi4uL2xpYi9nZXRfbGlzdC5qc1wiO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgKHtcclxuICAgIGhlbHA6IGBTaG93IGF2YWlsYWJsZSBbREFFTU9OXSBzYXZlcy5gLFxyXG4gICAgYWxpYXM6IFsgYGxzYCwgYHNhdmVzYCBdLFxyXG4gICAgaGFuZGxlcjogKGFyZ3MsIGNiKSA9PiB7XHJcbiAgICAgICAgY29uc29sZS5sb2coZ2V0X2xpc3QoKS5cclxuICAgICAgICAgICAgbWFwKChpKSA9PiBgWyR7aX1dYCkuXHJcbiAgICAgICAgICAgIGpvaW4oYCAtIGApLCBgXFxyXFxuYCk7ICAgIFxyXG4gICAgICAgICAgICBcclxuICAgICAgICBjYigpO1xyXG4gICAgfVxyXG59KTsiLCIvLyBwaXBlIG91dCB0byBwbTJcclxuaW1wb3J0IHsgc3Bhd24gfSBmcm9tIFwiY2hpbGRfcHJvY2Vzc1wiO1xyXG5pbXBvcnQgcGF0aCBmcm9tIFwicGF0aFwiO1xyXG5cclxuY29uc3QgcG0yX3BhdGggPSBwYXRoLmRpcm5hbWUocmVxdWlyZS5yZXNvbHZlKGBwbTJgKSk7XHJcblxyXG5leHBvcnQgZGVmYXVsdCAoeyBjb21tYW5kcyB9KSA9PiB7XHJcbiAgICBsZXQgbm9kZSA9IHNwYXduKGBub2RlYCwgYCR7cG0yX3BhdGh9L2Jpbi9wbTIgJHtjb21tYW5kcy5qb2luKGAgYCl9YC5zcGxpdChgIGApLCB7XHJcbiAgICAgICAgY3dkOiBwcm9jZXNzLmN3ZCgpLFxyXG4gICAgICAgIGVudjogcHJvY2Vzcy5lbnYsXHJcbiAgICAgICAgc3RkaW86IGBpbmhlcml0YFxyXG4gICAgfSk7XHJcblxyXG4gICAgcmV0dXJuIHtcclxuICAgICAgICBkb25lOiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xyXG4gICAgICAgICAgICBub2RlLm9uKGBjbG9zZWAsICgpID0+IHtcclxuICAgICAgICAgICAgICAgIHJlc29sdmUoKTtcclxuICAgICAgICAgICAgICAgIG5vZGUgPSBmYWxzZTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfSksXHJcblxyXG4gICAgICAgIGNhbmNlbDogKCkgPT4ge1xyXG4gICAgICAgICAgICBpZighbm9kZSkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICB9XHJcbiAgICBcclxuICAgICAgICAgICAgbm9kZS5raWxsKCk7XHJcbiAgICAgICAgfSAgIFxyXG4gICAgfTtcclxufTtcclxuIiwiaW1wb3J0IHBtMiBmcm9tIFwiLi4vbGliL3BtMi5qc1wiO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgKHtcclxuICAgIGNvbW1hbmQ6IGBsb2dzIFtEQUVNT05TLi4uXWAsXHJcbiAgICBoZWxwOiBgZm9sbG93IHRoZSBhY3RpdmUgW0RBRU1PTl0gbG9nc2AsXHJcbiAgICBoYW5kbGVyOiAoeyBEQUVNT05TID0gW10gfSkgPT4gcG0yKHtcclxuICAgICAgICBjb21tYW5kczogWyBgbG9nc2AsIC4uLkRBRU1PTlMgXVxyXG4gICAgfSkuZG9uZVxyXG4gICAgXHJcbn0pOyIsImltcG9ydCBHaXQgZnJvbSBcInNpbXBsZS1naXQvcHJvbWlzZVwiO1xyXG5pbXBvcnQgeyBleGVjIH0gZnJvbSBcImNoaWxkX3Byb2Nlc3NcIjtcclxuXHJcbmNvbnN0IGdpdCA9IEdpdCgpO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgKHtcclxuICAgIGNvbW1hbmQ6IGBwdWxsYCxcclxuICAgIGhlbHA6IGBnZXQgY3VycmVudCBmaWxlcyBmcm9tIHNvdXJjZSBjb250cm9sYCxcclxuICAgIGhhbmRsZXI6ICgpID0+IGdpdC5wdWxsKGBvcmlnaW5gLCBgbWFzdGVyYCkuXHJcbiAgICAgICAgdGhlbigoKSA9PiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XHJcbiAgICAgICAgICAgIGV4ZWMoYG5wbSBpbnN0YWxsYCwgKGVycikgPT4ge1xyXG4gICAgICAgICAgICAgICAgaWYoZXJyKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmVqZWN0KGVycik7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICByZXNvbHZlKCk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0pKS5cclxuICAgICAgICB0aGVuKCgpID0+IGNvbnNvbGUubG9nKGBQdWxsZWQgbGF0ZXN0IGZyb20gc291cmNlIGNvbnRyb2wuYCkpXHJcbn0pO1xyXG4iLCJpbXBvcnQgZmV0Y2ggZnJvbSBcIm5vZGUtZmV0Y2hcIjtcclxuaW1wb3J0IGdsb2IgZnJvbSBcImdsb2JcIjtcclxuaW1wb3J0IGdldF9jb25maWcgZnJvbSBcIi4uL2xpYi9nZXRfY29uZmlnLmpzXCI7XHJcblxyXG4vLyBUT0RPOiBUaGlzIHNob3VsZCByZWFsbHkgYmUgZXhwb3NlZCBieSBpc2VrYWkgY29yZSBzb21lIGhvdy4gTGlrZSBhIHdheSB0byBhZGQgaW4gdG9vbHNcclxuZXhwb3J0IGRlZmF1bHQgKHtcclxuICAgIGNvbW1hbmQ6IGBwdXNoYCxcclxuICAgIGFsaWFzOiBbIGBwdWJsaXNoYCBdLFxyXG4gICAgYXN5bmMgaGFuZGxlcigpIHtcclxuICAgICAgICBhd2FpdCBQcm9taXNlLmFsbChnbG9iLnN5bmMoYC4vREFFTU9OUy8qLnRvbWxgKS5cclxuICAgICAgICAgICAgbWFwKChEQUVNT04pID0+IHtcclxuICAgICAgICAgICAgICAgIGNvbnN0IHsgQURNSU4gfSA9IGdldF9jb25maWcoREFFTU9OKTtcclxuICAgICAgICAgICAgICAgIGlmKEFETUlOICYmIEFETUlOLnphbGdvKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgeyBcclxuICAgICAgICAgICAgICAgICAgICAgICAgdXJsID0gYGh0dHA6Ly9sb2NhbGhvc3Q6ODA4MGAsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHphbGdvIFxyXG4gICAgICAgICAgICAgICAgICAgIH0gPSBBRE1JTjtcclxuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgUFVTSElORyBbJHtEQUVNT059XSAtICR7dXJsfWApO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmV0Y2goYCR7dXJsfS96YWxnb2AsIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgbWV0aG9kOiBgUE9TVGAsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhY2hlOiBgbm8tY2FjaGVgLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBoZWFkZXJzOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBcIkNvbnRlbnQtVHlwZVwiOiBgYXBwbGljYXRpb24vanNvbmBcclxuICAgICAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoe1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgemFsZ29cclxuICAgICAgICAgICAgICAgICAgICAgICAgfSlcclxuICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XHJcbiAgICAgICAgICAgIH0pKTtcclxuXHJcbiAgICB9XHJcbn0pOyIsImltcG9ydCBnZXRfc2tpbGxzIGZyb20gXCIuLi9saWIvZ2V0X3NraWxscy5qc1wiO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgKHtcclxuICAgIGNvbW1hbmQ6IGBza2lsbHNgLFxyXG4gICAgaGVscDogYExpc3QgYXZhaWxhYmxlIHNraWxsc2AsXHJcblxyXG4gICAgaGFuZGxlcjogKCkgPT4ge1xyXG4gICAgICAgIGNvbnN0IHtcclxuICAgICAgICAgICAgU0hPUCxcclxuICAgICAgICAgICAgU0tJTExTXHJcbiAgICAgICAgfSA9IGdldF9za2lsbHMoKTtcclxuXHJcbiAgICAgICAgY29uc29sZS5sb2coYFxyXG5TSE9QXHJcbiR7T2JqZWN0LmtleXMoU0hPUCkuXHJcbiAgICAgICAgbWFwKChzKSA9PiBgWyR7c31dYCkuXHJcbiAgICAgICAgam9pbihgID0gYCl9XHJcblxyXG5TS0lMTFNcclxuJHtPYmplY3Qua2V5cyhTS0lMTFMpLlxyXG4gICAgICAgIG1hcCgocykgPT4gYFske3N9XWApLlxyXG4gICAgICAgIGpvaW4oYCBvIGApfVxyXG5gKTtcclxuICAgIH1cclxufSk7IiwiaW1wb3J0IHBtMiBmcm9tIFwicG0yXCI7XHJcblxyXG5pbXBvcnQgdG9tbF90b19qcyBmcm9tIFwiLi4vdHJhbnNmb3Jtcy90b21sX3RvX2pzLmpzXCI7XHJcblxyXG5pbXBvcnQgcHJvbXB0X2RhZW1vbnMgZnJvbSBcIi4uL2xpYi9wcm9tcHRfZGFlbW9ucy5qc1wiO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgKHtcclxuICAgIGNvbW1hbmRlcjogYHNwYXduIFtEQUVNT05TLi4uXWAsXHJcbiAgICBoZWxwOiBgc3Bhd24gW0RBRU1PTlNdIGZpbGVzYCxcclxuICAgIGhpZGRlbjogdHJ1ZSxcclxuICAgIGFzeW5jIGhhbmRsZXIoeyBEQUVNT05TIH0pIHtcclxuICAgICAgICBjb25zdCBEQUVNT05zID0gYXdhaXQgcHJvbXB0X2RhZW1vbnMoe1xyXG4gICAgICAgICAgICBjbWQ6IHRoaXMsXHJcbiAgICAgICAgICAgIERBRU1PTlNcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgREFFTU9Ocy5mb3JFYWNoKChEQUVNT04pID0+IHtcclxuICAgICAgICAgICAgY29uc3Qge1xyXG4gICAgICAgICAgICAgICAgb3V0cHV0LFxyXG4gICAgICAgICAgICB9ID0gdG9tbF90b19qcyhgLi9EQUVNT05TLyR7REFFTU9OfS50b21sYCk7XHJcblxyXG4gICAgICAgICAgICAvLyBIQUNLOiBjb3VsZCBuYW1lIHRoZSBmaWxlIG9mIHRoZSBUT01MIHNvbWV0aGluZyBnbmFybHlcclxuICAgICAgICAgICAgcG0yLnN0YXJ0KHtcclxuICAgICAgICAgICAgICAgIG5hbWU6IERBRU1PTixcclxuICAgICAgICAgICAgICAgIHNjcmlwdDogb3V0cHV0LFxyXG4gICAgICAgICAgICAgICAgd2F0Y2g6IGAuLyR7b3V0cHV0fWAsXHJcbiAgICAgICAgICAgICAgICBmb3JjZTogdHJ1ZSxcclxuICAgICAgICAgICAgICAgIHdhdGNoX29wdGlvbnM6IHtcclxuICAgICAgICAgICAgICAgICAgICAvLyB5dXAgUE0yIHdhcyBzZXR0aW5nIGEgZGVmYXVsdCBpZ25vcmVcclxuICAgICAgICAgICAgICAgICAgICBpZ25vcmVkOiBgYCxcclxuICAgICAgICAgICAgICAgICAgICB1c2VQb2xsaW5nOiB0cnVlXHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgbWF4X3Jlc3RhcnQ6IDBcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcbn0pO1xyXG4iLCJleHBvcnQgZGVmYXVsdCAoXHJcbiAgICBhY3Rpb25fbWFwLCBcclxuICAgIHJlZHVjZXIgPSAoaSkgPT4gaVxyXG4pID0+IChpbnB1dCkgPT4ge1xyXG4gICAgY29uc3Qga2V5ID0gcmVkdWNlcihpbnB1dCk7XHJcblxyXG4gICAgaWYoIWFjdGlvbl9tYXBba2V5XSkge1xyXG4gICAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gYWN0aW9uX21hcFtrZXldKGlucHV0KTtcclxufTsiLCJpbXBvcnQgY2hva2lkYXIgZnJvbSBcImNob2tpZGFyXCI7XHJcbmltcG9ydCByb2xsdXAgZnJvbSBcInJvbGx1cFwiO1xyXG5pbXBvcnQgYyBmcm9tIFwiY2hhbGtcIjtcclxuXHJcbmltcG9ydCB0b21sX3RvX2pzIGZyb20gXCIuLi90cmFuc2Zvcm1zL3RvbWxfdG9fanMuanNcIjtcclxuXHJcbmltcG9ydCBhY3Rpb24gZnJvbSBcIi4uL2xpYi9hY3Rpb24uanNcIjtcclxuaW1wb3J0IHByb21wdF9kYWVtb25zIGZyb20gXCIuLi9saWIvcHJvbXB0X2RhZW1vbnMuanNcIjtcclxuXHJcbmV4cG9ydCBkZWZhdWx0ICh7XHJcbiAgICBjb21tYW5kOiBgbG9hZCBbREFFTU9OUy4uLl1gLFxyXG4gICAgaGVscDogYGxvYWQgW0RBRU1PTl0gc2F2ZXNgLFxyXG4gICAgYWxpYXM6IFsgYHJlZ2VuZXJhdGVgLCBgcmVjcmVhdGVgLCBgd2F0Y2hgIF0sXHJcbiAgICBoaWRkZW46IHRydWUsXHJcbiAgICBjYW5jZWwgKCkge1xyXG4gICAgICAgIHRoaXMud2F0Y2hlcnMuZm9yRWFjaCgod2F0Y2hlcikgPT4gd2F0Y2hlci5jbG9zZSgpKTtcclxuICAgICAgICBjb25zb2xlLmxvZyhgWU9VUiBXQVRDSCBIQVMgRU5ERURgKTtcclxuICAgIH0sXHJcbiAgICBhc3luYyBoYW5kbGVyKHsgREFFTU9OUyB9KSB7XHJcbiAgICAgICAgdGhpcy53YXRjaGVycyA9IFtdO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICBjb25zdCBEQUVNT05zID0gYXdhaXQgcHJvbXB0X2RhZW1vbnMoe1xyXG4gICAgICAgICAgICBjbWQ6IHRoaXMsXHJcbiAgICAgICAgICAgIERBRU1PTlNcclxuICAgICAgICB9KTtcclxuICAgICAgICBcclxuICAgICAgICBEQUVNT05zLmZvckVhY2goKHRhcmdldCkgPT4ge1xyXG4gICAgICAgICAgICBjb25zdCBmaWxlX3BhdGggPSBgLi9EQUVNT05TLyR7dGFyZ2V0fS50b21sYDtcclxuXHJcbiAgICAgICAgICAgIGNvbnN0IGRhdGEgPSB0b21sX3RvX2pzKGZpbGVfcGF0aCk7XHJcblxyXG4gICAgICAgICAgICBjb25zdCB7IGJ1aWxkX2luZm8gfSA9IGRhdGE7XHJcbiAgICAgICAgXHJcbiAgICAgICAgICAgIC8vIHJlYnVpbGQgb24gZmlsZSBjaGFnbmVcclxuICAgICAgICAgICAgY29uc3Qgd2F0Y2hlciA9IGNob2tpZGFyLndhdGNoKGZpbGVfcGF0aCk7XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgd2F0Y2hlci5vbihgY2hhbmdlYCwgKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgdG9tbF90b19qcyhmaWxlX3BhdGgpO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICB0aGlzLndhdGNoZXJzLnB1c2god2F0Y2hlcik7XHJcblxyXG4gICAgICAgICAgICBjb25zdCByb2xsdXBfd2F0Y2hlciA9IHJvbGx1cC53YXRjaCh7XHJcbiAgICAgICAgICAgICAgICAuLi5idWlsZF9pbmZvLFxyXG4gICAgICAgICAgICAgICAgd2F0Y2g6IHtcclxuICAgICAgICAgICAgICAgICAgICBjbGVhclNjcmVlbjogdHJ1ZVxyXG4gICAgICAgICAgICAgICAgfSAgIFxyXG4gICAgICAgICAgICB9KS5cclxuICAgICAgICAgICAgICAgIG9uKGBldmVudGAsIGFjdGlvbih7XHJcbiAgICAgICAgICAgICAgICAgICAgRVJST1I6IChlKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGUpO1xyXG4gICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgRkFUQUw6ICh7IGVycm9yIH0pID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihjLnJlZC5ib2xkKGVycm9yKSk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfSwgKHsgY29kZSB9KSA9PiBjb2RlIFxyXG4gICAgICAgICAgICAgICAgKSk7XHJcblxyXG4gICAgICAgICAgICB0aGlzLndhdGNoZXJzLnB1c2gocm9sbHVwX3dhdGNoZXIpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG59KTtcclxuIiwiaW1wb3J0IHBtMiBmcm9tIFwiLi4vbGliL3BtMi5qc1wiO1xyXG5pbXBvcnQgZ2V0X2xpc3QgZnJvbSBcIi4uL2xpYi9nZXRfbGlzdC5qc1wiO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgKHtcclxuICAgIGNvbW1hbmQ6IGBzdG9wIFtEQUVNT05TLi4uXWAsXHJcbiAgICBoZWxwOiBgc3RvcCBhY3RpdmUgW0RBRU1PTl0gZmlsZXMuIGAsIFxyXG4gICAgYWxpYXM6IFtgdW5zdW1tb25gLCBga2lsbGBdLFxyXG4gICAgY2FuY2VsKCkge1xyXG4gICAgICAgIHRoaXMuY2FuY2VsZXIoKTtcclxuICAgIH0sXHJcbiAgICBcclxuICAgIGhhbmRsZXIoeyBEQUVNT05TID0gZ2V0X2xpc3QoKSB9ID0gZmFsc2UpIHtcclxuICAgICAgICBjb25zdCB3aG9tID0gREFFTU9OUy5tYXAoKGNoYXIpID0+IGBbJHtjaGFyfV1gKS5cclxuICAgICAgICAgICAgam9pbihgIC0gYCk7XHJcblxyXG4gICAgICAgIGNvbnNvbGUubG9nKGBTVE9QUElORyAke3dob219YCk7XHJcblxyXG4gICAgICAgIGNvbnN0IHsgY2FuY2VsLCBkb25lIH0gPSBwbTIoe1xyXG4gICAgICAgICAgICBjb21tYW5kczogWyBgZGVsZXRlYCwgYGFsbGAgXVxyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICB0aGlzLmNhbmNlbGVyID0gY2FuY2VsO1xyXG5cclxuICAgICAgICByZXR1cm4gZG9uZTtcclxuICAgIH1cclxufSk7XHJcblxyXG4iLCJpbXBvcnQgd2F0Y2ggZnJvbSBcIi4vd2F0Y2guanNcIjtcclxuaW1wb3J0IHNwYXduIGZyb20gXCIuL3NwYXduLmpzXCI7XHJcbmltcG9ydCBwbTIgZnJvbSBcIi4uL2xpYi9wbTIuanNcIjtcclxuXHJcbmltcG9ydCBzdG9wIGZyb20gXCIuL3N0b3AuanNcIjtcclxuaW1wb3J0IHByb21wdF9kYWVtb25zIGZyb20gXCIuLi9saWIvcHJvbXB0X2RhZW1vbnMuanNcIjtcclxuXHJcbmNvbnN0IHJ1bl9kYWVtb25zID0gKHsgREFFTU9OUyB9KSA9PiB7XHJcbiAgICB3YXRjaC5oYW5kbGVyKHsgREFFTU9OUyB9KTtcclxuICAgIHNwYXduLmhhbmRsZXIoeyBEQUVNT05TIH0pO1xyXG5cclxuICAgIHJldHVybiBwbTIoe1xyXG4gICAgICAgIGNvbW1hbmRzOiBbIGBsb2dzYCBdXHJcbiAgICB9KS5kb25lO1xyXG59O1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgKHtcclxuICAgIGNvbW1hbmQ6IGBzdW1tb24gW0RBRU1PTlMuLi5dYCxcclxuICAgIGhlbHA6IGBzdW1tb24gYW5kIHdhdGNoIFtEQUVNT05TLi4uXWAsXHJcbiAgICBhbGlhczogWyBgZGV2YCwgYHN0YXJ0YCwgYHJ1bmAgXSxcclxuICAgIGFzeW5jIGhhbmRsZXIoeyBEQUVNT05TIH0pIHtcclxuICAgICAgICBjb25zdCBEQUVNT05zID0gYXdhaXQgcHJvbXB0X2RhZW1vbnMoe1xyXG4gICAgICAgICAgICBjbWQ6IHRoaXMsXHJcbiAgICAgICAgICAgIERBRU1PTlNcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgYXdhaXQgc3RvcC5oYW5kbGVyKCk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgcmV0dXJuIHJ1bl9kYWVtb25zKHsgREFFTU9OUzogREFFTU9OcyB9KTtcclxuICAgIH0sXHJcblxyXG4gICAgY2FuY2VsKCkge1xyXG4gICAgICAgIHdhdGNoLmNhbmNlbCgpO1xyXG4gICAgfVxyXG59KTtcclxuXHJcbiIsImltcG9ydCBwbTIgZnJvbSBcIi4uL2xpYi9wbTIuanNcIjtcclxuXHJcbmV4cG9ydCBkZWZhdWx0KHtcclxuICAgIGNvbW1hbmQ6IGBzdGF0dXMgW0RBRU1PTl1gLFxyXG4gICAgaGVscDogYHN0YXR1cyBvZiBhY3RpdmUgW0RBRU1PTl1zLmAsXHJcbiAgICBhbGlhczogWyBgcHNgLCBgYWN0aXZlYCwgYHN0YXRzYCBdLFxyXG4gICAgaGFuZGxlcjogKCkgPT4gcG0yKHtcclxuICAgICAgICBjb21tYW5kczogWyBgcHNgIF1cclxuICAgIH0pLmRvbmVcclxufSk7IiwiaW1wb3J0IHsgdmVyc2lvbiB9IGZyb20gXCIuLi8uLi9wYWNrYWdlLmpzb25cIjtcclxuXHJcbmV4cG9ydCBkZWZhdWx0ICh7XHJcbiAgICBjb21tYW5kOiBgdmVyc2lvbmAsXHJcbiAgICBoZWxwOiBgVmVyc2lvbiBpcyAke3ZlcnNpb259YCxcclxuICAgIGhhbmRsZXI6ICgpID0+IHtcclxuICAgICAgICBjb25zb2xlLmxvZyh2ZXJzaW9uKTtcclxuICAgIH1cclxufSk7IiwiY29uc3QgcmVzID0ge307XG5pbXBvcnQgZjAgZnJvbSBcIi9Vc2Vycy9HYW1lcy9Qcm9qZWN0cy9JU0VLQUkvc3JjL2NvbW1hbmRzL2J1aWxkLmpzXCI7XG5yZXNbXCJidWlsZFwiXSA9IGYwO1xuaW1wb3J0IGYxIGZyb20gXCIvVXNlcnMvR2FtZXMvUHJvamVjdHMvSVNFS0FJL3NyYy9jb21tYW5kcy9jb21taXQuanNcIjtcbnJlc1tcImNvbW1pdFwiXSA9IGYxO1xuaW1wb3J0IGYyIGZyb20gXCIvVXNlcnMvR2FtZXMvUHJvamVjdHMvSVNFS0FJL3NyYy9jb21tYW5kcy9jcmVhdGUuanNcIjtcbnJlc1tcImNyZWF0ZVwiXSA9IGYyO1xuaW1wb3J0IGYzIGZyb20gXCIvVXNlcnMvR2FtZXMvUHJvamVjdHMvSVNFS0FJL3NyYy9jb21tYW5kcy9kYWVtb25zLmpzXCI7XG5yZXNbXCJkYWVtb25zXCJdID0gZjM7XG5pbXBvcnQgZjQgZnJvbSBcIi9Vc2Vycy9HYW1lcy9Qcm9qZWN0cy9JU0VLQUkvc3JjL2NvbW1hbmRzL2xvZ3MuanNcIjtcbnJlc1tcImxvZ3NcIl0gPSBmNDtcbmltcG9ydCBmNSBmcm9tIFwiL1VzZXJzL0dhbWVzL1Byb2plY3RzL0lTRUtBSS9zcmMvY29tbWFuZHMvcHVsbC5qc1wiO1xucmVzW1wicHVsbFwiXSA9IGY1O1xuaW1wb3J0IGY2IGZyb20gXCIvVXNlcnMvR2FtZXMvUHJvamVjdHMvSVNFS0FJL3NyYy9jb21tYW5kcy9wdXNoLmpzXCI7XG5yZXNbXCJwdXNoXCJdID0gZjY7XG5pbXBvcnQgZjcgZnJvbSBcIi9Vc2Vycy9HYW1lcy9Qcm9qZWN0cy9JU0VLQUkvc3JjL2NvbW1hbmRzL3NraWxscy5qc1wiO1xucmVzW1wic2tpbGxzXCJdID0gZjc7XG5pbXBvcnQgZjggZnJvbSBcIi9Vc2Vycy9HYW1lcy9Qcm9qZWN0cy9JU0VLQUkvc3JjL2NvbW1hbmRzL3NwYXduLmpzXCI7XG5yZXNbXCJzcGF3blwiXSA9IGY4O1xuaW1wb3J0IGY5IGZyb20gXCIvVXNlcnMvR2FtZXMvUHJvamVjdHMvSVNFS0FJL3NyYy9jb21tYW5kcy9zdGFydC5qc1wiO1xucmVzW1wic3RhcnRcIl0gPSBmOTtcbmltcG9ydCBmMTAgZnJvbSBcIi9Vc2Vycy9HYW1lcy9Qcm9qZWN0cy9JU0VLQUkvc3JjL2NvbW1hbmRzL3N0YXR1cy5qc1wiO1xucmVzW1wic3RhdHVzXCJdID0gZjEwO1xuaW1wb3J0IGYxMSBmcm9tIFwiL1VzZXJzL0dhbWVzL1Byb2plY3RzL0lTRUtBSS9zcmMvY29tbWFuZHMvc3RvcC5qc1wiO1xucmVzW1wic3RvcFwiXSA9IGYxMTtcbmltcG9ydCBmMTIgZnJvbSBcIi9Vc2Vycy9HYW1lcy9Qcm9qZWN0cy9JU0VLQUkvc3JjL2NvbW1hbmRzL3ZlcnNpb24uanNcIjtcbnJlc1tcInZlcnNpb25cIl0gPSBmMTI7XG5pbXBvcnQgZjEzIGZyb20gXCIvVXNlcnMvR2FtZXMvUHJvamVjdHMvSVNFS0FJL3NyYy9jb21tYW5kcy93YXRjaC5qc1wiO1xucmVzW1wid2F0Y2hcIl0gPSBmMTM7XG5leHBvcnQgZGVmYXVsdCByZXM7IiwiaW1wb3J0IGMgZnJvbSBcImNoYWxrXCI7XHJcblxyXG5jb25zdCB7IGxvZyB9ID0gY29uc29sZTtcclxuXHJcbmNvbnNvbGUubG9nID0gKC4uLmFyZ3MpID0+IGxvZyhcclxuICAgIC4uLmFyZ3MubWFwKFxyXG4gICAgICAgIChpdGVtKSA9PiB0eXBlb2YgaXRlbSA9PT0gYHN0cmluZ2BcclxuICAgICAgICAgICAgPyBjLmdyZWVuKFxyXG4gICAgICAgICAgICAgICAgaXRlbS5yZXBsYWNlKC8oXFxbLlteXFxdXFxbXSpcXF0pL3VnLCBjLmJvbGQud2hpdGUoYCQxYCkpXHJcbiAgICAgICAgICAgIClcclxuICAgICAgICAgICAgOiBpdGVtXHJcbiAgICApXHJcbik7XHJcbiIsIiMhL3Vzci9iaW4vZW52IG5vZGVcclxuXHJcbmltcG9ydCB2b3JwYWwgZnJvbSBcInZvcnBhbFwiO1xyXG5pbXBvcnQgY29tbWFuZHMgZnJvbSBcIi4vY29tbWFuZHMvKi5qc1wiO1xyXG5pbXBvcnQgeyB2ZXJzaW9uIH0gZnJvbSBcIi4uL3BhY2thZ2UuanNvblwiO1xyXG5cclxuaW1wb3J0IFwiLi9saWIvZm9ybWF0LmpzXCI7XHJcblxyXG5pbXBvcnQgY2hhbGsgZnJvbSBcImNoYWxrXCI7XHJcblxyXG5jb25zdCB2ID0gdm9ycGFsKCk7XHJcblxyXG5PYmplY3QuZW50cmllcyhjb21tYW5kcykuXHJcbiAgICBmb3JFYWNoKChbXHJcbiAgICAgICAgbmFtZSwge1xyXG4gICAgICAgICAgICBoZWxwLFxyXG4gICAgICAgICAgICBoYW5kbGVyLFxyXG4gICAgICAgICAgICBhdXRvY29tcGxldGUsXHJcbiAgICAgICAgICAgIGhpZGRlbixcclxuICAgICAgICAgICAgY29tbWFuZCxcclxuICAgICAgICAgICAgYWxpYXMgPSBbXSxcclxuICAgICAgICAgICAgb3B0aW9ucyA9IHt9LFxyXG4gICAgICAgICAgICBjYW5jZWwgPSAoKSA9PiB7fVxyXG4gICAgICAgIH1cclxuICAgIF0pID0+IHsgXHJcbiAgICAgICAgY29uc3QgaXN0ID0gdi5jb21tYW5kKGNvbW1hbmQgfHwgbmFtZSwgaGVscCkuXHJcbiAgICAgICAgICAgIGFsaWFzKGFsaWFzKS5cclxuICAgICAgICAgICAgYXV0b2NvbXBsZXRlKGF1dG9jb21wbGV0ZSB8fCBbXSkuXHJcbiAgICAgICAgICAgIGNhbmNlbChjYW5jZWwpLlxyXG4gICAgICAgICAgICBhY3Rpb24oaGFuZGxlcik7XHJcblxyXG4gICAgICAgIGlmKGhpZGRlbikge1xyXG4gICAgICAgICAgICBpc3QuaGlkZGVuKCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBPYmplY3QuZW50cmllcyhvcHRpb25zKS5cclxuICAgICAgICAgICAgZm9yRWFjaCgoWyBvcHRpb24sIG9wdGlvbl9oZWxwIF0pID0+IHtcclxuICAgICAgICAgICAgICAgIGlzdC5vcHRpb24ob3B0aW9uLCBvcHRpb25faGVscCk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgfSk7XHJcblxyXG5jb25zdCBzdGFydHVwX2NvbW1hbmRzID0gcHJvY2Vzcy5hcmd2LnNsaWNlKDIpO1xyXG5cclxuaWYoc3RhcnR1cF9jb21tYW5kcy5sZW5ndGggPiAwKSB7XHJcbiAgICB2LmV4ZWMoc3RhcnR1cF9jb21tYW5kcy5qb2luKGAgYCkpO1xyXG59IGVsc2Uge1xyXG5cclxuICAgIHByb2Nlc3Muc3Rkb3V0LndyaXRlKGBcXHgxQmNgKTtcclxuXHJcbiAgICBjb25zb2xlLmxvZyhjaGFsay5ncmVlbihgXHJcbuKWiOKWiOKVl+KWiOKWiOKWiOKWiOKWiOKWiOKWiOKVl+KWiOKWiOKWiOKWiOKWiOKWiOKWiOKVl+KWiOKWiOKVlyAg4paI4paI4pWXIOKWiOKWiOKWiOKWiOKWiOKVlyDilojilojilZcgICAgICDilojilojilojilojilojilojilojilZfilojilojilojilZcgICDilojilojilZcg4paI4paI4paI4paI4paI4paI4pWXIOKWiOKWiOKVl+KWiOKWiOKWiOKVlyAgIOKWiOKWiOKVl+KWiOKWiOKWiOKWiOKWiOKWiOKWiOKVlyAgICBcclxu4paI4paI4pWR4paI4paI4pWU4pWQ4pWQ4pWQ4pWQ4pWd4paI4paI4pWU4pWQ4pWQ4pWQ4pWQ4pWd4paI4paI4pWRIOKWiOKWiOKVlOKVneKWiOKWiOKVlOKVkOKVkOKWiOKWiOKVl+KWiOKWiOKVkeKWhCDilojilojilZfiloTilojilojilZTilZDilZDilZDilZDilZ3ilojilojilojilojilZcgIOKWiOKWiOKVkeKWiOKWiOKVlOKVkOKVkOKVkOKVkOKVnSDilojilojilZHilojilojilojilojilZcgIOKWiOKWiOKVkeKWiOKWiOKVlOKVkOKVkOKVkOKVkOKVnSAgICBcclxu4paI4paI4pWR4paI4paI4paI4paI4paI4paI4paI4pWX4paI4paI4paI4paI4paI4pWXICDilojilojilojilojilojilZTilZ0g4paI4paI4paI4paI4paI4paI4paI4pWR4paI4paI4pWRIOKWiOKWiOKWiOKWiOKVl+KWiOKWiOKWiOKWiOKWiOKVlyAg4paI4paI4pWU4paI4paI4pWXIOKWiOKWiOKVkeKWiOKWiOKVkSAg4paI4paI4paI4pWX4paI4paI4pWR4paI4paI4pWU4paI4paI4pWXIOKWiOKWiOKVkeKWiOKWiOKWiOKWiOKWiOKVlyAgICAgIFxyXG7ilojilojilZHilZrilZDilZDilZDilZDilojilojilZHilojilojilZTilZDilZDilZ0gIOKWiOKWiOKVlOKVkOKWiOKWiOKVlyDilojilojilZTilZDilZDilojilojilZHilojilojilZHiloDilZrilojilojilZTiloDilojilojilZTilZDilZDilZ0gIOKWiOKWiOKVkeKVmuKWiOKWiOKVl+KWiOKWiOKVkeKWiOKWiOKVkSAgIOKWiOKWiOKVkeKWiOKWiOKVkeKWiOKWiOKVkeKVmuKWiOKWiOKVl+KWiOKWiOKVkeKWiOKWiOKVlOKVkOKVkOKVnSAgICAgIFxyXG7ilojilojilZHilojilojilojilojilojilojilojilZHilojilojilojilojilojilojilojilZfilojilojilZEgIOKWiOKWiOKVl+KWiOKWiOKVkSAg4paI4paI4pWR4paI4paI4pWRICDilZrilZDilZ0g4paI4paI4paI4paI4paI4paI4paI4pWX4paI4paI4pWRIOKVmuKWiOKWiOKWiOKWiOKVkeKVmuKWiOKWiOKWiOKWiOKWiOKWiOKVlOKVneKWiOKWiOKVkeKWiOKWiOKVkSDilZrilojilojilojilojilZHilojilojilojilojilojilojilojilZcgICAgXHJcbuKVmuKVkOKVneKVmuKVkOKVkOKVkOKVkOKVkOKVkOKVneKVmuKVkOKVkOKVkOKVkOKVkOKVkOKVneKVmuKVkOKVnSAg4pWa4pWQ4pWd4pWa4pWQ4pWdICDilZrilZDilZ3ilZrilZDilZ0gICAgICDilZrilZDilZDilZDilZDilZDilZDilZ3ilZrilZDilZ0gIOKVmuKVkOKVkOKVkOKVnSDilZrilZDilZDilZDilZDilZDilZ0g4pWa4pWQ4pWd4pWa4pWQ4pWdICDilZrilZDilZDilZDilZ3ilZrilZDilZDilZDilZDilZDilZDilZ0gICAgXHJcblZFUlNJT046ICR7dmVyc2lvbn0gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxyXG5gKSk7XHJcblxyXG4gICAgdi5kZWxpbWl0ZXIoY2hhbGsuYm9sZC5ncmVlbihgPmApKS5cclxuICAgICAgICBzaG93KCk7XHJcbn0iXSwibmFtZXMiOlsiY3JlYXRlRmlsdGVyIiwiZ2xvYiIsInRlcnNlciIsInRvbWwiLCJnaXQiLCJleGVjIiwic3Bhd24iLCJwbTIiLCJ3YXRjaCIsInN0b3AiLCJ2ZXJzaW9uIiwiY29tbWFuZHMiLCJjaGFsayJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFTQSxNQUFNLFdBQVcsR0FBRyxDQUFDLE1BQU0sR0FBRyxPQUFPLENBQUMsR0FBRyxFQUFFLEtBQUs7SUFDNUMsTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQ3ZDLElBQUksTUFBTSxLQUFLLE1BQU0sRUFBRTtRQUNuQixPQUFPLE1BQU0sQ0FBQztLQUNqQjs7SUFFRCxPQUFPLFdBQVcsQ0FBQyxNQUFNLENBQUMsQ0FBQztDQUM5QixDQUFDOztBQUVGLE1BQU0sUUFBUSxHQUFHLFdBQVcsRUFBRSxDQUFDO0FBQy9CLE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDOztBQUVoQyxNQUFNLFdBQVcsR0FBRyxDQUFDLFFBQVEsS0FBSztJQUM5QixNQUFNLGFBQWEsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQztRQUNyQyxPQUFPLENB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
