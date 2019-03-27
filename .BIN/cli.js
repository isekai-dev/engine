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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2xpLmpzIiwic291cmNlcyI6WyIuLi9zcmMvcm9sbHVwL3BsdWdpbi1nbG9iLmpzIiwiLi4vc3JjL3JvbGx1cC92ZXJzaW9uLmpzIiwiLi4vc3JjL3JvbGx1cC9idWlsZGVycy5qcyIsIi4uL3NyYy9saWIvZ2V0X3NraWxscy5qcyIsIi4uL3NyYy9saWIvZ2V0X2NvbmZpZy5qcyIsIi4uL3NyYy90cmFuc2Zvcm1zL3RvbWxfdG9fanMuanMiLCIuLi9zcmMvbGliL2dldF9saXN0LmpzIiwiLi4vc3JjL2xpYi9maWx0ZXJfbGlzdC5qcyIsIi4uL3NyYy9saWIvcHJvbXB0X2RhZW1vbnMuanMiLCIuLi9zcmMvY29tbWFuZHMvYnVpbGQuanMiLCIuLi9zcmMvY29tbWFuZHMvY29tbWl0LmpzIiwiLi4vc3JjL2NvbW1hbmRzL2NyZWF0ZS5qcyIsIi4uL3NyYy9jb21tYW5kcy9kYWVtb25zLmpzIiwiLi4vc3JjL2xpYi9wbTIuanMiLCIuLi9zcmMvY29tbWFuZHMvbG9ncy5qcyIsIi4uL3NyYy9jb21tYW5kcy9wdWxsLmpzIiwiLi4vc3JjL2NvbW1hbmRzL3B1c2guanMiLCIuLi9zcmMvY29tbWFuZHMvc2tpbGxzLmpzIiwiLi4vc3JjL2NvbW1hbmRzL3NwYXduLmpzIiwiLi4vc3JjL2xpYi9hY3Rpb24uanMiLCIuLi9zcmMvY29tbWFuZHMvd2F0Y2guanMiLCIuLi9zcmMvY29tbWFuZHMvc3RvcC5qcyIsIi4uL3NyYy9jb21tYW5kcy9zdGFydC5qcyIsIi4uL3NyYy9jb21tYW5kcy9zdGF0dXMuanMiLCIuLi9zcmMvY29tbWFuZHMvdmVyc2lvbi5qcyIsIi4uLzRlZTQ5NWZiMTgwZTJiNGE2NWE3YzE1MjYwOThiYjBkIiwiLi4vc3JjL2xpYi9mb3JtYXQuanMiLCIuLi9zcmMvY2xpLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIlxyXG5pbXBvcnQgZnMgZnJvbSBcImZzXCI7XHJcbmltcG9ydCBvcyBmcm9tIFwib3NcIjtcclxuaW1wb3J0IGdsb2IgZnJvbSBcImdsb2JcIjtcclxuaW1wb3J0IHBhdGggZnJvbSBcInBhdGhcIjtcclxuaW1wb3J0IG1kNSBmcm9tIFwibWQ1XCI7XHJcblxyXG5pbXBvcnQgeyBjcmVhdGVGaWx0ZXIgfSBmcm9tIFwicm9sbHVwLXBsdWdpbnV0aWxzXCI7XHJcblxyXG5jb25zdCBnZXRGU1ByZWZpeCA9IChwcmVmaXggPSBwcm9jZXNzLmN3ZCgpKSA9PiB7XHJcbiAgICBjb25zdCBwYXJlbnQgPSBwYXRoLmpvaW4ocHJlZml4LCBgLi5gKTtcclxuICAgIGlmIChwYXJlbnQgPT09IHByZWZpeCkge1xyXG4gICAgICAgIHJldHVybiBwcmVmaXg7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIHJldHVybiBnZXRGU1ByZWZpeChwYXJlbnQpO1xyXG59O1xyXG5cclxuY29uc3QgZnNQcmVmaXggPSBnZXRGU1ByZWZpeCgpO1xyXG5jb25zdCByb290UGF0aCA9IHBhdGguam9pbihgL2ApO1xyXG5cclxuY29uc3QgdG9VUkxTdHJpbmcgPSAoZmlsZVBhdGgpID0+IHtcclxuICAgIGNvbnN0IHBhdGhGcmFnbWVudHMgPSBwYXRoLmpvaW4oZmlsZVBhdGgpLlxyXG4gICAgICAgIHJlcGxhY2UoZnNQcmVmaXgsIHJvb3RQYXRoKS5cclxuICAgICAgICBzcGxpdChwYXRoLnNlcCk7XHJcbiAgICBpZiAoIXBhdGguaXNBYnNvbHV0ZShmaWxlUGF0aCkpIHtcclxuICAgICAgICBwYXRoRnJhZ21lbnRzLnVuc2hpZnQoYC5gKTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgcmV0dXJuIHBhdGhGcmFnbWVudHMuam9pbihgL2ApO1xyXG59O1xyXG5cclxuY29uc3QgcmVzb2x2ZU5hbWUgPSAoZnJvbSkgPT4gXHJcbiAgICBmcm9tLnNwbGl0KGAvYCkuXHJcbiAgICAgICAgcG9wKCkuXHJcbiAgICAgICAgc3BsaXQoYC5gKS5cclxuICAgICAgICBzaGlmdCgpO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgKHsgXHJcbiAgICBpbmNsdWRlLCBcclxuICAgIGV4Y2x1ZGUgXHJcbn0gPSBmYWxzZSkgPT4ge1xyXG4gICAgY29uc3QgZmlsdGVyID0gY3JlYXRlRmlsdGVyKGluY2x1ZGUsIGV4Y2x1ZGUpO1xyXG4gICAgXHJcbiAgICByZXR1cm4ge1xyXG4gICAgICAgIG5hbWU6IGByb2xsdXAtZ2xvYmAsXHJcbiAgICAgICAgbG9hZDogKGlkKSA9PiB7XHJcbiAgICAgICAgICAgIGNvbnN0IHNyY0ZpbGUgPSBwYXRoLmpvaW4ob3MudG1wZGlyKCksIGlkKTtcclxuXHJcbiAgICAgICAgICAgIGxldCBvcHRpb25zO1xyXG4gICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgb3B0aW9ucyA9IEpTT04ucGFyc2UoZnMucmVhZEZpbGVTeW5jKHNyY0ZpbGUpKTtcclxuICAgICAgICAgICAgfSBjYXRjaChlcnIpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgY29uc3QgeyBpbXBvcnRlZSwgaW1wb3J0ZXIgfSA9IG9wdGlvbnM7XHJcblxyXG4gICAgICAgICAgICBjb25zdCBpbXBvcnRlZUlzQWJzb2x1dGUgPSBwYXRoLmlzQWJzb2x1dGUoaW1wb3J0ZWUpO1xyXG4gICAgICAgICAgICBjb25zdCBjd2QgPSBwYXRoLmRpcm5hbWUoaW1wb3J0ZXIpO1xyXG4gICAgICAgICAgICBjb25zdCBnbG9iUGF0dGVybiA9IGltcG9ydGVlO1xyXG5cclxuICAgICAgICAgICAgY29uc3QgZmlsZXMgPSBnbG9iLnN5bmMoZ2xvYlBhdHRlcm4sIHtcclxuICAgICAgICAgICAgICAgIGN3ZFxyXG4gICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgIGxldCBjb2RlID0gWyBgY29uc3QgcmVzID0ge307YCBdO1xyXG4gICAgICAgICAgICBsZXQgaW1wb3J0QXJyYXkgPSBbXTtcclxuXHJcbiAgICAgICAgICAgIGZpbGVzLmZvckVhY2goKGZpbGUsIGkpID0+IHtcclxuICAgICAgICAgICAgICAgIGxldCBmcm9tO1xyXG4gICAgICAgICAgICAgICAgaWYgKGltcG9ydGVlSXNBYnNvbHV0ZSkge1xyXG4gICAgICAgICAgICAgICAgICAgIGZyb20gPSB0b1VSTFN0cmluZyhmaWxlKTtcclxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgZnJvbSA9IHRvVVJMU3RyaW5nKHBhdGgucmVzb2x2ZShjd2QsIGZpbGUpKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGNvZGUucHVzaChgaW1wb3J0IGYke2l9IGZyb20gXCIke2Zyb219XCI7YCk7XHJcbiAgICAgICAgICAgICAgICBjb2RlLnB1c2goYHJlc1tcIiR7cmVzb2x2ZU5hbWUoZnJvbSl9XCJdID0gZiR7aX07YCk7XHJcbiAgICAgICAgICAgICAgICBpbXBvcnRBcnJheS5wdXNoKGZyb20pO1xyXG4gICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgIGNvZGUucHVzaChgZXhwb3J0IGRlZmF1bHQgcmVzO2ApO1xyXG5cclxuICAgICAgICAgICAgY29kZSA9IGNvZGUuam9pbihgXFxuYCk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgICAgIHJldHVybiBjb2RlO1xyXG5cclxuICAgICAgICB9LFxyXG4gICAgICAgIHJlc29sdmVJZDogKGltcG9ydGVlLCBpbXBvcnRlcikgPT4ge1xyXG4gICAgICAgICAgICBpZiAoIWZpbHRlcihpbXBvcnRlZSkgfHwgIWltcG9ydGVlLmluY2x1ZGVzKGAqYCkpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgY29uc3QgaGFzaCA9IG1kNShpbXBvcnRlZSArIGltcG9ydGVyKTtcclxuXHJcbiAgICAgICAgICAgIGZzLndyaXRlRmlsZVN5bmMocGF0aC5qb2luKG9zLnRtcGRpcigpLCBoYXNoKSwgSlNPTi5zdHJpbmdpZnkoe1xyXG4gICAgICAgICAgICAgICAgaW1wb3J0ZWUsXHJcbiAgICAgICAgICAgICAgICBpbXBvcnRlclxyXG4gICAgICAgICAgICB9KSk7XHJcblxyXG4gICAgICAgICAgICByZXR1cm4gaGFzaDtcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG59OyIsImltcG9ydCBmcyBmcm9tIFwiZnNcIjtcclxuXHJcbmV4cG9ydCBkZWZhdWx0ICh7XHJcbiAgICBwYXRoLFxyXG4gICAgdmVyc2lvblxyXG59KSA9PiBcclxuICAgICh7XHJcbiAgICAgICAgbmFtZTogYHJvbGx1cC13cml0ZWAsXHJcbiAgICAgICAgYnVpbGRTdGFydDogKCkgPT4ge1xyXG4gICAgICAgICAgICBmcy53cml0ZUZpbGVTeW5jKHBhdGgsIHZlcnNpb24oKSk7XHJcbiAgICAgICAgfVxyXG4gICAgfSk7IiwiaW1wb3J0IHRvbWwgZnJvbSBcInJvbGx1cC1wbHVnaW4tdG9tbFwiO1xyXG5pbXBvcnQgc3ZlbHRlIGZyb20gXCJyb2xsdXAtcGx1Z2luLXN2ZWx0ZVwiO1xyXG5pbXBvcnQgcmVzb2x2ZSBmcm9tIFwicm9sbHVwLXBsdWdpbi1ub2RlLXJlc29sdmVcIjtcclxuaW1wb3J0IGNvcHkgZnJvbSBcInJvbGx1cC1wbHVnaW4tY29weS1nbG9iXCI7XHJcbmltcG9ydCByZXBsYWNlIGZyb20gXCJyb2xsdXAtcGx1Z2luLXJlcGxhY2VcIjtcclxuXHJcbmltcG9ydCBqc29uIGZyb20gXCJyb2xsdXAtcGx1Z2luLWpzb25cIjtcclxuaW1wb3J0IG1kIGZyb20gXCJyb2xsdXAtcGx1Z2luLWNvbW1vbm1hcmtcIjtcclxuaW1wb3J0IGNqcyBmcm9tIFwicm9sbHVwLXBsdWdpbi1jb21tb25qc1wiO1xyXG5cclxuaW1wb3J0IHsgdGVyc2VyIH0gZnJvbSBcInJvbGx1cC1wbHVnaW4tdGVyc2VyXCI7XHJcbmltcG9ydCB1dWlkIGZyb20gXCJ1dWlkL3YxXCI7XHJcblxyXG4vKlxyXG4gKiBpbXBvcnQgc3ByaXRlc21pdGggZnJvbSBcInJvbGx1cC1wbHVnaW4tc3ByaXRlXCI7XHJcbiAqIGltcG9ydCB0ZXh0dXJlUGFja2VyIGZyb20gXCJzcHJpdGVzbWl0aC10ZXh0dXJlcGFja2VyXCI7XHJcbiAqL1xyXG5cclxuaW1wb3J0IGdsb2IgZnJvbSBcIi4vcGx1Z2luLWdsb2IuanNcIjtcclxuaW1wb3J0IHZlcnNpb24gZnJvbSBcIi4vdmVyc2lvbi5qc1wiO1xyXG5cclxuY29uc3QgQ09ERV9WRVJTSU9OID0gdXVpZCgpO1xyXG5jb25zdCBwcm9kdWN0aW9uID0gIXByb2Nlc3MuZW52LlJPTExVUF9XQVRDSDtcclxuXHJcbmNvbnN0IGRvX2NvcHkgPSAoY29weU9iamVjdCkgPT4gY29weShPYmplY3Qua2V5cyhjb3B5T2JqZWN0KS5cclxuICAgIG1hcChcclxuICAgICAgICAoa2V5KSA9PiAoe1xyXG4gICAgICAgICAgICBmaWxlczoga2V5LFxyXG4gICAgICAgICAgICBkZXN0OiBjb3B5T2JqZWN0W2tleV1cclxuICAgICAgICB9KVxyXG4gICAgKSk7XHJcblxyXG5sZXQgQ0xJRU5UX1ZFUlNJT04gPSB1dWlkKCk7XHJcblxyXG5jb25zdCBleHRlcm5hbCA9IFtcclxuICAgIGBleHByZXNzYCxcclxuICAgIGBpc2VrYWlgLFxyXG4gICAgYGZzYCxcclxuICAgIGBodHRwYCxcclxuICAgIGBodHRwc2BcclxuXTtcclxuXHJcbmNvbnN0IG5vZGUgPSAoe1xyXG4gICAgaW5wdXQsXHJcbiAgICBvdXRwdXQsXHJcbiAgICBjb3B5OiBjb3B5T2JqZWN0ID0ge31cclxufSkgPT4gKHtcclxuICAgIGlucHV0LFxyXG4gICAgb3V0cHV0OiB7XHJcbiAgICAgICAgc291cmNlbWFwOiBgaW5saW5lYCxcclxuICAgICAgICBmaWxlOiBvdXRwdXQsXHJcbiAgICAgICAgZm9ybWF0OiBgY2pzYCxcclxuICAgIH0sXHJcbiAgICBleHRlcm5hbCxcclxuICAgIHBsdWdpbnM6IFtcclxuICAgICAgICBnbG9iKCksXHJcbiAgICAgICAgcmVwbGFjZSh7XHJcbiAgICAgICAgICAgIENPREVfVkVSU0lPTixcclxuICAgICAgICB9KSxcclxuICAgICAgICBtZCgpLFxyXG4gICAgICAgIGpzb24oKSxcclxuICAgICAgICBkb19jb3B5KGNvcHlPYmplY3QpLFxyXG4gICAgICAgIHRvbWxcclxuICAgIF0sXHJcbn0pO1xyXG5cclxuY29uc3QgYnJvd3NlciA9ICh7XHJcbiAgICBpbnB1dCxcclxuICAgIG91dHB1dCxcclxuICAgIGNzczogY3NzUGF0aCxcclxuICAgIGNvcHk6IGNvcHlPYmplY3QsXHJcbn0pID0+ICh7XHJcbiAgICBpbnB1dCxcclxuICAgIG91dHB1dDoge1xyXG4gICAgICAgIGZpbGU6IG91dHB1dCxcclxuICAgICAgICBmb3JtYXQ6IGBpaWZlYCxcclxuICAgIH0sXHJcbiAgICBleHRlcm5hbDogWyBgdXVpZGAsIGB1dWlkL3YxYCwgYHBpeGkuanNgIF0sXHJcbiAgICBwbHVnaW5zOiBbXHJcbiAgICAgICAgLy8gLy8gbWFrZSB0aGlzIGEgcmVhY3RpdmUgcGx1Z2luIHRvIFwiLnRpbGVtYXAuanNvblwiXHJcbiAgICAgICAgLy8gICAgIHNwcml0ZXNtaXRoKHtcclxuICAgICAgICAvLyAgICAgICAgIHNyYzoge1xyXG4gICAgICAgIC8vICAgICAgICAgICAgIGN3ZDogXCIuL2dvYmxpbi5saWZlL0JST1dTRVIuUElYSS9cclxuICAgICAgICAvLyAgICAgICAgICAgICBnbG9iOiBcIioqLyoucG5nXCJcclxuICAgICAgICAvLyAgICAgICAgIH0sXHJcbiAgICAgICAgLy8gICAgICAgICB0YXJnZXQ6IHtcclxuICAgICAgICAvLyAgICAgICAgICAgICBpbWFnZTogXCIuL2Jpbi9wdWJsaWMvaW1hZ2VzL3Nwcml0ZS5wbmdcIixcclxuICAgICAgICAvLyAgICAgICAgICAgICBjc3M6IFwiLi9iaW4vcHVibGljL2FydC9kZWZhdWx0Lmpzb25cIlxyXG4gICAgICAgIC8vICAgICAgICAgfSxcclxuICAgICAgICAvLyAgICAgICAgIG91dHB1dDoge1xyXG4gICAgICAgIC8vICAgICAgICAgICAgIGltYWdlOiBcIi4vYmluL3B1YmxpYy9pbWFnZXMvc3ByaXRlLnBuZ1wiXHJcbiAgICAgICAgLy8gICAgICAgICB9LFxyXG4gICAgICAgIC8vICAgICAgICAgc3ByaXRlc21pdGhPcHRpb25zOiB7XHJcbiAgICAgICAgLy8gICAgICAgICAgICAgcGFkZGluZzogMFxyXG4gICAgICAgIC8vICAgICAgICAgfSxcclxuICAgICAgICAvLyAgICAgICAgIGN1c3RvbVRlbXBsYXRlOiB0ZXh0dXJlUGFja2VyXHJcbiAgICAgICAgLy8gICAgIH0pLFxyXG4gICAgICAgIGdsb2IoKSxcclxuICAgICAgICBjanMoe1xyXG4gICAgICAgICAgICBpbmNsdWRlOiBgbm9kZV9tb2R1bGVzLyoqYCwgXHJcbiAgICAgICAgfSksXHJcbiAgICAgICAganNvbigpLFxyXG4gICAgICAgIHJlcGxhY2Uoe1xyXG4gICAgICAgICAgICBDT0RFX1ZFUlNJT04sXHJcbiAgICAgICAgICAgIENMSUVOVF9WRVJTSU9OOiAoKSA9PiBDTElFTlRfVkVSU0lPTlxyXG4gICAgICAgIH0pLFxyXG4gICAgICAgIHRvbWwsXHJcbiAgICAgICAgbWQoKSxcclxuICAgICAgICBzdmVsdGUoe1xyXG4gICAgICAgICAgICBjc3M6IChjc3MpID0+IHtcclxuICAgICAgICAgICAgICAgIGNzcy53cml0ZShjc3NQYXRoKTtcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICB9KSxcclxuICAgICAgICByZXNvbHZlKCksXHJcbiAgICAgICAgcHJvZHVjdGlvbiAmJiB0ZXJzZXIoKSxcclxuICAgICAgICBkb19jb3B5KGNvcHlPYmplY3QpLFxyXG4gICAgICAgIHZlcnNpb24oe1xyXG4gICAgICAgICAgICBwYXRoOiBgLi8uQklOL2NsaWVudC52ZXJzaW9uYCxcclxuICAgICAgICAgICAgdmVyc2lvbjogKCkgPT4gQ0xJRU5UX1ZFUlNJT05cclxuICAgICAgICB9KVxyXG4gICAgXVxyXG59KTtcclxuXHJcbmV4cG9ydCBkZWZhdWx0IHtcclxuICAgIG5vZGUsXHJcbiAgICBicm93c2VyXHJcbn07IiwiaW1wb3J0IHBhdGggZnJvbSBcInBhdGhcIjtcclxuaW1wb3J0IGdsb2IgZnJvbSBcImdsb2JcIjtcclxuXHJcbi8vIGRvbid0IHJlYWxseSBzdXBwb3J0IG92ZXJyaWRlc1xyXG5jb25zdCBnbG9iX29iaiA9IChvYmogPSB7fSwgZ2xvYl9wYXRoKSA9PiBnbG9iLnN5bmMoZ2xvYl9wYXRoKS5cclxuICAgIHJlZHVjZSgob2JqLCBlcXVpcF9wYXRoKSA9PiB7XHJcbiAgICAgICAgY29uc3QgcHJvamVjdF9uYW1lID0gcGF0aC5iYXNlbmFtZShwYXRoLnJlc29sdmUoZXF1aXBfcGF0aCwgYC4uYCwgYC4uYCkpO1xyXG4gICAgICAgIGNvbnN0IHNraWxsX25hbWUgPSBwYXRoLmJhc2VuYW1lKGVxdWlwX3BhdGgpO1xyXG5cclxuICAgICAgICBpZihvYmpbc2tpbGxfbmFtZV0pIHtcclxuICAgICAgICAvLyBwcmV2ZW50cyBoaWphY2tpbmdcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGAke3NraWxsX25hbWV9IGZyb20gJHtwcm9qZWN0X25hbWV9IG92ZXJsYXBzICR7b2JqW3NraWxsX25hbWVdfWApO1xyXG4gICAgICAgIH1cclxuICAgIFxyXG4gICAgICAgIHJldHVybiB7IFxyXG4gICAgICAgICAgICBbc2tpbGxfbmFtZV06IHBhdGgucmVsYXRpdmUocHJvY2Vzcy5jd2QoKSwgcGF0aC5yZXNvbHZlKGVxdWlwX3BhdGgsIGAuLmAsIGAuLmApKSxcclxuICAgICAgICAgICAgLi4ub2JqIFxyXG4gICAgICAgIH07XHJcbiAgICB9LCBvYmopO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgKCkgPT4gKHtcclxuICAgIFNLSUxMUzogW1xyXG4gICAgICAgIGAuL1NLSUxMUy8qL2AsIFxyXG4gICAgICAgIGAuL25vZGVfbW9kdWxlcy8qL1NLSUxMUy8qL2AsXHJcbiAgICAgICAgYC4vbm9kZV9tb2R1bGVzL0AqLyovU0tJTExTLyovYFxyXG4gICAgXS5yZWR1Y2UoZ2xvYl9vYmosIHt9KVxyXG59KTtcclxuIiwiaW1wb3J0IHRvbWwgZnJvbSBcInRvbWxcIjtcclxuaW1wb3J0IGZzIGZyb20gXCJmc1wiO1xyXG5cclxuY29uc3QgZ2V0X2NvbmZpZyA9IChjb25maWdGaWxlKSA9PiB7XHJcbiAgICAvLyB2ZXJpZnkgdG9tbCBleGlzdHNcclxuICAgIGxldCByYXc7XHJcblxyXG4gICAgdHJ5IHtcclxuICAgICAgICByYXcgPSBmcy5yZWFkRmlsZVN5bmMoY29uZmlnRmlsZSwgYHV0Zi04YCk7XHJcbiAgICB9IGNhdGNoIChleGNlcHRpb24pIHtcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYENvdWxkbid0IHJlYWQgJHtjb25maWdGaWxlfS4gQXJlIHlvdSBzdXJlIHRoaXMgcGF0aCBpcyBjb3JyZWN0P2ApO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IGNvbmZpZyA9IHRvbWwucGFyc2UocmF3KTtcclxuXHJcbiAgICAvLyBoYXMgaW1wbGVtZW50ZWRcclxuICAgIGlmKGNvbmZpZy5oYXMpIHtcclxuICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICAuLi5jb25maWcuaGFzLnJlZHVjZSgob2JqLCBvdGhlcl9maWxlKSA9PiAoe1xyXG4gICAgICAgICAgICAgICAgLi4uZ2V0X2NvbmZpZyhgLi9EQUVNT05TLyR7b3RoZXJfZmlsZX0udG9tbGApLFxyXG4gICAgICAgICAgICAgICAgLi4ub2JqXHJcbiAgICAgICAgICAgIH0pLCB7fSksIFxyXG4gICAgICAgICAgICAuLi5jb25maWdcclxuICAgICAgICB9O1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICByZXR1cm4gY29uZmlnO1xyXG59O1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgZ2V0X2NvbmZpZztcclxuIiwiaW1wb3J0IGZzIGZyb20gXCJmc1wiO1xyXG5pbXBvcnQgcGF0aCBmcm9tIFwicGF0aFwiO1xyXG5cclxuaW1wb3J0IGMgZnJvbSBcImNoYWxrXCI7XHJcbmltcG9ydCBidWlsZGVycyBmcm9tIFwiLi4vcm9sbHVwL2J1aWxkZXJzLmpzXCI7XHJcbmltcG9ydCBnZXRfc2tpbGxzIGZyb20gXCIuLi9saWIvZ2V0X3NraWxscy5qc1wiO1xyXG5pbXBvcnQgZ2V0X2NvbmZpZyBmcm9tIFwiLi4vbGliL2dldF9jb25maWcuanNcIjtcclxuXHJcbi8vIE1peCBDb25maWcgRmlsZSBpbiBhbmQgcnVuIHRoZXNlIGluIG9yZGVyXHJcbmV4cG9ydCBkZWZhdWx0IChjb25maWdGaWxlKSA9PiBPYmplY3QudmFsdWVzKHtcclxuICAgIGdldF9za2lsbHMsXHJcblxyXG4gICAgZ2V0X2NvbmZpZzogKHsgY29uZmlnRmlsZSB9KSA9PiAoe1xyXG4gICAgICAgIGNvbmZpZzogZ2V0X2NvbmZpZyhjb25maWdGaWxlKVxyXG4gICAgfSksXHJcbiAgICBcclxuICAgIHNldF9uYW1lczogKHtcclxuICAgICAgICBjb25maWdGaWxlLFxyXG4gICAgfSkgPT4ge1xyXG4gICAgICAgIGNvbnN0IG5hbWUgPSBwYXRoLmJhc2VuYW1lKGNvbmZpZ0ZpbGUsIGAudG9tbGApO1xyXG5cclxuICAgICAgICBjb25zdCBwYWNrYWdlX3BhdGggPSBwYXRoLmRpcm5hbWUocGF0aC5yZXNvbHZlKGNvbmZpZ0ZpbGUpKTtcclxuICAgICAgICBjb25zdCBwYWNrYWdlX25hbWUgPSBwYWNrYWdlX3BhdGguXHJcbiAgICAgICAgICAgIHNwbGl0KHBhdGguc2VwKS5cclxuICAgICAgICAgICAgcG9wKCk7XHJcblxyXG4gICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgIHBhY2thZ2VfcGF0aCxcclxuICAgICAgICAgICAgcGFja2FnZV9uYW1lLFxyXG4gICAgICAgICAgICBuYW1lLFxyXG4gICAgICAgIH07XHJcbiAgICB9LFxyXG5cclxuICAgIHdyaXRlX2VudHJ5OiAoe1xyXG4gICAgICAgIGNvbmZpZyxcclxuICAgICAgICBuYW1lLFxyXG4gICAgICAgIFNLSUxMU1xyXG4gICAgfSkgPT4ge1xyXG4gICAgICAgIC8vIFdSSVRFIE9VVCBGSUxFXHJcbiAgICAgICAgbGV0IGVudHJ5ID0gYGA7XHJcbiAgICAgICAgY29uc3QgdHlwZSA9IGNvbmZpZy5OT0RFIFxyXG4gICAgICAgICAgICA/IGBub2RlYCBcclxuICAgICAgICAgICAgOiBgYnJvd3NlcmA7XHJcblxyXG4gICAgICAgIGNvbnN0IHdyaXRlID0gKGRhdGEpID0+IHtcclxuICAgICAgICAgICAgZW50cnkgKz0gYCR7ZGF0YX1cXHJcXG5gO1xyXG4gICAgICAgIH07XHJcbiAgICAgICAgXHJcbiAgICAgICAgd3JpdGUoYGltcG9ydCBpc2VrYWkgZnJvbSBcImlzZWthaVwiO2ApO1xyXG4gICAgICAgIHdyaXRlKGBpc2VrYWkuU0VUKCR7SlNPTi5zdHJpbmdpZnkoY29uZmlnKX0pO2ApO1xyXG4gICAgICAgIHdyaXRlKGBgKTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgY29uc3QgZmFpbHMgPSBbXTtcclxuICAgICAgICBjb25zdCBlcXVpcGVkID0gT2JqZWN0LmtleXMoY29uZmlnKS5cclxuICAgICAgICAgICAgZmlsdGVyKChrZXkpID0+IHtcclxuICAgICAgICAgICAgICAgIGNvbnN0IGlzX3VwcGVyID0ga2V5ID09PSBrZXkudG9VcHBlckNhc2UoKTtcclxuICAgICAgICAgICAgICAgIGlmKCFpc191cHBlcikge1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICBjb25zdCBoYXNfc2tpbGwgPSBTS0lMTFNba2V5XSAhPT0gdW5kZWZpbmVkO1xyXG5cclxuICAgICAgICAgICAgICAgIGNvbnN0IGlzX3RhcmdldCA9IFsgYEJST1dTRVJgLCBgTk9ERWAgXS5pbmRleE9mKGtleSkgIT09IC0xO1xyXG5cclxuICAgICAgICAgICAgICAgIGlmKCFoYXNfc2tpbGwgJiYgIWlzX3RhcmdldCkge1xyXG4gICAgICAgICAgICAgICAgICAgIGZhaWxzLnB1c2goa2V5KTtcclxuICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICByZXR1cm4gaXNfdXBwZXIgJiYgaGFzX3NraWxsO1xyXG4gICAgICAgICAgICB9KS5cclxuICAgICAgICAgICAgbWFwKChrZXkpID0+IHtcclxuICAgICAgICAgICAgICAgIGNvbnN0IHdoZXJlID0gU0tJTExTW2tleV0gPT09IGBgXHJcbiAgICAgICAgICAgICAgICAgICAgPyBgLi5gXHJcbiAgICAgICAgICAgICAgICAgICAgOiBgLi4vJHtTS0lMTFNba2V5XS5zcGxpdChwYXRoLnNlcCkuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGpvaW4oYC9gKX1gO1xyXG5cclxuICAgICAgICAgICAgICAgIHdyaXRlKGBpbXBvcnQgJHtrZXl9IGZyb20gXCIke3doZXJlfS9TS0lMTFMvJHtrZXl9LyR7dHlwZX0uanNcIjtgKTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICByZXR1cm4ga2V5O1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgY29uc3QgZmFpbGVkID0gZmFpbHMubGVuZ3RoID4gMFxyXG4gICAgICAgICAgICA/IGBGQUlMRUQgVE8gRklORFxcclxcbiR7ZmFpbHMubWFwKChmKSA9PiBgWyR7Zn1dYCkuXHJcbiAgICAgICAgICAgICAgICBqb2luKGAgeCBgKX1gXHJcbiAgICAgICAgICAgIDogYGA7XHJcblxyXG4gICAgICAgIGNvbnN0IGtleXMgPSBlcXVpcGVkLnJlZHVjZSgob3V0cHV0LCBrZXkpID0+IGAke291dHB1dH0gICAgJHtrZXl9LFxcclxcbmAsIGBgKTtcclxuXHJcbiAgICAgICAgd3JpdGUoYFxyXG5pc2VrYWkuRVFVSVAoe1xcclxcbiR7a2V5c319KTtgKTtcclxuXHJcbiAgICAgICAgY29uc3QgQklOID0gYC5CSU5gO1xyXG4gICAgICAgIGNvbnN0IGlucHV0ID0gcGF0aC5qb2luKEJJTiwgYCR7bmFtZX0uZW50cnkuanNgKTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgaWYgKCFmcy5leGlzdHNTeW5jKEJJTikpIHtcclxuICAgICAgICAgICAgY29uc29sZS5sb2coYENSRUFUSU5HICR7QklOfWApO1xyXG4gICAgICAgICAgICBmcy5ta2RpclN5bmMoQklOKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgLy8gd3JpdGUgb3V0IHRoZWlyIGluZGV4LmpzXHJcbiAgICAgICAgZnMud3JpdGVGaWxlU3luYyhpbnB1dCwgZW50cnksIGB1dGYtOGApO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICBjb25zb2xlLmxvZyhgXHJcblske25hbWV9XVske3R5cGV9XVxyXG5cclxuU0tJTExTXHJcbiR7Yy5ibHVlQnJpZ2h0KGVxdWlwZWQubWFwKChlKSA9PiBgWyR7ZX1dYCkuXHJcbiAgICAgICAgam9pbihgICsgYCkpfVxyXG5cclxuJHtjLnJlZChmYWlsZWQpfVxyXG5gKTtcclxuXHJcbiAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgaW5wdXRcclxuICAgICAgICB9O1xyXG4gICAgfSxcclxuXHJcbiAgICBydW5fYnVpbGRlcnM6ICh7XHJcbiAgICAgICAgaW5wdXQsXHJcbiAgICAgICAgbmFtZSxcclxuICAgICAgICBjb25maWcsXHJcbiAgICB9KSA9PiB7XHJcbiAgICAgICAgY29uc3QgdGFyZ2V0ID0gY29uZmlnLk5PREUgXHJcbiAgICAgICAgICAgID8gYE5PREVgIFxyXG4gICAgICAgICAgICA6IGBCUk9XU0VSYDtcclxuXHJcbiAgICAgICAgY29uc3Qgb3V0cHV0ID0gYC5CSU4vJHtuYW1lfS4ke3RhcmdldH0uanNgO1xyXG5cclxuICAgICAgICBpZihjb25maWcuTk9ERSAmJiBjb25maWcuQlJPV1NFUikge1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFlvdSBjYW5ub3QgdGFyZ2V0IGJvdGggW05PREVdIGFuZCBbQlJPV1NFUl1gKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmKGNvbmZpZy5OT0RFKSB7ICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgICAgICBvdXRwdXQsXHJcbiAgICAgICAgICAgICAgICBidWlsZF9pbmZvOiBidWlsZGVycy5ub2RlKHtcclxuICAgICAgICAgICAgICAgICAgICBpbnB1dCxcclxuICAgICAgICAgICAgICAgICAgICBvdXRwdXRcclxuICAgICAgICAgICAgICAgIH0pXHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIGlmKGNvbmZpZy5CUk9XU0VSKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgICAgICBvdXRwdXQsXHJcbiAgICAgICAgICAgICAgICBidWlsZF9pbmZvOiBidWlsZGVycy5icm93c2VyKHtcclxuICAgICAgICAgICAgICAgICAgICBpbnB1dCxcclxuICAgICAgICAgICAgICAgICAgICBvdXRwdXRcclxuICAgICAgICAgICAgICAgIH0pXHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFlvdSBtdXN0IHNwZWNpZnkgZWl0aGVyIFtOT0RFXSBvciBbQlJPV1NFUl0gZm9yIHlvdXIgdGFyZ2V0IGluIHlvdXIgW0RBRU1PTl0gdG9tbGApO1xyXG4gICAgfVxyXG59KS5cclxuICAgIHJlZHVjZSgoc3RhdGUsIGZuKSA9PiAoe1xyXG4gICAgICAgIC4uLnN0YXRlLFxyXG4gICAgICAgIC4uLmZuKHN0YXRlKVxyXG4gICAgfSksIHsgY29uZmlnRmlsZSB9KTtcclxuIiwiaW1wb3J0IGdsb2IgZnJvbSBcImdsb2JcIjtcclxuaW1wb3J0IHBhdGggZnJvbSBcInBhdGhcIjtcclxuXHJcbmV4cG9ydCBkZWZhdWx0ICgpID0+IGdsb2Iuc3luYyhgLi9EQUVNT05TLyoudG9tbGApLlxyXG4gICAgbWFwKChjbGFzc19wYXRoKSA9PiBwYXRoLmJhc2VuYW1lKGNsYXNzX3BhdGgsIGAudG9tbGApKTsiLCJpbXBvcnQgZ2V0X2xpc3QgZnJvbSBcIi4vZ2V0X2xpc3QuanNcIjtcclxuXHJcbmV4cG9ydCBkZWZhdWx0IChjbGFzc2VzKSA9PiBjbGFzc2VzLmZpbHRlcigodGFyZ2V0KSA9PiB7XHJcbiAgICBjb25zdCBpc19va2F5ID0gZ2V0X2xpc3QoKS5cclxuICAgICAgICBpbmRleE9mKHRhcmdldCkgIT09IC0xO1xyXG5cclxuICAgIGlmKCFpc19va2F5KSB7XHJcbiAgICAgICAgY29uc29sZS5sb2coYCR7dGFyZ2V0fSBpcyBub3QgYW4gYXZhaWxhYmxlIFtEQUVNT05dYCk7XHJcbiAgICB9XHJcbiAgICAgICAgXHJcbiAgICByZXR1cm4gaXNfb2theTtcclxufSk7XHJcbiIsImltcG9ydCBnZXRfbGlzdCBmcm9tIFwiLi9nZXRfbGlzdC5qc1wiO1xyXG5pbXBvcnQgZmlsdGVyX2xpc3QgZnJvbSBcIi4vZmlsdGVyX2xpc3QuanNcIjtcclxuXHJcbmV4cG9ydCBkZWZhdWx0ICh7XHJcbiAgICBjbWQsXHJcbiAgICBEQUVNT05TXHJcbn0pID0+IHtcclxuICAgIGlmKCFEQUVNT05TKSB7XHJcbiAgICAgICAgcmV0dXJuIGNtZC5wcm9tcHQoe1xyXG4gICAgICAgICAgICB0eXBlOiBgbGlzdGAsXHJcbiAgICAgICAgICAgIG5hbWU6IGBEQUVNT05gLFxyXG4gICAgICAgICAgICBtZXNzYWdlOiBgV2hpY2ggW0RBRU1PTl0/YCxcclxuICAgICAgICAgICAgY2hvaWNlczogWyBgYWxsYCwgLi4uZ2V0X2xpc3QoKSBdXHJcbiAgICAgICAgfSkuXHJcbiAgICAgICAgICAgIHRoZW4oKHsgREFFTU9OIH0pID0+IERBRU1PTiA9PT0gYGFsbGAgXHJcbiAgICAgICAgICAgICAgICA/IGdldF9saXN0KCkgXHJcbiAgICAgICAgICAgICAgICA6IGZpbHRlcl9saXN0KFsgREFFTU9OIF0pKTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgaWYoREFFTU9OU1swXSA9PT0gYGFsbGApIHtcclxuICAgICAgICByZXR1cm4gZ2V0X2xpc3QoKTtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gZmlsdGVyX2xpc3QoREFFTU9OUyk7XHJcbn07IiwiaW1wb3J0IHRvbWxfdG9fanMgZnJvbSBcIi4uL3RyYW5zZm9ybXMvdG9tbF90b19qcy5qc1wiO1xyXG5pbXBvcnQgcm9sbHVwIGZyb20gXCJyb2xsdXBcIjtcclxuXHJcbmltcG9ydCBwcm9tcHRfZGFlbW9ucyBmcm9tIFwiLi4vbGliL3Byb21wdF9kYWVtb25zLmpzXCI7XHJcblxyXG5leHBvcnQgZGVmYXVsdCAoe1xyXG4gICAgY29tbWFuZDogYGJ1aWxkIFtEQUVNT05TLi4uXWAsXHJcbiAgICBoZWxwOiBgYnVpbGQgYWxsIFtEQUVNT05dIHNhdmUocykuYCxcclxuICAgIGhpZGRlbjogdHJ1ZSxcclxuICAgIGFzeW5jIGhhbmRsZXIoeyBEQUVNT05TIH0pIHtcclxuICAgICAgICBjb25zdCBEQUVNT05zID0gYXdhaXQgcHJvbXB0X2RhZW1vbnMoeyBcclxuICAgICAgICAgICAgY21kOiB0aGlzLFxyXG4gICAgICAgICAgICBEQUVNT05TIFxyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICBjb25zdCBidWlsdCA9IGF3YWl0IFByb21pc2UuYWxsKERBRU1PTnMubWFwKGFzeW5jICh0YXJnZXQpID0+IHtcclxuICAgICAgICAgICAgY29uc3QgeyBidWlsZF9pbmZvLCBuYW1lIH0gPSBhd2FpdCB0b21sX3RvX2pzKGAuL0RBRU1PTlMvJHt0YXJnZXR9LnRvbWxgKTtcclxuICAgICAgICAgICAgY29uc3QgYnVuZGxlID0gYXdhaXQgcm9sbHVwLnJvbGx1cChidWlsZF9pbmZvKTtcclxuXHJcbiAgICAgICAgICAgIGF3YWl0IGJ1bmRsZS53cml0ZShidWlsZF9pbmZvLm91dHB1dCk7XHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbJHtuYW1lfV0gQnVpbGQgQ29tcGxldGUuXFxyXFxuYCk7XHJcbiAgICAgICAgfSkpO1xyXG5cclxuICAgICAgICBjb25zb2xlLmxvZyhgQnVpbHQgJHtidWlsdC5sZW5ndGh9IFtEQUVNT05dKHMpLmApO1xyXG4gICAgfVxyXG59KTsiLCJpbXBvcnQgR2l0IGZyb20gXCJzaW1wbGUtZ2l0L3Byb21pc2VcIjtcclxuXHJcbmNvbnN0IGdpdCA9IEdpdCgpO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgKHtcclxuICAgIGNvbW1hbmQ6IGBjb21taXQgW21lc3NhZ2UuLi5dYCxcclxuICAgIGhlbHA6IGBjb21taXQgY3VycmVudCBmaWxlcyB0byBzb3VyY2UgY29udHJvbGAsXHJcbiAgICBoYW5kbGVyOiAoe1xyXG4gICAgICAgIG1lc3NhZ2UgPSBbIGBVcGRhdGUsIG5vIGNvbW1pdCBtZXNzYWdlYCBdXHJcbiAgICB9KSA9PiBnaXQuYWRkKFsgYC5gIF0pLlxyXG4gICAgICAgIHRoZW4oKCkgPT4gZ2l0LmNvbW1pdChtZXNzYWdlLmpvaW4oYCBgKSkpLlxyXG4gICAgICAgIHRoZW4oKCkgPT4gZ2l0LnB1c2goYG9yaWdpbmAsIGBtYXN0ZXJgKSkuXHJcbiAgICAgICAgdGhlbigoKSA9PiBjb25zb2xlLmxvZyhgQ29tbWl0ZWQgd2l0aCBtZXNzYWdlICR7bWVzc2FnZS5qb2luKGAgYCl9YCkpXHJcbn0pO1xyXG4iLCJpbXBvcnQgZGVnaXQgZnJvbSBcImRlZ2l0XCI7XHJcbmltcG9ydCB7IGV4ZWMgfSBmcm9tIFwiY2hpbGRfcHJvY2Vzc1wiO1xyXG5pbXBvcnQgR2l0IGZyb20gXCJzaW1wbGUtZ2l0L3Byb21pc2VcIjtcclxuXHJcbmNvbnN0IGdpdCA9IEdpdCgpO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgKHtcclxuICAgIGNvbW1hbmQ6IGBjcmVhdGUgW3RlbXBsYXRlXSBbbmFtZV1gLFxyXG4gICAgaGVscDogYENyZWF0ZSBhIG5ldyBpc2VrYWkgcHJvamVjdCBmcm9tIFt0ZW1wbGF0ZV0gb3IgQGlzZWthaS90ZW1wbGF0ZWAsXHJcbiAgICBhbGlhczogWyBgaW5pdGAgXSxcclxuICAgIG9wdGlvbnM6IHtcclxuICAgICAgICBcIi1mLCAtLWZvcmNlXCI6IGBmb3JjZSBvdmVyd3JpdGUgZnJvbSB0ZW1wbGF0ZWBcclxuICAgIH0sXHJcbiAgICBoYW5kbGVyOiAoe1xyXG4gICAgICAgIHRlbXBsYXRlID0gYGlzZWthaS1kZXYvdGVtcGxhdGVgLFxyXG4gICAgICAgIG5hbWUgPSBgLmAsXHJcbiAgICAgICAgb3B0aW9uczoge1xyXG4gICAgICAgICAgICBmb3JjZSA9IGZhbHNlXHJcbiAgICAgICAgfSA9IGZhbHNlXHJcbiAgICB9KSA9PiBkZWdpdCh0ZW1wbGF0ZSwgeyBmb3JjZSB9KS5cclxuICAgICAgICBjbG9uZShuYW1lKS5cclxuICAgICAgICB0aGVuKCgpID0+IGdpdC5pbml0KCkpLlxyXG4gICAgICAgIHRoZW4oKCkgPT4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xyXG4gICAgICAgICAgICBjb25zb2xlLmxvZyhgJHt0ZW1wbGF0ZX0gY29waWVkIHRvICR7bmFtZX1gKTtcclxuICAgICAgICAgICAgY29uc29sZS5sb2coYElOU1RBTExJTkc6IFRISVMgTUFZIFRBS0UgQVdISUxFYCk7XHJcbiAgICAgICAgICAgIGV4ZWMoYG5wbSBpbnN0YWxsYCwgKGVycikgPT4ge1xyXG4gICAgICAgICAgICAgICAgaWYoZXJyKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmVqZWN0KGVycik7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICByZXNvbHZlKCk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0pKS5cclxuICAgICAgICB0aGVuKCgpID0+IHtcclxuICAgICAgICAgICAgY29uc29sZS5sb2coYENPTVBMRVRFOiBbcnVuXSB0byBzdGFydCB5b3VyIERBRU1PTnMuYCk7XHJcbiAgICAgICAgfSlcclxufSk7IiwiaW1wb3J0IGdldF9saXN0IGZyb20gXCIuLi9saWIvZ2V0X2xpc3QuanNcIjtcclxuXHJcbmV4cG9ydCBkZWZhdWx0ICh7XHJcbiAgICBoZWxwOiBgU2hvdyBhdmFpbGFibGUgW0RBRU1PTl0gc2F2ZXMuYCxcclxuICAgIGFsaWFzOiBbIGBsc2AsIGBzYXZlc2AgXSxcclxuICAgIGhhbmRsZXI6IChhcmdzLCBjYikgPT4ge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKGdldF9saXN0KCkuXHJcbiAgICAgICAgICAgIG1hcCgoaSkgPT4gYFske2l9XWApLlxyXG4gICAgICAgICAgICBqb2luKGAgLSBgKSwgYFxcclxcbmApOyAgICBcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgY2IoKTtcclxuICAgIH1cclxufSk7IiwiLy8gcGlwZSBvdXQgdG8gcG0yXHJcbmltcG9ydCB7IHNwYXduIH0gZnJvbSBcImNoaWxkX3Byb2Nlc3NcIjtcclxuaW1wb3J0IHBhdGggZnJvbSBcInBhdGhcIjtcclxuXHJcbmNvbnN0IHBtMl9wYXRoID0gcGF0aC5kaXJuYW1lKHJlcXVpcmUucmVzb2x2ZShgcG0yYCkpO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgKHsgY29tbWFuZHMgfSkgPT4ge1xyXG4gICAgbGV0IG5vZGUgPSBzcGF3bihgbm9kZWAsIGAke3BtMl9wYXRofS9iaW4vcG0yICR7Y29tbWFuZHMuam9pbihgIGApfWAuc3BsaXQoYCBgKSwge1xyXG4gICAgICAgIGN3ZDogcHJvY2Vzcy5jd2QoKSxcclxuICAgICAgICBlbnY6IHByb2Nlc3MuZW52LFxyXG4gICAgICAgIHN0ZGlvOiBgaW5oZXJpdGBcclxuICAgIH0pO1xyXG5cclxuICAgIHJldHVybiB7XHJcbiAgICAgICAgZG9uZTogbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHtcclxuICAgICAgICAgICAgbm9kZS5vbihgY2xvc2VgLCAoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICByZXNvbHZlKCk7XHJcbiAgICAgICAgICAgICAgICBub2RlID0gZmFsc2U7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0pLFxyXG5cclxuICAgICAgICBjYW5jZWw6ICgpID0+IHtcclxuICAgICAgICAgICAgaWYoIW5vZGUpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgfVxyXG4gICAgXHJcbiAgICAgICAgICAgIG5vZGUua2lsbCgpO1xyXG4gICAgICAgIH0gICBcclxuICAgIH07XHJcbn07XHJcbiIsImltcG9ydCBwbTIgZnJvbSBcIi4uL2xpYi9wbTIuanNcIjtcclxuXHJcbmV4cG9ydCBkZWZhdWx0ICh7XHJcbiAgICBjb21tYW5kOiBgbG9ncyBbREFFTU9OUy4uLl1gLFxyXG4gICAgaGVscDogYGZvbGxvdyB0aGUgYWN0aXZlIFtEQUVNT05dIGxvZ3NgLFxyXG4gICAgaGFuZGxlcjogKHsgREFFTU9OUyA9IFtdIH0pID0+IHBtMih7XHJcbiAgICAgICAgY29tbWFuZHM6IFsgYGxvZ3NgLCAuLi5EQUVNT05TIF1cclxuICAgIH0pLmRvbmVcclxuICAgIFxyXG59KTsiLCJpbXBvcnQgR2l0IGZyb20gXCJzaW1wbGUtZ2l0L3Byb21pc2VcIjtcclxuaW1wb3J0IHsgZXhlYyB9IGZyb20gXCJjaGlsZF9wcm9jZXNzXCI7XHJcblxyXG5jb25zdCBnaXQgPSBHaXQoKTtcclxuXHJcbmV4cG9ydCBkZWZhdWx0ICh7XHJcbiAgICBjb21tYW5kOiBgcHVsbGAsXHJcbiAgICBoZWxwOiBgZ2V0IGN1cnJlbnQgZmlsZXMgZnJvbSBzb3VyY2UgY29udHJvbGAsXHJcbiAgICBoYW5kbGVyOiAoKSA9PiBnaXQucHVsbChgb3JpZ2luYCwgYG1hc3RlcmApLlxyXG4gICAgICAgIHRoZW4oKCkgPT4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xyXG4gICAgICAgICAgICBleGVjKGBucG0gaW5zdGFsbGAsIChlcnIpID0+IHtcclxuICAgICAgICAgICAgICAgIGlmKGVycikge1xyXG4gICAgICAgICAgICAgICAgICAgIHJlamVjdChlcnIpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgcmVzb2x2ZSgpO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9KSkuXHJcbiAgICAgICAgdGhlbigoKSA9PiBjb25zb2xlLmxvZyhgUHVsbGVkIGxhdGVzdCBmcm9tIHNvdXJjZSBjb250cm9sLmApKVxyXG59KTtcclxuIiwiaW1wb3J0IGZldGNoIGZyb20gXCJub2RlLWZldGNoXCI7XHJcbmltcG9ydCBnbG9iIGZyb20gXCJnbG9iXCI7XHJcbmltcG9ydCBnZXRfY29uZmlnIGZyb20gXCIuLi9saWIvZ2V0X2NvbmZpZy5qc1wiO1xyXG5pbXBvcnQgcGF0aCBmcm9tIFwicGF0aFwiO1xyXG5cclxuLy8gVE9ETzogVGhpcyBzaG91bGQgcmVhbGx5IGJlIGV4cG9zZWQgYnkgaXNla2FpIGNvcmUgc29tZSBob3cuIExpa2UgYSB3YXkgdG8gYWRkIGluIHRvb2xzXHJcbmV4cG9ydCBkZWZhdWx0ICh7XHJcbiAgICBjb21tYW5kOiBgcHVzaGAsXHJcbiAgICBhbGlhczogWyBgcHVibGlzaGAgXSxcclxuICAgIGFzeW5jIGhhbmRsZXIoKSB7XHJcbiAgICAgICAgYXdhaXQgUHJvbWlzZS5hbGwoZ2xvYi5zeW5jKGAuL0RBRU1PTlMvKi50b21sYCkuXHJcbiAgICAgICAgICAgIG1hcCgoREFFTU9OKSA9PiB7XHJcbiAgICAgICAgICAgICAgICBjb25zdCB7IEFETUlOIH0gPSBnZXRfY29uZmlnKERBRU1PTik7XHJcbiAgICAgICAgICAgICAgICBpZihBRE1JTiAmJiBBRE1JTi56YWxnbykge1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHsgXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHVybCA9IGBodHRwOi8vbG9jYWxob3N0OjgwODBgLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB6YWxnbyBcclxuICAgICAgICAgICAgICAgICAgICB9ID0gQURNSU47XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coYFBVU0hJTkcgWyR7cGF0aC5iYXNlbmFtZShEQUVNT04sIGAudG9tbGApfV0gLSAke3VybH1gKTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZldGNoKGAke3VybH0vemFsZ29gLCB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG1ldGhvZDogYFBPU1RgLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBjYWNoZTogYG5vLWNhY2hlYCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgaGVhZGVyczoge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJDb250ZW50LVR5cGVcIjogYGFwcGxpY2F0aW9uL2pzb25gXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHphbGdvXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pXHJcbiAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xyXG4gICAgICAgICAgICB9KSk7XHJcblxyXG4gICAgfVxyXG59KTsiLCJpbXBvcnQgZ2V0X3NraWxscyBmcm9tIFwiLi4vbGliL2dldF9za2lsbHMuanNcIjtcclxuXHJcbmV4cG9ydCBkZWZhdWx0ICh7XHJcbiAgICBjb21tYW5kOiBgc2tpbGxzYCxcclxuICAgIGhlbHA6IGBMaXN0IGF2YWlsYWJsZSBza2lsbHNgLFxyXG5cclxuICAgIGhhbmRsZXI6ICgpID0+IHtcclxuICAgICAgICBjb25zdCB7XHJcbiAgICAgICAgICAgIFNIT1AsXHJcbiAgICAgICAgICAgIFNLSUxMU1xyXG4gICAgICAgIH0gPSBnZXRfc2tpbGxzKCk7XHJcblxyXG4gICAgICAgIGNvbnNvbGUubG9nKGBcclxuU0hPUFxyXG4ke09iamVjdC5rZXlzKFNIT1ApLlxyXG4gICAgICAgIG1hcCgocykgPT4gYFske3N9XWApLlxyXG4gICAgICAgIGpvaW4oYCA9IGApfVxyXG5cclxuU0tJTExTXHJcbiR7T2JqZWN0LmtleXMoU0tJTExTKS5cclxuICAgICAgICBtYXAoKHMpID0+IGBbJHtzfV1gKS5cclxuICAgICAgICBqb2luKGAgbyBgKX1cclxuYCk7XHJcbiAgICB9XHJcbn0pOyIsImltcG9ydCBwbTIgZnJvbSBcInBtMlwiO1xyXG5cclxuaW1wb3J0IHRvbWxfdG9fanMgZnJvbSBcIi4uL3RyYW5zZm9ybXMvdG9tbF90b19qcy5qc1wiO1xyXG5cclxuaW1wb3J0IHByb21wdF9kYWVtb25zIGZyb20gXCIuLi9saWIvcHJvbXB0X2RhZW1vbnMuanNcIjtcclxuXHJcbmV4cG9ydCBkZWZhdWx0ICh7XHJcbiAgICBjb21tYW5kZXI6IGBzcGF3biBbREFFTU9OUy4uLl1gLFxyXG4gICAgaGVscDogYHNwYXduIFtEQUVNT05TXSBmaWxlc2AsXHJcbiAgICBoaWRkZW46IHRydWUsXHJcbiAgICBhc3luYyBoYW5kbGVyKHsgREFFTU9OUyB9KSB7XHJcbiAgICAgICAgY29uc3QgREFFTU9OcyA9IGF3YWl0IHByb21wdF9kYWVtb25zKHtcclxuICAgICAgICAgICAgY21kOiB0aGlzLFxyXG4gICAgICAgICAgICBEQUVNT05TXHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIERBRU1PTnMuZm9yRWFjaCgoREFFTU9OKSA9PiB7XHJcbiAgICAgICAgICAgIGNvbnN0IHtcclxuICAgICAgICAgICAgICAgIG91dHB1dCxcclxuICAgICAgICAgICAgfSA9IHRvbWxfdG9fanMoYC4vREFFTU9OUy8ke0RBRU1PTn0udG9tbGApO1xyXG5cclxuICAgICAgICAgICAgLy8gSEFDSzogY291bGQgbmFtZSB0aGUgZmlsZSBvZiB0aGUgVE9NTCBzb21ldGhpbmcgZ25hcmx5XHJcbiAgICAgICAgICAgIHBtMi5zdGFydCh7XHJcbiAgICAgICAgICAgICAgICBuYW1lOiBEQUVNT04sXHJcbiAgICAgICAgICAgICAgICBzY3JpcHQ6IG91dHB1dCxcclxuICAgICAgICAgICAgICAgIHdhdGNoOiBgLi8ke291dHB1dH1gLFxyXG4gICAgICAgICAgICAgICAgZm9yY2U6IHRydWUsXHJcbiAgICAgICAgICAgICAgICB3YXRjaF9vcHRpb25zOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgLy8geXVwIFBNMiB3YXMgc2V0dGluZyBhIGRlZmF1bHQgaWdub3JlXHJcbiAgICAgICAgICAgICAgICAgICAgaWdub3JlZDogYGAsXHJcbiAgICAgICAgICAgICAgICAgICAgdXNlUG9sbGluZzogdHJ1ZVxyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIG1heF9yZXN0YXJ0OiAwXHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG59KTtcclxuIiwiZXhwb3J0IGRlZmF1bHQgKFxyXG4gICAgYWN0aW9uX21hcCwgXHJcbiAgICByZWR1Y2VyID0gKGkpID0+IGlcclxuKSA9PiAoaW5wdXQpID0+IHtcclxuICAgIGNvbnN0IGtleSA9IHJlZHVjZXIoaW5wdXQpO1xyXG5cclxuICAgIGlmKCFhY3Rpb25fbWFwW2tleV0pIHtcclxuICAgICAgICByZXR1cm47XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIGFjdGlvbl9tYXBba2V5XShpbnB1dCk7XHJcbn07IiwiaW1wb3J0IGNob2tpZGFyIGZyb20gXCJjaG9raWRhclwiO1xyXG5pbXBvcnQgcm9sbHVwIGZyb20gXCJyb2xsdXBcIjtcclxuaW1wb3J0IGMgZnJvbSBcImNoYWxrXCI7XHJcblxyXG5pbXBvcnQgdG9tbF90b19qcyBmcm9tIFwiLi4vdHJhbnNmb3Jtcy90b21sX3RvX2pzLmpzXCI7XHJcblxyXG5pbXBvcnQgYWN0aW9uIGZyb20gXCIuLi9saWIvYWN0aW9uLmpzXCI7XHJcbmltcG9ydCBwcm9tcHRfZGFlbW9ucyBmcm9tIFwiLi4vbGliL3Byb21wdF9kYWVtb25zLmpzXCI7XHJcblxyXG5leHBvcnQgZGVmYXVsdCAoe1xyXG4gICAgY29tbWFuZDogYGxvYWQgW0RBRU1PTlMuLi5dYCxcclxuICAgIGhlbHA6IGBsb2FkIFtEQUVNT05dIHNhdmVzYCxcclxuICAgIGFsaWFzOiBbIGByZWdlbmVyYXRlYCwgYHJlY3JlYXRlYCwgYHdhdGNoYCBdLFxyXG4gICAgaGlkZGVuOiB0cnVlLFxyXG4gICAgY2FuY2VsICgpIHtcclxuICAgICAgICB0aGlzLndhdGNoZXJzLmZvckVhY2goKHdhdGNoZXIpID0+IHdhdGNoZXIuY2xvc2UoKSk7XHJcbiAgICAgICAgY29uc29sZS5sb2coYFlPVVIgV0FUQ0ggSEFTIEVOREVEYCk7XHJcbiAgICB9LFxyXG4gICAgYXN5bmMgaGFuZGxlcih7IERBRU1PTlMgfSkge1xyXG4gICAgICAgIHRoaXMud2F0Y2hlcnMgPSBbXTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgY29uc3QgREFFTU9OcyA9IGF3YWl0IHByb21wdF9kYWVtb25zKHtcclxuICAgICAgICAgICAgY21kOiB0aGlzLFxyXG4gICAgICAgICAgICBEQUVNT05TXHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgREFFTU9Ocy5mb3JFYWNoKCh0YXJnZXQpID0+IHtcclxuICAgICAgICAgICAgY29uc3QgZmlsZV9wYXRoID0gYC4vREFFTU9OUy8ke3RhcmdldH0udG9tbGA7XHJcblxyXG4gICAgICAgICAgICBjb25zdCBkYXRhID0gdG9tbF90b19qcyhmaWxlX3BhdGgpO1xyXG5cclxuICAgICAgICAgICAgY29uc3QgeyBidWlsZF9pbmZvIH0gPSBkYXRhO1xyXG4gICAgICAgIFxyXG4gICAgICAgICAgICAvLyByZWJ1aWxkIG9uIGZpbGUgY2hhZ25lXHJcbiAgICAgICAgICAgIGNvbnN0IHdhdGNoZXIgPSBjaG9raWRhci53YXRjaChmaWxlX3BhdGgpO1xyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHdhdGNoZXIub24oYGNoYW5nZWAsICgpID0+IHtcclxuICAgICAgICAgICAgICAgIHRvbWxfdG9fanMoZmlsZV9wYXRoKTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgdGhpcy53YXRjaGVycy5wdXNoKHdhdGNoZXIpO1xyXG5cclxuICAgICAgICAgICAgY29uc3Qgcm9sbHVwX3dhdGNoZXIgPSByb2xsdXAud2F0Y2goe1xyXG4gICAgICAgICAgICAgICAgLi4uYnVpbGRfaW5mbyxcclxuICAgICAgICAgICAgICAgIHdhdGNoOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgY2xlYXJTY3JlZW46IHRydWVcclxuICAgICAgICAgICAgICAgIH0gICBcclxuICAgICAgICAgICAgfSkuXHJcbiAgICAgICAgICAgICAgICBvbihgZXZlbnRgLCBhY3Rpb24oe1xyXG4gICAgICAgICAgICAgICAgICAgIEVSUk9SOiAoZSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhlKTtcclxuICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgIEZBVEFMOiAoeyBlcnJvciB9KSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoYy5yZWQuYm9sZChlcnJvcikpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH0sICh7IGNvZGUgfSkgPT4gY29kZSBcclxuICAgICAgICAgICAgICAgICkpO1xyXG5cclxuICAgICAgICAgICAgdGhpcy53YXRjaGVycy5wdXNoKHJvbGx1cF93YXRjaGVyKTtcclxuICAgICAgICB9KTtcclxuICAgIH1cclxufSk7XHJcbiIsImltcG9ydCBwbTIgZnJvbSBcIi4uL2xpYi9wbTIuanNcIjtcclxuaW1wb3J0IGdldF9saXN0IGZyb20gXCIuLi9saWIvZ2V0X2xpc3QuanNcIjtcclxuXHJcbmV4cG9ydCBkZWZhdWx0ICh7XHJcbiAgICBjb21tYW5kOiBgc2xheSBbREFFTU9OUy4uLl1gLFxyXG4gICAgaGVscDogYHNsYXkgYWN0aXZlIFtEQUVNT05TXWAsIFxyXG4gICAgYWxpYXM6IFsgYHVuc3VtbW9uYCwgYGtpbGxgLCBgc2xheWAsIGBzdG9wYCBdLFxyXG4gICAgY2FuY2VsKCkge1xyXG4gICAgICAgIHRoaXMuY2FuY2VsZXIoKTtcclxuICAgIH0sXHJcbiAgICBcclxuICAgIGhhbmRsZXIoeyBEQUVNT05TID0gZ2V0X2xpc3QoKSB9ID0gZmFsc2UpIHtcclxuICAgICAgICBjb25zdCB3aG9tID0gREFFTU9OUy5tYXAoKGNoYXIpID0+IGBbJHtjaGFyfV1gKS5cclxuICAgICAgICAgICAgam9pbihgIC0gYCk7XHJcblxyXG4gICAgICAgIGNvbnNvbGUubG9nKGBTTEFZSU5HICR7d2hvbX1gKTtcclxuXHJcbiAgICAgICAgY29uc3QgeyBjYW5jZWwsIGRvbmUgfSA9IHBtMih7XHJcbiAgICAgICAgICAgIGNvbW1hbmRzOiBbIGBkZWxldGVgLCBgYWxsYCBdXHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIHRoaXMuY2FuY2VsZXIgPSBjYW5jZWw7XHJcblxyXG4gICAgICAgIHJldHVybiBkb25lO1xyXG4gICAgfVxyXG59KTtcclxuXHJcbiIsImltcG9ydCB3YXRjaCBmcm9tIFwiLi93YXRjaC5qc1wiO1xyXG5pbXBvcnQgc3Bhd24gZnJvbSBcIi4vc3Bhd24uanNcIjtcclxuaW1wb3J0IHBtMiBmcm9tIFwiLi4vbGliL3BtMi5qc1wiO1xyXG5cclxuaW1wb3J0IHN0b3AgZnJvbSBcIi4vc3RvcC5qc1wiO1xyXG5pbXBvcnQgcHJvbXB0X2RhZW1vbnMgZnJvbSBcIi4uL2xpYi9wcm9tcHRfZGFlbW9ucy5qc1wiO1xyXG5cclxuY29uc3QgcnVuX2RhZW1vbnMgPSAoeyBEQUVNT05TIH0pID0+IHtcclxuICAgIHdhdGNoLmhhbmRsZXIoeyBEQUVNT05TIH0pO1xyXG4gICAgc3Bhd24uaGFuZGxlcih7IERBRU1PTlMgfSk7XHJcblxyXG4gICAgcmV0dXJuIHBtMih7XHJcbiAgICAgICAgY29tbWFuZHM6IFsgYGxvZ3NgIF1cclxuICAgIH0pLmRvbmU7XHJcbn07XHJcblxyXG5leHBvcnQgZGVmYXVsdCAoe1xyXG4gICAgY29tbWFuZDogYHN1bW1vbiBbREFFTU9OUy4uLl1gLFxyXG4gICAgaGVscDogYHN1bW1vbiBhbmQgd2F0Y2ggW0RBRU1PTlMuLi5dYCxcclxuICAgIGFsaWFzOiBbIGBkZXZgLCBgc3RhcnRgLCBgcnVuYCBdLFxyXG4gICAgYXN5bmMgaGFuZGxlcih7IERBRU1PTlMgfSkge1xyXG4gICAgICAgIGNvbnN0IERBRU1PTnMgPSBhd2FpdCBwcm9tcHRfZGFlbW9ucyh7XHJcbiAgICAgICAgICAgIGNtZDogdGhpcyxcclxuICAgICAgICAgICAgREFFTU9OU1xyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICBhd2FpdCBzdG9wLmhhbmRsZXIoKTtcclxuICAgICAgICBcclxuICAgICAgICByZXR1cm4gcnVuX2RhZW1vbnMoeyBEQUVNT05TOiBEQUVNT05zIH0pO1xyXG4gICAgfSxcclxuXHJcbiAgICBjYW5jZWwoKSB7XHJcbiAgICAgICAgd2F0Y2guY2FuY2VsKCk7XHJcbiAgICB9XHJcbn0pO1xyXG5cclxuIiwiaW1wb3J0IHBtMiBmcm9tIFwiLi4vbGliL3BtMi5qc1wiO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQoe1xyXG4gICAgY29tbWFuZDogYHN0YXR1cyBbREFFTU9OXWAsXHJcbiAgICBoZWxwOiBgc3RhdHVzIG9mIGFjdGl2ZSBbREFFTU9OXXMuYCxcclxuICAgIGFsaWFzOiBbIGBwc2AsIGBhY3RpdmVgLCBgc3RhdHNgIF0sXHJcbiAgICBoYW5kbGVyOiAoKSA9PiBwbTIoe1xyXG4gICAgICAgIGNvbW1hbmRzOiBbIGBwc2AgXVxyXG4gICAgfSkuZG9uZVxyXG59KTsiLCJpbXBvcnQgeyB2ZXJzaW9uIH0gZnJvbSBcIi4uLy4uL3BhY2thZ2UuanNvblwiO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgKHtcclxuICAgIGNvbW1hbmQ6IGB2ZXJzaW9uYCxcclxuICAgIGhlbHA6IGBWZXJzaW9uIGlzICR7dmVyc2lvbn1gLFxyXG4gICAgaGFuZGxlcjogKCkgPT4ge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKHZlcnNpb24pO1xyXG4gICAgfVxyXG59KTsiLCJjb25zdCByZXMgPSB7fTtcbmltcG9ydCBmMCBmcm9tIFwiL1VzZXJzL0dhbWVzL1Byb2plY3RzL0lTRUtBSS9zcmMvY29tbWFuZHMvYnVpbGQuanNcIjtcbnJlc1tcImJ1aWxkXCJdID0gZjA7XG5pbXBvcnQgZjEgZnJvbSBcIi9Vc2Vycy9HYW1lcy9Qcm9qZWN0cy9JU0VLQUkvc3JjL2NvbW1hbmRzL2NvbW1pdC5qc1wiO1xucmVzW1wiY29tbWl0XCJdID0gZjE7XG5pbXBvcnQgZjIgZnJvbSBcIi9Vc2Vycy9HYW1lcy9Qcm9qZWN0cy9JU0VLQUkvc3JjL2NvbW1hbmRzL2NyZWF0ZS5qc1wiO1xucmVzW1wiY3JlYXRlXCJdID0gZjI7XG5pbXBvcnQgZjMgZnJvbSBcIi9Vc2Vycy9HYW1lcy9Qcm9qZWN0cy9JU0VLQUkvc3JjL2NvbW1hbmRzL2RhZW1vbnMuanNcIjtcbnJlc1tcImRhZW1vbnNcIl0gPSBmMztcbmltcG9ydCBmNCBmcm9tIFwiL1VzZXJzL0dhbWVzL1Byb2plY3RzL0lTRUtBSS9zcmMvY29tbWFuZHMvbG9ncy5qc1wiO1xucmVzW1wibG9nc1wiXSA9IGY0O1xuaW1wb3J0IGY1IGZyb20gXCIvVXNlcnMvR2FtZXMvUHJvamVjdHMvSVNFS0FJL3NyYy9jb21tYW5kcy9wdWxsLmpzXCI7XG5yZXNbXCJwdWxsXCJdID0gZjU7XG5pbXBvcnQgZjYgZnJvbSBcIi9Vc2Vycy9HYW1lcy9Qcm9qZWN0cy9JU0VLQUkvc3JjL2NvbW1hbmRzL3B1c2guanNcIjtcbnJlc1tcInB1c2hcIl0gPSBmNjtcbmltcG9ydCBmNyBmcm9tIFwiL1VzZXJzL0dhbWVzL1Byb2plY3RzL0lTRUtBSS9zcmMvY29tbWFuZHMvc2tpbGxzLmpzXCI7XG5yZXNbXCJza2lsbHNcIl0gPSBmNztcbmltcG9ydCBmOCBmcm9tIFwiL1VzZXJzL0dhbWVzL1Byb2plY3RzL0lTRUtBSS9zcmMvY29tbWFuZHMvc3Bhd24uanNcIjtcbnJlc1tcInNwYXduXCJdID0gZjg7XG5pbXBvcnQgZjkgZnJvbSBcIi9Vc2Vycy9HYW1lcy9Qcm9qZWN0cy9JU0VLQUkvc3JjL2NvbW1hbmRzL3N0YXJ0LmpzXCI7XG5yZXNbXCJzdGFydFwiXSA9IGY5O1xuaW1wb3J0IGYxMCBmcm9tIFwiL1VzZXJzL0dhbWVzL1Byb2plY3RzL0lTRUtBSS9zcmMvY29tbWFuZHMvc3RhdHVzLmpzXCI7XG5yZXNbXCJzdGF0dXNcIl0gPSBmMTA7XG5pbXBvcnQgZjExIGZyb20gXCIvVXNlcnMvR2FtZXMvUHJvamVjdHMvSVNFS0FJL3NyYy9jb21tYW5kcy9zdG9wLmpzXCI7XG5yZXNbXCJzdG9wXCJdID0gZjExO1xuaW1wb3J0IGYxMiBmcm9tIFwiL1VzZXJzL0dhbWVzL1Byb2plY3RzL0lTRUtBSS9zcmMvY29tbWFuZHMvdmVyc2lvbi5qc1wiO1xucmVzW1widmVyc2lvblwiXSA9IGYxMjtcbmltcG9ydCBmMTMgZnJvbSBcIi9Vc2Vycy9HYW1lcy9Qcm9qZWN0cy9JU0VLQUkvc3JjL2NvbW1hbmRzL3dhdGNoLmpzXCI7XG5yZXNbXCJ3YXRjaFwiXSA9IGYxMztcbmV4cG9ydCBkZWZhdWx0IHJlczsiLCJpbXBvcnQgYyBmcm9tIFwiY2hhbGtcIjtcclxuXHJcbmNvbnN0IHsgbG9nIH0gPSBjb25zb2xlO1xyXG5cclxuY29uc29sZS5sb2cgPSAoLi4uYXJncykgPT4gbG9nKFxyXG4gICAgLi4uYXJncy5tYXAoXHJcbiAgICAgICAgKGl0ZW0pID0+IHR5cGVvZiBpdGVtID09PSBgc3RyaW5nYFxyXG4gICAgICAgICAgICA/IGMuZ3JlZW4oXHJcbiAgICAgICAgICAgICAgICBpdGVtLnJlcGxhY2UoLyhcXFsuW15cXF1cXFtdKlxcXSkvdWcsIGMuYm9sZC53aGl0ZShgJDFgKSlcclxuICAgICAgICAgICAgKVxyXG4gICAgICAgICAgICA6IGl0ZW1cclxuICAgIClcclxuKTtcclxuIiwiIyEvdXNyL2Jpbi9lbnYgbm9kZVxyXG5cclxuaW1wb3J0IHZvcnBhbCBmcm9tIFwidm9ycGFsXCI7XHJcbmltcG9ydCBjb21tYW5kcyBmcm9tIFwiLi9jb21tYW5kcy8qLmpzXCI7XHJcbmltcG9ydCB7IHZlcnNpb24gfSBmcm9tIFwiLi4vcGFja2FnZS5qc29uXCI7XHJcblxyXG5pbXBvcnQgXCIuL2xpYi9mb3JtYXQuanNcIjtcclxuXHJcbmltcG9ydCBjaGFsayBmcm9tIFwiY2hhbGtcIjtcclxuXHJcbmNvbnN0IHYgPSB2b3JwYWwoKTtcclxuXHJcbk9iamVjdC5lbnRyaWVzKGNvbW1hbmRzKS5cclxuICAgIGZvckVhY2goKFtcclxuICAgICAgICBuYW1lLCB7XHJcbiAgICAgICAgICAgIGhlbHAsXHJcbiAgICAgICAgICAgIGhhbmRsZXIsXHJcbiAgICAgICAgICAgIGF1dG9jb21wbGV0ZSxcclxuICAgICAgICAgICAgaGlkZGVuLFxyXG4gICAgICAgICAgICBjb21tYW5kLFxyXG4gICAgICAgICAgICBhbGlhcyA9IFtdLFxyXG4gICAgICAgICAgICBvcHRpb25zID0ge30sXHJcbiAgICAgICAgICAgIGNhbmNlbCA9ICgpID0+IHt9XHJcbiAgICAgICAgfVxyXG4gICAgXSkgPT4geyBcclxuICAgICAgICBjb25zdCBpc3QgPSB2LmNvbW1hbmQoY29tbWFuZCB8fCBuYW1lLCBoZWxwKS5cclxuICAgICAgICAgICAgYWxpYXMoYWxpYXMpLlxyXG4gICAgICAgICAgICBhdXRvY29tcGxldGUoYXV0b2NvbXBsZXRlIHx8IFtdKS5cclxuICAgICAgICAgICAgY2FuY2VsKGNhbmNlbCkuXHJcbiAgICAgICAgICAgIGFjdGlvbihoYW5kbGVyKTtcclxuXHJcbiAgICAgICAgaWYoaGlkZGVuKSB7XHJcbiAgICAgICAgICAgIGlzdC5oaWRkZW4oKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIE9iamVjdC5lbnRyaWVzKG9wdGlvbnMpLlxyXG4gICAgICAgICAgICBmb3JFYWNoKChbIG9wdGlvbiwgb3B0aW9uX2hlbHAgXSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgaXN0Lm9wdGlvbihvcHRpb24sIG9wdGlvbl9oZWxwKTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICB9KTtcclxuXHJcbmNvbnN0IHN0YXJ0dXBfY29tbWFuZHMgPSBwcm9jZXNzLmFyZ3Yuc2xpY2UoMik7XHJcblxyXG5pZihzdGFydHVwX2NvbW1hbmRzLmxlbmd0aCA+IDApIHtcclxuICAgIHYuZXhlYyhzdGFydHVwX2NvbW1hbmRzLmpvaW4oYCBgKSk7XHJcbn0gZWxzZSB7XHJcblxyXG4gICAgcHJvY2Vzcy5zdGRvdXQud3JpdGUoYFxceDFCY2ApO1xyXG5cclxuICAgIGNvbnNvbGUubG9nKGNoYWxrLmdyZWVuKGBcclxu4paI4paI4pWX4paI4paI4paI4paI4paI4paI4paI4pWX4paI4paI4paI4paI4paI4paI4paI4pWX4paI4paI4pWXICDilojilojilZcg4paI4paI4paI4paI4paI4pWXIOKWiOKWiOKVlyAgICAgIOKWiOKWiOKWiOKWiOKWiOKWiOKWiOKVl+KWiOKWiOKWiOKVlyAgIOKWiOKWiOKVlyDilojilojilojilojilojilojilZcg4paI4paI4pWX4paI4paI4paI4pWXICAg4paI4paI4pWX4paI4paI4paI4paI4paI4paI4paI4pWXICAgIFxyXG7ilojilojilZHilojilojilZTilZDilZDilZDilZDilZ3ilojilojilZTilZDilZDilZDilZDilZ3ilojilojilZEg4paI4paI4pWU4pWd4paI4paI4pWU4pWQ4pWQ4paI4paI4pWX4paI4paI4pWR4paEIOKWiOKWiOKVl+KWhOKWiOKWiOKVlOKVkOKVkOKVkOKVkOKVneKWiOKWiOKWiOKWiOKVlyAg4paI4paI4pWR4paI4paI4pWU4pWQ4pWQ4pWQ4pWQ4pWdIOKWiOKWiOKVkeKWiOKWiOKWiOKWiOKVlyAg4paI4paI4pWR4paI4paI4pWU4pWQ4pWQ4pWQ4pWQ4pWdICAgIFxyXG7ilojilojilZHilojilojilojilojilojilojilojilZfilojilojilojilojilojilZcgIOKWiOKWiOKWiOKWiOKWiOKVlOKVnSDilojilojilojilojilojilojilojilZHilojilojilZEg4paI4paI4paI4paI4pWX4paI4paI4paI4paI4paI4pWXICDilojilojilZTilojilojilZcg4paI4paI4pWR4paI4paI4pWRICDilojilojilojilZfilojilojilZHilojilojilZTilojilojilZcg4paI4paI4pWR4paI4paI4paI4paI4paI4pWXICAgICAgXHJcbuKWiOKWiOKVkeKVmuKVkOKVkOKVkOKVkOKWiOKWiOKVkeKWiOKWiOKVlOKVkOKVkOKVnSAg4paI4paI4pWU4pWQ4paI4paI4pWXIOKWiOKWiOKVlOKVkOKVkOKWiOKWiOKVkeKWiOKWiOKVkeKWgOKVmuKWiOKWiOKVlOKWgOKWiOKWiOKVlOKVkOKVkOKVnSAg4paI4paI4pWR4pWa4paI4paI4pWX4paI4paI4pWR4paI4paI4pWRICAg4paI4paI4pWR4paI4paI4pWR4paI4paI4pWR4pWa4paI4paI4pWX4paI4paI4pWR4paI4paI4pWU4pWQ4pWQ4pWdICAgICAgXHJcbuKWiOKWiOKVkeKWiOKWiOKWiOKWiOKWiOKWiOKWiOKVkeKWiOKWiOKWiOKWiOKWiOKWiOKWiOKVl+KWiOKWiOKVkSAg4paI4paI4pWX4paI4paI4pWRICDilojilojilZHilojilojilZEgIOKVmuKVkOKVnSDilojilojilojilojilojilojilojilZfilojilojilZEg4pWa4paI4paI4paI4paI4pWR4pWa4paI4paI4paI4paI4paI4paI4pWU4pWd4paI4paI4pWR4paI4paI4pWRIOKVmuKWiOKWiOKWiOKWiOKVkeKWiOKWiOKWiOKWiOKWiOKWiOKWiOKVlyAgICBcclxu4pWa4pWQ4pWd4pWa4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWd4pWa4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWd4pWa4pWQ4pWdICDilZrilZDilZ3ilZrilZDilZ0gIOKVmuKVkOKVneKVmuKVkOKVnSAgICAgIOKVmuKVkOKVkOKVkOKVkOKVkOKVkOKVneKVmuKVkOKVnSAg4pWa4pWQ4pWQ4pWQ4pWdIOKVmuKVkOKVkOKVkOKVkOKVkOKVnSDilZrilZDilZ3ilZrilZDilZ0gIOKVmuKVkOKVkOKVkOKVneKVmuKVkOKVkOKVkOKVkOKVkOKVkOKVnSAgICBcclxuVkVSU0lPTjogJHt2ZXJzaW9ufSAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXHJcbmApKTtcclxuXHJcbiAgICB2LmRlbGltaXRlcihjaGFsay5ib2xkLmdyZWVuKGA+YCkpLlxyXG4gICAgICAgIHNob3coKTtcclxufSJdLCJuYW1lcyI6WyJjcmVhdGVGaWx0ZXIiLCJnbG9iIiwidGVyc2VyIiwidG9tbCIsImdpdCIsImV4ZWMiLCJzcGF3biIsInBtMiIsIndhdGNoIiwic3RvcCIsInZlcnNpb24iLCJjb21tYW5kcyIsImNoYWxrIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQVNBLE1BQU0sV0FBVyxHQUFHLENBQUMsTUFBTSxHQUFHLE9BQU8sQ0FBQyxHQUFHLEVBQUUsS0FBSztJQUM1QyxNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFDdkMsSUFBSSxNQUFNLEtBQUssTUFBTSxFQUFFO1FBQ25CLE9BQU8sTUFBTSxDQUFDO0tBQ2pCOztJQUVELE9BQU8sV0FBVyxDQUFDLE1BQU0sQ0FBQyxDQUFDO0NBQzlCLENBQUM7O0FBRUYsTUFBTSxRQUFRLEdBQUcsV0FBVyxFQUFFLENBQUM7QUFDL0IsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7O0FBRWhDLE1BQU0sV0FBVyxHQUFHLENBQUMsUUFBUSxLQUFLO0lBQzlCLE1BQU0sYUFBYSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDO1FBQ3JDLE9BQU8sQ0FBQyxRQUFRLEVBQUUsUUFBUSxDQUFDO1FBQzNCLEtBQUssQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDcEIs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
