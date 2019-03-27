#!/usr/bin/env node
'use strict';

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var vorpal = _interopDefault(require('vorpal'));
var glob$1 = _interopDefault(require('glob'));
var path = _interopDefault(require('path'));
var fs = _interopDefault(require('fs'));
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

var get_list = () => glob$1.sync(`./AVATARS/*.toml`).
    map((class_path) => path.basename(class_path, `.toml`));

var f0 = ({
    help: `Show available [AVATAR] saves.`,
    alias: [ `ls`, `saves`, `character` ],
    handler: (args, cb) => {
        console.log(get_list().
            map((i) => `[${i}]`).
            join(` - `), `\r\n`);    
            
        cb();
    }
});

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
                ...get_config(`./AVATARS/${other_file}.toml`),
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

        throw new Error(`You must specify either [NODE] or [BROWSER] for your target in your [AVATAR] toml`);
    }
}).
    reduce((state, fn) => ({
        ...state,
        ...fn(state)
    }), { configFile });

var filter_list = (classes) => classes.filter((target) => {
    const is_okay = get_list().
        indexOf(target) !== -1;

    if(!is_okay) {
        console.log(`${target} is not an available [AVATAR]`);
    }
        
    return is_okay;
});

var prompt_avatars = ({
    cmd,
    AVATARS
}) => {
    if(!AVATARS) {
        return cmd.prompt({
            type: `list`,
            name: `AVATAR`,
            message: `Which [AVATAR]?`,
            choices: [ `all`, ...get_list() ]
        }).
            then(({ AVATAR }) => {
                console.log(AVATAR, `AVATAR`);
                
                return AVATAR === `all` 
                    ? get_list() 
                    : filter_list([ AVATAR ]);
            });
    }
    
    if(AVATARS[0] === `all`) {
        return get_list();
    }

    return filter_list(AVATARS);
};

var f1 = ({
    command: `build [AVATARS...]`,
    help: `build all [AVATAR] save(s).`,
    hidden: true,
    async handler({ AVATARS }) {
        const avatars = await prompt_avatars({ 
            cmd: this,
            AVATARS 
        });

        const built = await Promise.all(avatars.map(async (target) => {
            const { build_info, name } = await toml_to_js(`./AVATARS/${target}.toml`);
            const bundle = await rollup.rollup(build_info);

            await bundle.write(build_info.output);
            console.log(`[${name}] Build Complete.\r\n`);
        }));

        console.log(`Built ${built.length} [AVATAR](s).`);
    }
});

const git = Git();

var f2 = ({
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

var f3 = ({
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
            console.log(`COMPLETE: [run] to start your avatars.`);
        })
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
    command: `logs [AVATARS...]`,
    help: `follow the active [AVATAR] logs`,
    handler: ({ AVATARS = [] }) => pm2({
        commands: [ `logs`, ...AVATARS ]
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
    command: `push <message>`,
    alias: [ `publish` ],
    handler: async ({ message }) => {
        await vorpal.exec(`commit ${message}`);

        await Promise.all(glob$1.sync(`./AVATARS/*.toml`).
            map((avatar) => {
                const { ADMIN } = get_config(avatar);
                if(ADMIN && ADMIN.zalgo) {
                    const { 
                        url = `http://localhost:8080`,
                        zalgo 
                    } = ADMIN;
                    console.log(`PUSHING [${avatar}] - ${url}`);

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
    commander: `spawn [AVATARS...]`,
    help: `spawn [AVATARS] files`,
    hidden: true,
    async handler({ AVATARS }) {
        const avatars = await prompt_avatars({
            cmd: this,
            AVATARS
        });

        avatars.forEach((avatar) => {
            const {
                output,
            } = toml_to_js(`./AVATARS/${avatar}.toml`);

            // HACK: could name the file of the TOML something gnarly
            pm2$1.start({
                name: avatar,
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
    command: `load [AVATARS...]`,
    help: `load [AVATAR] saves`,
    alias: [ `regenerate`, `recreate`, `watch` ],
    hidden: true,
    cancel () {
        this.watchers.forEach((watcher) => watcher.close());
        console.log(`YOUR WATCH HAS ENDED`);
    },
    async handler({ AVATARS }) {
        this.watchers = [];
            
        const avatars = await prompt_avatars({
            cmd: this,
            AVATARS
        });
        
        avatars.forEach((target) => {
            const file_path = `./AVATARS/${target}.toml`;

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

const run_avatars = ({ AVATARS }) => {
    f13.handler({ AVATARS });
    f8.handler({ AVATARS });

    return pm2({
        commands: [ `logs` ]
    }).done;
};

var f9 = ({
    command: `run [AVATARS...]`,
    help: `run and watch [AVATAR] files`,
    alias: [ `dev`, `start` ],
    async handler({ AVATARS }) {
        const avatars = await prompt_avatars({
            cmd: this,
            AVATARS
        });

        return run_avatars({ AVATARS: avatars });
    },

    cancel() {
        f13.cancel();
    }
});

var f10 = ({
    command: `status [AVATAR]`,
    help: `status of active [AVATAR]s.`,
    alias: [ `ps`, `active`, `stats` ],
    handler: () => pm2({
        commands: [ `ps` ]
    }).done
});

var f11 = ({
    command: `stop [AVATARS...]`,
    help: `stop active [AVATAR] files. `, 
    
    cancel() {
        this.canceler();
    },
    
    handler({ AVATARS = get_list() }) {
        const whom = AVATARS.map((char) => `[${char}]`).
            join(` - `);

        console.log(`STOPPING ${whom}`);

        const { cancel, done } = pm2({
            commands: [ `delete`, `all` ]
        });

        this.canceler = cancel;

        return done;
    }
});

var version$1 = "0.0.11";

var f12 = ({
    command: `version`,
    help: `Version is ${version$1}`,
    handler: () => {
        console.log(version$1);
    }
});

const res = {};
res["avatars"] = f0;
res["build"] = f1;
res["commit"] = f2;
res["create"] = f3;
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2xpLmpzIiwic291cmNlcyI6WyIuLi9zcmMvbGliL2dldF9saXN0LmpzIiwiLi4vc3JjL2NvbW1hbmRzL2F2YXRhcnMuanMiLCIuLi9zcmMvcm9sbHVwL3BsdWdpbi1nbG9iLmpzIiwiLi4vc3JjL3JvbGx1cC92ZXJzaW9uLmpzIiwiLi4vc3JjL3JvbGx1cC9idWlsZGVycy5qcyIsIi4uL3NyYy9saWIvZ2V0X3NraWxscy5qcyIsIi4uL3NyYy9saWIvZ2V0X2NvbmZpZy5qcyIsIi4uL3NyYy90cmFuc2Zvcm1zL3RvbWxfdG9fanMuanMiLCIuLi9zcmMvbGliL2ZpbHRlcl9saXN0LmpzIiwiLi4vc3JjL2xpYi9wcm9tcHRfYXZhdGFycy5qcyIsIi4uL3NyYy9jb21tYW5kcy9idWlsZC5qcyIsIi4uL3NyYy9jb21tYW5kcy9jb21taXQuanMiLCIuLi9zcmMvY29tbWFuZHMvY3JlYXRlLmpzIiwiLi4vc3JjL2xpYi9wbTIuanMiLCIuLi9zcmMvY29tbWFuZHMvbG9ncy5qcyIsIi4uL3NyYy9jb21tYW5kcy9wdWxsLmpzIiwiLi4vc3JjL2NvbW1hbmRzL3B1c2guanMiLCIuLi9zcmMvY29tbWFuZHMvc2tpbGxzLmpzIiwiLi4vc3JjL2NvbW1hbmRzL3NwYXduLmpzIiwiLi4vc3JjL2xpYi9hY3Rpb24uanMiLCIuLi9zcmMvY29tbWFuZHMvd2F0Y2guanMiLCIuLi9zcmMvY29tbWFuZHMvc3RhcnQuanMiLCIuLi9zcmMvY29tbWFuZHMvc3RhdHVzLmpzIiwiLi4vc3JjL2NvbW1hbmRzL3N0b3AuanMiLCIuLi9zcmMvY29tbWFuZHMvdmVyc2lvbi5qcyIsIi4uLzRlZTQ5NWZiMTgwZTJiNGE2NWE3YzE1MjYwOThiYjBkIiwiLi4vc3JjL2xpYi9mb3JtYXQuanMiLCIuLi9zcmMvY2xpLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBnbG9iIGZyb20gXCJnbG9iXCI7XHJcbmltcG9ydCBwYXRoIGZyb20gXCJwYXRoXCI7XHJcblxyXG5leHBvcnQgZGVmYXVsdCAoKSA9PiBnbG9iLnN5bmMoYC4vQVZBVEFSUy8qLnRvbWxgKS5cclxuICAgIG1hcCgoY2xhc3NfcGF0aCkgPT4gcGF0aC5iYXNlbmFtZShjbGFzc19wYXRoLCBgLnRvbWxgKSk7IiwiaW1wb3J0IGdldF9saXN0IGZyb20gXCIuLi9saWIvZ2V0X2xpc3QuanNcIjtcclxuXHJcbmV4cG9ydCBkZWZhdWx0ICh7XHJcbiAgICBoZWxwOiBgU2hvdyBhdmFpbGFibGUgW0FWQVRBUl0gc2F2ZXMuYCxcclxuICAgIGFsaWFzOiBbIGBsc2AsIGBzYXZlc2AsIGBjaGFyYWN0ZXJgIF0sXHJcbiAgICBoYW5kbGVyOiAoYXJncywgY2IpID0+IHtcclxuICAgICAgICBjb25zb2xlLmxvZyhnZXRfbGlzdCgpLlxyXG4gICAgICAgICAgICBtYXAoKGkpID0+IGBbJHtpfV1gKS5cclxuICAgICAgICAgICAgam9pbihgIC0gYCksIGBcXHJcXG5gKTsgICAgXHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgIGNiKCk7XHJcbiAgICB9XHJcbn0pOyIsIlxyXG5pbXBvcnQgZnMgZnJvbSBcImZzXCI7XHJcbmltcG9ydCBvcyBmcm9tIFwib3NcIjtcclxuaW1wb3J0IGdsb2IgZnJvbSBcImdsb2JcIjtcclxuaW1wb3J0IHBhdGggZnJvbSBcInBhdGhcIjtcclxuaW1wb3J0IG1kNSBmcm9tIFwibWQ1XCI7XHJcblxyXG5pbXBvcnQgeyBjcmVhdGVGaWx0ZXIgfSBmcm9tIFwicm9sbHVwLXBsdWdpbnV0aWxzXCI7XHJcblxyXG5jb25zdCBnZXRGU1ByZWZpeCA9IChwcmVmaXggPSBwcm9jZXNzLmN3ZCgpKSA9PiB7XHJcbiAgICBjb25zdCBwYXJlbnQgPSBwYXRoLmpvaW4ocHJlZml4LCBgLi5gKTtcclxuICAgIGlmIChwYXJlbnQgPT09IHByZWZpeCkge1xyXG4gICAgICAgIHJldHVybiBwcmVmaXg7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIHJldHVybiBnZXRGU1ByZWZpeChwYXJlbnQpO1xyXG59O1xyXG5cclxuY29uc3QgZnNQcmVmaXggPSBnZXRGU1ByZWZpeCgpO1xyXG5jb25zdCByb290UGF0aCA9IHBhdGguam9pbihgL2ApO1xyXG5cclxuY29uc3QgdG9VUkxTdHJpbmcgPSAoZmlsZVBhdGgpID0+IHtcclxuICAgIGNvbnN0IHBhdGhGcmFnbWVudHMgPSBwYXRoLmpvaW4oZmlsZVBhdGgpLlxyXG4gICAgICAgIHJlcGxhY2UoZnNQcmVmaXgsIHJvb3RQYXRoKS5cclxuICAgICAgICBzcGxpdChwYXRoLnNlcCk7XHJcbiAgICBpZiAoIXBhdGguaXNBYnNvbHV0ZShmaWxlUGF0aCkpIHtcclxuICAgICAgICBwYXRoRnJhZ21lbnRzLnVuc2hpZnQoYC5gKTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgcmV0dXJuIHBhdGhGcmFnbWVudHMuam9pbihgL2ApO1xyXG59O1xyXG5cclxuY29uc3QgcmVzb2x2ZU5hbWUgPSAoZnJvbSkgPT4gXHJcbiAgICBmcm9tLnNwbGl0KGAvYCkuXHJcbiAgICAgICAgcG9wKCkuXHJcbiAgICAgICAgc3BsaXQoYC5gKS5cclxuICAgICAgICBzaGlmdCgpO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgKHsgXHJcbiAgICBpbmNsdWRlLCBcclxuICAgIGV4Y2x1ZGUgXHJcbn0gPSBmYWxzZSkgPT4ge1xyXG4gICAgY29uc3QgZmlsdGVyID0gY3JlYXRlRmlsdGVyKGluY2x1ZGUsIGV4Y2x1ZGUpO1xyXG4gICAgXHJcbiAgICByZXR1cm4ge1xyXG4gICAgICAgIG5hbWU6IGByb2xsdXAtZ2xvYmAsXHJcbiAgICAgICAgbG9hZDogKGlkKSA9PiB7XHJcbiAgICAgICAgICAgIGNvbnN0IHNyY0ZpbGUgPSBwYXRoLmpvaW4ob3MudG1wZGlyKCksIGlkKTtcclxuXHJcbiAgICAgICAgICAgIGxldCBvcHRpb25zO1xyXG4gICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgb3B0aW9ucyA9IEpTT04ucGFyc2UoZnMucmVhZEZpbGVTeW5jKHNyY0ZpbGUpKTtcclxuICAgICAgICAgICAgfSBjYXRjaChlcnIpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgY29uc3QgeyBpbXBvcnRlZSwgaW1wb3J0ZXIgfSA9IG9wdGlvbnM7XHJcblxyXG4gICAgICAgICAgICBjb25zdCBpbXBvcnRlZUlzQWJzb2x1dGUgPSBwYXRoLmlzQWJzb2x1dGUoaW1wb3J0ZWUpO1xyXG4gICAgICAgICAgICBjb25zdCBjd2QgPSBwYXRoLmRpcm5hbWUoaW1wb3J0ZXIpO1xyXG4gICAgICAgICAgICBjb25zdCBnbG9iUGF0dGVybiA9IGltcG9ydGVlO1xyXG5cclxuICAgICAgICAgICAgY29uc3QgZmlsZXMgPSBnbG9iLnN5bmMoZ2xvYlBhdHRlcm4sIHtcclxuICAgICAgICAgICAgICAgIGN3ZFxyXG4gICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgIGxldCBjb2RlID0gWyBgY29uc3QgcmVzID0ge307YCBdO1xyXG4gICAgICAgICAgICBsZXQgaW1wb3J0QXJyYXkgPSBbXTtcclxuXHJcbiAgICAgICAgICAgIGZpbGVzLmZvckVhY2goKGZpbGUsIGkpID0+IHtcclxuICAgICAgICAgICAgICAgIGxldCBmcm9tO1xyXG4gICAgICAgICAgICAgICAgaWYgKGltcG9ydGVlSXNBYnNvbHV0ZSkge1xyXG4gICAgICAgICAgICAgICAgICAgIGZyb20gPSB0b1VSTFN0cmluZyhmaWxlKTtcclxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgZnJvbSA9IHRvVVJMU3RyaW5nKHBhdGgucmVzb2x2ZShjd2QsIGZpbGUpKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGNvZGUucHVzaChgaW1wb3J0IGYke2l9IGZyb20gXCIke2Zyb219XCI7YCk7XHJcbiAgICAgICAgICAgICAgICBjb2RlLnB1c2goYHJlc1tcIiR7cmVzb2x2ZU5hbWUoZnJvbSl9XCJdID0gZiR7aX07YCk7XHJcbiAgICAgICAgICAgICAgICBpbXBvcnRBcnJheS5wdXNoKGZyb20pO1xyXG4gICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgIGNvZGUucHVzaChgZXhwb3J0IGRlZmF1bHQgcmVzO2ApO1xyXG5cclxuICAgICAgICAgICAgY29kZSA9IGNvZGUuam9pbihgXFxuYCk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgICAgIHJldHVybiBjb2RlO1xyXG5cclxuICAgICAgICB9LFxyXG4gICAgICAgIHJlc29sdmVJZDogKGltcG9ydGVlLCBpbXBvcnRlcikgPT4ge1xyXG4gICAgICAgICAgICBpZiAoIWZpbHRlcihpbXBvcnRlZSkgfHwgIWltcG9ydGVlLmluY2x1ZGVzKGAqYCkpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgY29uc3QgaGFzaCA9IG1kNShpbXBvcnRlZSArIGltcG9ydGVyKTtcclxuXHJcbiAgICAgICAgICAgIGZzLndyaXRlRmlsZVN5bmMocGF0aC5qb2luKG9zLnRtcGRpcigpLCBoYXNoKSwgSlNPTi5zdHJpbmdpZnkoe1xyXG4gICAgICAgICAgICAgICAgaW1wb3J0ZWUsXHJcbiAgICAgICAgICAgICAgICBpbXBvcnRlclxyXG4gICAgICAgICAgICB9KSk7XHJcblxyXG4gICAgICAgICAgICByZXR1cm4gaGFzaDtcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG59OyIsImltcG9ydCBmcyBmcm9tIFwiZnNcIjtcclxuXHJcbmV4cG9ydCBkZWZhdWx0ICh7XHJcbiAgICBwYXRoLFxyXG4gICAgdmVyc2lvblxyXG59KSA9PiBcclxuICAgICh7XHJcbiAgICAgICAgbmFtZTogYHJvbGx1cC13cml0ZWAsXHJcbiAgICAgICAgYnVpbGRTdGFydDogKCkgPT4ge1xyXG4gICAgICAgICAgICBmcy53cml0ZUZpbGVTeW5jKHBhdGgsIHZlcnNpb24oKSk7XHJcbiAgICAgICAgfVxyXG4gICAgfSk7IiwiaW1wb3J0IHRvbWwgZnJvbSBcInJvbGx1cC1wbHVnaW4tdG9tbFwiO1xyXG5pbXBvcnQgc3ZlbHRlIGZyb20gXCJyb2xsdXAtcGx1Z2luLXN2ZWx0ZVwiO1xyXG5pbXBvcnQgcmVzb2x2ZSBmcm9tIFwicm9sbHVwLXBsdWdpbi1ub2RlLXJlc29sdmVcIjtcclxuaW1wb3J0IGNvcHkgZnJvbSBcInJvbGx1cC1wbHVnaW4tY29weS1nbG9iXCI7XHJcbmltcG9ydCByZXBsYWNlIGZyb20gXCJyb2xsdXAtcGx1Z2luLXJlcGxhY2VcIjtcclxuXHJcbmltcG9ydCBqc29uIGZyb20gXCJyb2xsdXAtcGx1Z2luLWpzb25cIjtcclxuaW1wb3J0IG1kIGZyb20gXCJyb2xsdXAtcGx1Z2luLWNvbW1vbm1hcmtcIjtcclxuaW1wb3J0IGNqcyBmcm9tIFwicm9sbHVwLXBsdWdpbi1jb21tb25qc1wiO1xyXG5cclxuaW1wb3J0IHsgdGVyc2VyIH0gZnJvbSBcInJvbGx1cC1wbHVnaW4tdGVyc2VyXCI7XHJcbmltcG9ydCB1dWlkIGZyb20gXCJ1dWlkL3YxXCI7XHJcblxyXG4vKlxyXG4gKiBpbXBvcnQgc3ByaXRlc21pdGggZnJvbSBcInJvbGx1cC1wbHVnaW4tc3ByaXRlXCI7XHJcbiAqIGltcG9ydCB0ZXh0dXJlUGFja2VyIGZyb20gXCJzcHJpdGVzbWl0aC10ZXh0dXJlcGFja2VyXCI7XHJcbiAqL1xyXG5cclxuaW1wb3J0IGdsb2IgZnJvbSBcIi4vcGx1Z2luLWdsb2IuanNcIjtcclxuaW1wb3J0IHZlcnNpb24gZnJvbSBcIi4vdmVyc2lvbi5qc1wiO1xyXG5cclxuY29uc3QgQ09ERV9WRVJTSU9OID0gdXVpZCgpO1xyXG5jb25zdCBwcm9kdWN0aW9uID0gIXByb2Nlc3MuZW52LlJPTExVUF9XQVRDSDtcclxuXHJcbmNvbnN0IGRvX2NvcHkgPSAoY29weU9iamVjdCkgPT4gY29weShPYmplY3Qua2V5cyhjb3B5T2JqZWN0KS5cclxuICAgIG1hcChcclxuICAgICAgICAoa2V5KSA9PiAoe1xyXG4gICAgICAgICAgICBmaWxlczoga2V5LFxyXG4gICAgICAgICAgICBkZXN0OiBjb3B5T2JqZWN0W2tleV1cclxuICAgICAgICB9KVxyXG4gICAgKSk7XHJcblxyXG5sZXQgQ0xJRU5UX1ZFUlNJT04gPSB1dWlkKCk7XHJcblxyXG5jb25zdCBleHRlcm5hbCA9IFtcclxuICAgIGBleHByZXNzYCxcclxuICAgIGBpc2VrYWlgLFxyXG4gICAgYGZzYCxcclxuICAgIGBodHRwYCxcclxuICAgIGBodHRwc2BcclxuXTtcclxuXHJcbmNvbnN0IG5vZGUgPSAoe1xyXG4gICAgaW5wdXQsXHJcbiAgICBvdXRwdXQsXHJcbiAgICBjb3B5OiBjb3B5T2JqZWN0ID0ge31cclxufSkgPT4gKHtcclxuICAgIGlucHV0LFxyXG4gICAgb3V0cHV0OiB7XHJcbiAgICAgICAgc291cmNlbWFwOiBgaW5saW5lYCxcclxuICAgICAgICBmaWxlOiBvdXRwdXQsXHJcbiAgICAgICAgZm9ybWF0OiBgY2pzYCxcclxuICAgIH0sXHJcbiAgICBleHRlcm5hbCxcclxuICAgIHBsdWdpbnM6IFtcclxuICAgICAgICBnbG9iKCksXHJcbiAgICAgICAgcmVwbGFjZSh7XHJcbiAgICAgICAgICAgIENPREVfVkVSU0lPTixcclxuICAgICAgICB9KSxcclxuICAgICAgICBtZCgpLFxyXG4gICAgICAgIGpzb24oKSxcclxuICAgICAgICBkb19jb3B5KGNvcHlPYmplY3QpLFxyXG4gICAgICAgIHRvbWxcclxuICAgIF0sXHJcbn0pO1xyXG5cclxuY29uc3QgYnJvd3NlciA9ICh7XHJcbiAgICBpbnB1dCxcclxuICAgIG91dHB1dCxcclxuICAgIGNzczogY3NzUGF0aCxcclxuICAgIGNvcHk6IGNvcHlPYmplY3QsXHJcbn0pID0+ICh7XHJcbiAgICBpbnB1dCxcclxuICAgIG91dHB1dDoge1xyXG4gICAgICAgIGZpbGU6IG91dHB1dCxcclxuICAgICAgICBmb3JtYXQ6IGBpaWZlYCxcclxuICAgIH0sXHJcbiAgICBleHRlcm5hbDogWyBgdXVpZGAsIGB1dWlkL3YxYCwgYHBpeGkuanNgIF0sXHJcbiAgICBwbHVnaW5zOiBbXHJcbiAgICAgICAgLy8gLy8gbWFrZSB0aGlzIGEgcmVhY3RpdmUgcGx1Z2luIHRvIFwiLnRpbGVtYXAuanNvblwiXHJcbiAgICAgICAgLy8gICAgIHNwcml0ZXNtaXRoKHtcclxuICAgICAgICAvLyAgICAgICAgIHNyYzoge1xyXG4gICAgICAgIC8vICAgICAgICAgICAgIGN3ZDogXCIuL2dvYmxpbi5saWZlL0JST1dTRVIuUElYSS9cclxuICAgICAgICAvLyAgICAgICAgICAgICBnbG9iOiBcIioqLyoucG5nXCJcclxuICAgICAgICAvLyAgICAgICAgIH0sXHJcbiAgICAgICAgLy8gICAgICAgICB0YXJnZXQ6IHtcclxuICAgICAgICAvLyAgICAgICAgICAgICBpbWFnZTogXCIuL2Jpbi9wdWJsaWMvaW1hZ2VzL3Nwcml0ZS5wbmdcIixcclxuICAgICAgICAvLyAgICAgICAgICAgICBjc3M6IFwiLi9iaW4vcHVibGljL2FydC9kZWZhdWx0Lmpzb25cIlxyXG4gICAgICAgIC8vICAgICAgICAgfSxcclxuICAgICAgICAvLyAgICAgICAgIG91dHB1dDoge1xyXG4gICAgICAgIC8vICAgICAgICAgICAgIGltYWdlOiBcIi4vYmluL3B1YmxpYy9pbWFnZXMvc3ByaXRlLnBuZ1wiXHJcbiAgICAgICAgLy8gICAgICAgICB9LFxyXG4gICAgICAgIC8vICAgICAgICAgc3ByaXRlc21pdGhPcHRpb25zOiB7XHJcbiAgICAgICAgLy8gICAgICAgICAgICAgcGFkZGluZzogMFxyXG4gICAgICAgIC8vICAgICAgICAgfSxcclxuICAgICAgICAvLyAgICAgICAgIGN1c3RvbVRlbXBsYXRlOiB0ZXh0dXJlUGFja2VyXHJcbiAgICAgICAgLy8gICAgIH0pLFxyXG4gICAgICAgIGdsb2IoKSxcclxuICAgICAgICBjanMoe1xyXG4gICAgICAgICAgICBpbmNsdWRlOiBgbm9kZV9tb2R1bGVzLyoqYCwgXHJcbiAgICAgICAgfSksXHJcbiAgICAgICAganNvbigpLFxyXG4gICAgICAgIHJlcGxhY2Uoe1xyXG4gICAgICAgICAgICBDT0RFX1ZFUlNJT04sXHJcbiAgICAgICAgICAgIENMSUVOVF9WRVJTSU9OOiAoKSA9PiBDTElFTlRfVkVSU0lPTlxyXG4gICAgICAgIH0pLFxyXG4gICAgICAgIHRvbWwsXHJcbiAgICAgICAgbWQoKSxcclxuICAgICAgICBzdmVsdGUoe1xyXG4gICAgICAgICAgICBjc3M6IChjc3MpID0+IHtcclxuICAgICAgICAgICAgICAgIGNzcy53cml0ZShjc3NQYXRoKTtcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICB9KSxcclxuICAgICAgICByZXNvbHZlKCksXHJcbiAgICAgICAgcHJvZHVjdGlvbiAmJiB0ZXJzZXIoKSxcclxuICAgICAgICBkb19jb3B5KGNvcHlPYmplY3QpLFxyXG4gICAgICAgIHZlcnNpb24oe1xyXG4gICAgICAgICAgICBwYXRoOiBgLi8uQklOL2NsaWVudC52ZXJzaW9uYCxcclxuICAgICAgICAgICAgdmVyc2lvbjogKCkgPT4gQ0xJRU5UX1ZFUlNJT05cclxuICAgICAgICB9KVxyXG4gICAgXVxyXG59KTtcclxuXHJcbmV4cG9ydCBkZWZhdWx0IHtcclxuICAgIG5vZGUsXHJcbiAgICBicm93c2VyXHJcbn07IiwiaW1wb3J0IHBhdGggZnJvbSBcInBhdGhcIjtcclxuaW1wb3J0IGdsb2IgZnJvbSBcImdsb2JcIjtcclxuXHJcbi8vIGRvbid0IHJlYWxseSBzdXBwb3J0IG92ZXJyaWRlc1xyXG5jb25zdCBnbG9iX29iaiA9IChvYmogPSB7fSwgZ2xvYl9wYXRoKSA9PiBnbG9iLnN5bmMoZ2xvYl9wYXRoKS5cclxuICAgIHJlZHVjZSgob2JqLCBlcXVpcF9wYXRoKSA9PiB7XHJcbiAgICAgICAgY29uc3QgcHJvamVjdF9uYW1lID0gcGF0aC5iYXNlbmFtZShwYXRoLnJlc29sdmUoZXF1aXBfcGF0aCwgYC4uYCwgYC4uYCkpO1xyXG4gICAgICAgIGNvbnN0IHNraWxsX25hbWUgPSBwYXRoLmJhc2VuYW1lKGVxdWlwX3BhdGgpO1xyXG5cclxuICAgICAgICBpZihvYmpbc2tpbGxfbmFtZV0pIHtcclxuICAgICAgICAvLyBwcmV2ZW50cyBoaWphY2tpbmdcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGAke3NraWxsX25hbWV9IGZyb20gJHtwcm9qZWN0X25hbWV9IG92ZXJsYXBzICR7b2JqW3NraWxsX25hbWVdfWApO1xyXG4gICAgICAgIH1cclxuICAgIFxyXG4gICAgICAgIHJldHVybiB7IFxyXG4gICAgICAgICAgICBbc2tpbGxfbmFtZV06IHBhdGgucmVsYXRpdmUocHJvY2Vzcy5jd2QoKSwgcGF0aC5yZXNvbHZlKGVxdWlwX3BhdGgsIGAuLmAsIGAuLmApKSxcclxuICAgICAgICAgICAgLi4ub2JqIFxyXG4gICAgICAgIH07XHJcbiAgICB9LCBvYmopO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgKCkgPT4gKHtcclxuICAgIFNLSUxMUzogW1xyXG4gICAgICAgIGAuL1NLSUxMUy8qL2AsIFxyXG4gICAgICAgIGAuL25vZGVfbW9kdWxlcy8qL1NLSUxMUy8qL2AsXHJcbiAgICAgICAgYC4vbm9kZV9tb2R1bGVzL0AqLyovU0tJTExTLyovYFxyXG4gICAgXS5yZWR1Y2UoZ2xvYl9vYmosIHt9KVxyXG59KTtcclxuIiwiaW1wb3J0IHRvbWwgZnJvbSBcInRvbWxcIjtcclxuaW1wb3J0IGZzIGZyb20gXCJmc1wiO1xyXG5cclxuY29uc3QgZ2V0X2NvbmZpZyA9IChjb25maWdGaWxlKSA9PiB7XHJcbiAgICAvLyB2ZXJpZnkgdG9tbCBleGlzdHNcclxuICAgIGxldCByYXc7XHJcblxyXG4gICAgdHJ5IHtcclxuICAgICAgICByYXcgPSBmcy5yZWFkRmlsZVN5bmMoY29uZmlnRmlsZSwgYHV0Zi04YCk7XHJcbiAgICB9IGNhdGNoIChleGNlcHRpb24pIHtcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYENvdWxkbid0IHJlYWQgJHtjb25maWdGaWxlfS4gQXJlIHlvdSBzdXJlIHRoaXMgcGF0aCBpcyBjb3JyZWN0P2ApO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IGNvbmZpZyA9IHRvbWwucGFyc2UocmF3KTtcclxuXHJcbiAgICAvLyBoYXMgaW1wbGVtZW50ZWRcclxuICAgIGlmKGNvbmZpZy5oYXMpIHtcclxuICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICAuLi5jb25maWcuaGFzLnJlZHVjZSgob2JqLCBvdGhlcl9maWxlKSA9PiAoe1xyXG4gICAgICAgICAgICAgICAgLi4uZ2V0X2NvbmZpZyhgLi9BVkFUQVJTLyR7b3RoZXJfZmlsZX0udG9tbGApLFxyXG4gICAgICAgICAgICAgICAgLi4ub2JqXHJcbiAgICAgICAgICAgIH0pLCB7fSksIFxyXG4gICAgICAgICAgICAuLi5jb25maWdcclxuICAgICAgICB9O1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICByZXR1cm4gY29uZmlnO1xyXG59O1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgZ2V0X2NvbmZpZztcclxuIiwiaW1wb3J0IGZzIGZyb20gXCJmc1wiO1xyXG5pbXBvcnQgcGF0aCBmcm9tIFwicGF0aFwiO1xyXG5cclxuaW1wb3J0IGMgZnJvbSBcImNoYWxrXCI7XHJcbmltcG9ydCBidWlsZGVycyBmcm9tIFwiLi4vcm9sbHVwL2J1aWxkZXJzLmpzXCI7XHJcbmltcG9ydCBnZXRfc2tpbGxzIGZyb20gXCIuLi9saWIvZ2V0X3NraWxscy5qc1wiO1xyXG5pbXBvcnQgZ2V0X2NvbmZpZyBmcm9tIFwiLi4vbGliL2dldF9jb25maWcuanNcIjtcclxuXHJcbi8vIE1peCBDb25maWcgRmlsZSBpbiBhbmQgcnVuIHRoZXNlIGluIG9yZGVyXHJcbmV4cG9ydCBkZWZhdWx0IChjb25maWdGaWxlKSA9PiBPYmplY3QudmFsdWVzKHtcclxuICAgIGdldF9za2lsbHMsXHJcblxyXG4gICAgZ2V0X2NvbmZpZzogKHsgY29uZmlnRmlsZSB9KSA9PiAoe1xyXG4gICAgICAgIGNvbmZpZzogZ2V0X2NvbmZpZyhjb25maWdGaWxlKVxyXG4gICAgfSksXHJcbiAgICBcclxuICAgIHNldF9uYW1lczogKHtcclxuICAgICAgICBjb25maWdGaWxlLFxyXG4gICAgfSkgPT4ge1xyXG4gICAgICAgIGNvbnN0IG5hbWUgPSBwYXRoLmJhc2VuYW1lKGNvbmZpZ0ZpbGUsIGAudG9tbGApO1xyXG5cclxuICAgICAgICBjb25zdCBwYWNrYWdlX3BhdGggPSBwYXRoLmRpcm5hbWUocGF0aC5yZXNvbHZlKGNvbmZpZ0ZpbGUpKTtcclxuICAgICAgICBjb25zdCBwYWNrYWdlX25hbWUgPSBwYWNrYWdlX3BhdGguXHJcbiAgICAgICAgICAgIHNwbGl0KHBhdGguc2VwKS5cclxuICAgICAgICAgICAgcG9wKCk7XHJcblxyXG4gICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgIHBhY2thZ2VfcGF0aCxcclxuICAgICAgICAgICAgcGFja2FnZV9uYW1lLFxyXG4gICAgICAgICAgICBuYW1lLFxyXG4gICAgICAgIH07XHJcbiAgICB9LFxyXG5cclxuICAgIHdyaXRlX2VudHJ5OiAoe1xyXG4gICAgICAgIGNvbmZpZyxcclxuICAgICAgICBuYW1lLFxyXG4gICAgICAgIFNLSUxMU1xyXG4gICAgfSkgPT4ge1xyXG4gICAgICAgIC8vIFdSSVRFIE9VVCBGSUxFXHJcbiAgICAgICAgbGV0IGVudHJ5ID0gYGA7XHJcbiAgICAgICAgY29uc3QgdHlwZSA9IGNvbmZpZy5OT0RFIFxyXG4gICAgICAgICAgICA/IGBub2RlYCBcclxuICAgICAgICAgICAgOiBgYnJvd3NlcmA7XHJcblxyXG4gICAgICAgIGNvbnN0IHdyaXRlID0gKGRhdGEpID0+IHtcclxuICAgICAgICAgICAgZW50cnkgKz0gYCR7ZGF0YX1cXHJcXG5gO1xyXG4gICAgICAgIH07XHJcbiAgICAgICAgXHJcbiAgICAgICAgd3JpdGUoYGltcG9ydCBpc2VrYWkgZnJvbSBcImlzZWthaVwiO2ApO1xyXG4gICAgICAgIHdyaXRlKGBpc2VrYWkuU0VUKCR7SlNPTi5zdHJpbmdpZnkoY29uZmlnKX0pO2ApO1xyXG4gICAgICAgIHdyaXRlKGBgKTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgY29uc3QgZmFpbHMgPSBbXTtcclxuICAgICAgICBjb25zdCBlcXVpcGVkID0gT2JqZWN0LmtleXMoY29uZmlnKS5cclxuICAgICAgICAgICAgZmlsdGVyKChrZXkpID0+IHtcclxuICAgICAgICAgICAgICAgIGNvbnN0IGlzX3VwcGVyID0ga2V5ID09PSBrZXkudG9VcHBlckNhc2UoKTtcclxuICAgICAgICAgICAgICAgIGlmKCFpc191cHBlcikge1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICBjb25zdCBoYXNfc2tpbGwgPSBTS0lMTFNba2V5XSAhPT0gdW5kZWZpbmVkO1xyXG5cclxuICAgICAgICAgICAgICAgIGNvbnN0IGlzX3RhcmdldCA9IFsgYEJST1dTRVJgLCBgTk9ERWAgXS5pbmRleE9mKGtleSkgIT09IC0xO1xyXG5cclxuICAgICAgICAgICAgICAgIGlmKCFoYXNfc2tpbGwgJiYgIWlzX3RhcmdldCkge1xyXG4gICAgICAgICAgICAgICAgICAgIGZhaWxzLnB1c2goa2V5KTtcclxuICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICByZXR1cm4gaXNfdXBwZXIgJiYgaGFzX3NraWxsO1xyXG4gICAgICAgICAgICB9KS5cclxuICAgICAgICAgICAgbWFwKChrZXkpID0+IHtcclxuICAgICAgICAgICAgICAgIGNvbnN0IHdoZXJlID0gU0tJTExTW2tleV0gPT09IGBgXHJcbiAgICAgICAgICAgICAgICAgICAgPyBgLi5gXHJcbiAgICAgICAgICAgICAgICAgICAgOiBgLi4vJHtTS0lMTFNba2V5XS5zcGxpdChwYXRoLnNlcCkuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGpvaW4oYC9gKX1gO1xyXG5cclxuICAgICAgICAgICAgICAgIHdyaXRlKGBpbXBvcnQgJHtrZXl9IGZyb20gXCIke3doZXJlfS9TS0lMTFMvJHtrZXl9LyR7dHlwZX0uanNcIjtgKTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICByZXR1cm4ga2V5O1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgY29uc3QgZmFpbGVkID0gZmFpbHMubGVuZ3RoID4gMFxyXG4gICAgICAgICAgICA/IGBGQUlMRUQgVE8gRklORFxcclxcbiR7ZmFpbHMubWFwKChmKSA9PiBgWyR7Zn1dYCkuXHJcbiAgICAgICAgICAgICAgICBqb2luKGAgeCBgKX1gXHJcbiAgICAgICAgICAgIDogYGA7XHJcblxyXG4gICAgICAgIGNvbnN0IGtleXMgPSBlcXVpcGVkLnJlZHVjZSgob3V0cHV0LCBrZXkpID0+IGAke291dHB1dH0gICAgJHtrZXl9LFxcclxcbmAsIGBgKTtcclxuXHJcbiAgICAgICAgd3JpdGUoYFxyXG5pc2VrYWkuRVFVSVAoe1xcclxcbiR7a2V5c319KTtgKTtcclxuXHJcbiAgICAgICAgY29uc3QgQklOID0gYC5CSU5gO1xyXG4gICAgICAgIGNvbnN0IGlucHV0ID0gcGF0aC5qb2luKEJJTiwgYCR7bmFtZX0uZW50cnkuanNgKTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgaWYgKCFmcy5leGlzdHNTeW5jKEJJTikpIHtcclxuICAgICAgICAgICAgY29uc29sZS5sb2coYENSRUFUSU5HICR7QklOfWApO1xyXG4gICAgICAgICAgICBmcy5ta2RpclN5bmMoQklOKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgLy8gd3JpdGUgb3V0IHRoZWlyIGluZGV4LmpzXHJcbiAgICAgICAgZnMud3JpdGVGaWxlU3luYyhpbnB1dCwgZW50cnksIGB1dGYtOGApO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICBjb25zb2xlLmxvZyhgXHJcblske25hbWV9XVske3R5cGV9XVxyXG5cclxuU0tJTExTXHJcbiR7Yy5ibHVlQnJpZ2h0KGVxdWlwZWQubWFwKChlKSA9PiBgWyR7ZX1dYCkuXHJcbiAgICAgICAgam9pbihgICsgYCkpfVxyXG5cclxuJHtjLnJlZChmYWlsZWQpfVxyXG5gKTtcclxuXHJcbiAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgaW5wdXRcclxuICAgICAgICB9O1xyXG4gICAgfSxcclxuXHJcbiAgICBydW5fYnVpbGRlcnM6ICh7XHJcbiAgICAgICAgaW5wdXQsXHJcbiAgICAgICAgbmFtZSxcclxuICAgICAgICBjb25maWcsXHJcbiAgICB9KSA9PiB7XHJcbiAgICAgICAgY29uc3QgdGFyZ2V0ID0gY29uZmlnLk5PREUgXHJcbiAgICAgICAgICAgID8gYE5PREVgIFxyXG4gICAgICAgICAgICA6IGBCUk9XU0VSYDtcclxuXHJcbiAgICAgICAgY29uc3Qgb3V0cHV0ID0gYC5CSU4vJHtuYW1lfS4ke3RhcmdldH0uanNgO1xyXG5cclxuICAgICAgICBpZihjb25maWcuTk9ERSAmJiBjb25maWcuQlJPV1NFUikge1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFlvdSBjYW5ub3QgdGFyZ2V0IGJvdGggW05PREVdIGFuZCBbQlJPV1NFUl1gKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmKGNvbmZpZy5OT0RFKSB7ICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgICAgICBvdXRwdXQsXHJcbiAgICAgICAgICAgICAgICBidWlsZF9pbmZvOiBidWlsZGVycy5ub2RlKHtcclxuICAgICAgICAgICAgICAgICAgICBpbnB1dCxcclxuICAgICAgICAgICAgICAgICAgICBvdXRwdXRcclxuICAgICAgICAgICAgICAgIH0pXHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIGlmKGNvbmZpZy5CUk9XU0VSKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgICAgICBvdXRwdXQsXHJcbiAgICAgICAgICAgICAgICBidWlsZF9pbmZvOiBidWlsZGVycy5icm93c2VyKHtcclxuICAgICAgICAgICAgICAgICAgICBpbnB1dCxcclxuICAgICAgICAgICAgICAgICAgICBvdXRwdXRcclxuICAgICAgICAgICAgICAgIH0pXHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFlvdSBtdXN0IHNwZWNpZnkgZWl0aGVyIFtOT0RFXSBvciBbQlJPV1NFUl0gZm9yIHlvdXIgdGFyZ2V0IGluIHlvdXIgW0FWQVRBUl0gdG9tbGApO1xyXG4gICAgfVxyXG59KS5cclxuICAgIHJlZHVjZSgoc3RhdGUsIGZuKSA9PiAoe1xyXG4gICAgICAgIC4uLnN0YXRlLFxyXG4gICAgICAgIC4uLmZuKHN0YXRlKVxyXG4gICAgfSksIHsgY29uZmlnRmlsZSB9KTtcclxuIiwiaW1wb3J0IGdldF9saXN0IGZyb20gXCIuL2dldF9saXN0LmpzXCI7XHJcblxyXG5leHBvcnQgZGVmYXVsdCAoY2xhc3NlcykgPT4gY2xhc3Nlcy5maWx0ZXIoKHRhcmdldCkgPT4ge1xyXG4gICAgY29uc3QgaXNfb2theSA9IGdldF9saXN0KCkuXHJcbiAgICAgICAgaW5kZXhPZih0YXJnZXQpICE9PSAtMTtcclxuXHJcbiAgICBpZighaXNfb2theSkge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKGAke3RhcmdldH0gaXMgbm90IGFuIGF2YWlsYWJsZSBbQVZBVEFSXWApO1xyXG4gICAgfVxyXG4gICAgICAgIFxyXG4gICAgcmV0dXJuIGlzX29rYXk7XHJcbn0pO1xyXG4iLCJpbXBvcnQgZ2V0X2xpc3QgZnJvbSBcIi4uL2xpYi9nZXRfbGlzdC5qc1wiO1xyXG5pbXBvcnQgZmlsdGVyX2xpc3QgZnJvbSBcIi4uL2xpYi9maWx0ZXJfbGlzdC5qc1wiO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgKHtcclxuICAgIGNtZCxcclxuICAgIEFWQVRBUlNcclxufSkgPT4ge1xyXG4gICAgaWYoIUFWQVRBUlMpIHtcclxuICAgICAgICByZXR1cm4gY21kLnByb21wdCh7XHJcbiAgICAgICAgICAgIHR5cGU6IGBsaXN0YCxcclxuICAgICAgICAgICAgbmFtZTogYEFWQVRBUmAsXHJcbiAgICAgICAgICAgIG1lc3NhZ2U6IGBXaGljaCBbQVZBVEFSXT9gLFxyXG4gICAgICAgICAgICBjaG9pY2VzOiBbIGBhbGxgLCAuLi5nZXRfbGlzdCgpIF1cclxuICAgICAgICB9KS5cclxuICAgICAgICAgICAgdGhlbigoeyBBVkFUQVIgfSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coQVZBVEFSLCBgQVZBVEFSYCk7XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIHJldHVybiBBVkFUQVIgPT09IGBhbGxgIFxyXG4gICAgICAgICAgICAgICAgICAgID8gZ2V0X2xpc3QoKSBcclxuICAgICAgICAgICAgICAgICAgICA6IGZpbHRlcl9saXN0KFsgQVZBVEFSIF0pO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgaWYoQVZBVEFSU1swXSA9PT0gYGFsbGApIHtcclxuICAgICAgICByZXR1cm4gZ2V0X2xpc3QoKTtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gZmlsdGVyX2xpc3QoQVZBVEFSUyk7XHJcbn07IiwiaW1wb3J0IHRvbWxfdG9fanMgZnJvbSBcIi4uL3RyYW5zZm9ybXMvdG9tbF90b19qcy5qc1wiO1xyXG5pbXBvcnQgcm9sbHVwIGZyb20gXCJyb2xsdXBcIjtcclxuXHJcbmltcG9ydCBwcm9tcHRfYXZhdGFycyBmcm9tIFwiLi4vbGliL3Byb21wdF9hdmF0YXJzLmpzXCI7XHJcblxyXG5leHBvcnQgZGVmYXVsdCAoe1xyXG4gICAgY29tbWFuZDogYGJ1aWxkIFtBVkFUQVJTLi4uXWAsXHJcbiAgICBoZWxwOiBgYnVpbGQgYWxsIFtBVkFUQVJdIHNhdmUocykuYCxcclxuICAgIGhpZGRlbjogdHJ1ZSxcclxuICAgIGFzeW5jIGhhbmRsZXIoeyBBVkFUQVJTIH0pIHtcclxuICAgICAgICBjb25zdCBhdmF0YXJzID0gYXdhaXQgcHJvbXB0X2F2YXRhcnMoeyBcclxuICAgICAgICAgICAgY21kOiB0aGlzLFxyXG4gICAgICAgICAgICBBVkFUQVJTIFxyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICBjb25zdCBidWlsdCA9IGF3YWl0IFByb21pc2UuYWxsKGF2YXRhcnMubWFwKGFzeW5jICh0YXJnZXQpID0+IHtcclxuICAgICAgICAgICAgY29uc3QgeyBidWlsZF9pbmZvLCBuYW1lIH0gPSBhd2FpdCB0b21sX3RvX2pzKGAuL0FWQVRBUlMvJHt0YXJnZXR9LnRvbWxgKTtcclxuICAgICAgICAgICAgY29uc3QgYnVuZGxlID0gYXdhaXQgcm9sbHVwLnJvbGx1cChidWlsZF9pbmZvKTtcclxuXHJcbiAgICAgICAgICAgIGF3YWl0IGJ1bmRsZS53cml0ZShidWlsZF9pbmZvLm91dHB1dCk7XHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbJHtuYW1lfV0gQnVpbGQgQ29tcGxldGUuXFxyXFxuYCk7XHJcbiAgICAgICAgfSkpO1xyXG5cclxuICAgICAgICBjb25zb2xlLmxvZyhgQnVpbHQgJHtidWlsdC5sZW5ndGh9IFtBVkFUQVJdKHMpLmApO1xyXG4gICAgfVxyXG59KTsiLCJpbXBvcnQgR2l0IGZyb20gXCJzaW1wbGUtZ2l0L3Byb21pc2VcIjtcclxuXHJcbmNvbnN0IGdpdCA9IEdpdCgpO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgKHtcclxuICAgIGNvbW1hbmQ6IGBjb21taXQgW21lc3NhZ2UuLi5dYCxcclxuICAgIGhlbHA6IGBjb21taXQgY3VycmVudCBmaWxlcyB0byBzb3VyY2UgY29udHJvbGAsXHJcbiAgICBoYW5kbGVyOiAoe1xyXG4gICAgICAgIG1lc3NhZ2UgPSBbIGBVcGRhdGUsIG5vIGNvbW1pdCBtZXNzYWdlYCBdXHJcbiAgICB9KSA9PiBnaXQuYWRkKFsgYC5gIF0pLlxyXG4gICAgICAgIHRoZW4oKCkgPT4gZ2l0LmNvbW1pdChtZXNzYWdlLmpvaW4oYCBgKSkpLlxyXG4gICAgICAgIHRoZW4oKCkgPT4gZ2l0LnB1c2goYG9yaWdpbmAsIGBtYXN0ZXJgKSkuXHJcbiAgICAgICAgdGhlbigoKSA9PiBjb25zb2xlLmxvZyhgQ29tbWl0ZWQgd2l0aCBtZXNzYWdlICR7bWVzc2FnZS5qb2luKGAgYCl9YCkpXHJcbn0pO1xyXG4iLCJpbXBvcnQgZGVnaXQgZnJvbSBcImRlZ2l0XCI7XHJcbmltcG9ydCB7IGV4ZWMgfSBmcm9tIFwiY2hpbGRfcHJvY2Vzc1wiO1xyXG5pbXBvcnQgR2l0IGZyb20gXCJzaW1wbGUtZ2l0L3Byb21pc2VcIjtcclxuXHJcbmNvbnN0IGdpdCA9IEdpdCgpO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgKHtcclxuICAgIGNvbW1hbmQ6IGBjcmVhdGUgW3RlbXBsYXRlXSBbbmFtZV1gLFxyXG4gICAgaGVscDogYENyZWF0ZSBhIG5ldyBpc2VrYWkgcHJvamVjdCBmcm9tIFt0ZW1wbGF0ZV0gb3IgQGlzZWthaS90ZW1wbGF0ZWAsXHJcbiAgICBhbGlhczogWyBgaW5pdGAgXSxcclxuICAgIG9wdGlvbnM6IHtcclxuICAgICAgICBcIi1mLCAtLWZvcmNlXCI6IGBmb3JjZSBvdmVyd3JpdGUgZnJvbSB0ZW1wbGF0ZWBcclxuICAgIH0sXHJcbiAgICBoYW5kbGVyOiAoe1xyXG4gICAgICAgIHRlbXBsYXRlID0gYGlzZWthaS1kZXYvdGVtcGxhdGVgLFxyXG4gICAgICAgIG5hbWUgPSBgLmAsXHJcbiAgICAgICAgb3B0aW9uczoge1xyXG4gICAgICAgICAgICBmb3JjZSA9IGZhbHNlXHJcbiAgICAgICAgfSA9IGZhbHNlXHJcbiAgICB9KSA9PiBkZWdpdCh0ZW1wbGF0ZSwgeyBmb3JjZSB9KS5cclxuICAgICAgICBjbG9uZShuYW1lKS5cclxuICAgICAgICB0aGVuKCgpID0+IGdpdC5pbml0KCkpLlxyXG4gICAgICAgIHRoZW4oKCkgPT4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xyXG4gICAgICAgICAgICBjb25zb2xlLmxvZyhgJHt0ZW1wbGF0ZX0gY29waWVkIHRvICR7bmFtZX1gKTtcclxuICAgICAgICAgICAgY29uc29sZS5sb2coYElOU1RBTExJTkc6IFRISVMgTUFZIFRBS0UgQVdISUxFYCk7XHJcbiAgICAgICAgICAgIGV4ZWMoYG5wbSBpbnN0YWxsYCwgKGVycikgPT4ge1xyXG4gICAgICAgICAgICAgICAgaWYoZXJyKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmVqZWN0KGVycik7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICByZXNvbHZlKCk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0pKS5cclxuICAgICAgICB0aGVuKCgpID0+IHtcclxuICAgICAgICAgICAgY29uc29sZS5sb2coYENPTVBMRVRFOiBbcnVuXSB0byBzdGFydCB5b3VyIGF2YXRhcnMuYCk7XHJcbiAgICAgICAgfSlcclxufSk7IiwiLy8gcGlwZSBvdXQgdG8gcG0yXHJcbmltcG9ydCB7IHNwYXduIH0gZnJvbSBcImNoaWxkX3Byb2Nlc3NcIjtcclxuaW1wb3J0IHBhdGggZnJvbSBcInBhdGhcIjtcclxuXHJcbmNvbnN0IHBtMl9wYXRoID0gcGF0aC5kaXJuYW1lKHJlcXVpcmUucmVzb2x2ZShgcG0yYCkpO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgKHsgY29tbWFuZHMgfSkgPT4ge1xyXG4gICAgbGV0IG5vZGUgPSBzcGF3bihgbm9kZWAsIGAke3BtMl9wYXRofS9iaW4vcG0yICR7Y29tbWFuZHMuam9pbihgIGApfWAuc3BsaXQoYCBgKSwge1xyXG4gICAgICAgIGN3ZDogcHJvY2Vzcy5jd2QoKSxcclxuICAgICAgICBlbnY6IHByb2Nlc3MuZW52LFxyXG4gICAgICAgIHN0ZGlvOiBgaW5oZXJpdGBcclxuICAgIH0pO1xyXG5cclxuICAgIHJldHVybiB7XHJcbiAgICAgICAgZG9uZTogbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHtcclxuICAgICAgICAgICAgbm9kZS5vbihgY2xvc2VgLCAoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICByZXNvbHZlKCk7XHJcbiAgICAgICAgICAgICAgICBub2RlID0gZmFsc2U7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0pLFxyXG5cclxuICAgICAgICBjYW5jZWw6ICgpID0+IHtcclxuICAgICAgICAgICAgaWYoIW5vZGUpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgfVxyXG4gICAgXHJcbiAgICAgICAgICAgIG5vZGUua2lsbCgpO1xyXG4gICAgICAgIH0gICBcclxuICAgIH07XHJcbn07XHJcbiIsImltcG9ydCBwbTIgZnJvbSBcIi4uL2xpYi9wbTIuanNcIjtcclxuXHJcbmV4cG9ydCBkZWZhdWx0ICh7XHJcbiAgICBjb21tYW5kOiBgbG9ncyBbQVZBVEFSUy4uLl1gLFxyXG4gICAgaGVscDogYGZvbGxvdyB0aGUgYWN0aXZlIFtBVkFUQVJdIGxvZ3NgLFxyXG4gICAgaGFuZGxlcjogKHsgQVZBVEFSUyA9IFtdIH0pID0+IHBtMih7XHJcbiAgICAgICAgY29tbWFuZHM6IFsgYGxvZ3NgLCAuLi5BVkFUQVJTIF1cclxuICAgIH0pLmRvbmVcclxuICAgIFxyXG59KTsiLCJpbXBvcnQgR2l0IGZyb20gXCJzaW1wbGUtZ2l0L3Byb21pc2VcIjtcclxuaW1wb3J0IHsgZXhlYyB9IGZyb20gXCJjaGlsZF9wcm9jZXNzXCI7XHJcblxyXG5jb25zdCBnaXQgPSBHaXQoKTtcclxuXHJcbmV4cG9ydCBkZWZhdWx0ICh7XHJcbiAgICBjb21tYW5kOiBgcHVsbGAsXHJcbiAgICBoZWxwOiBgZ2V0IGN1cnJlbnQgZmlsZXMgZnJvbSBzb3VyY2UgY29udHJvbGAsXHJcbiAgICBoYW5kbGVyOiAoKSA9PiBnaXQucHVsbChgb3JpZ2luYCwgYG1hc3RlcmApLlxyXG4gICAgICAgIHRoZW4oKCkgPT4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xyXG4gICAgICAgICAgICBleGVjKGBucG0gaW5zdGFsbGAsIChlcnIpID0+IHtcclxuICAgICAgICAgICAgICAgIGlmKGVycikge1xyXG4gICAgICAgICAgICAgICAgICAgIHJlamVjdChlcnIpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgcmVzb2x2ZSgpO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9KSkuXHJcbiAgICAgICAgdGhlbigoKSA9PiBjb25zb2xlLmxvZyhgUHVsbGVkIGxhdGVzdCBmcm9tIHNvdXJjZSBjb250cm9sLmApKVxyXG59KTtcclxuIiwiaW1wb3J0IHZvcnBhbCBmcm9tIFwidm9ycGFsXCI7XHJcbmltcG9ydCBmZXRjaCBmcm9tIFwibm9kZS1mZXRjaFwiO1xyXG5pbXBvcnQgZ2xvYiBmcm9tIFwiZ2xvYlwiO1xyXG5pbXBvcnQgZ2V0X2NvbmZpZyBmcm9tIFwiLi4vbGliL2dldF9jb25maWcuanNcIjtcclxuXHJcbi8vIFRPRE86IFRoaXMgc2hvdWxkIHJlYWxseSBiZSBleHBvc2VkIGJ5IGlzZWthaSBjb3JlIHNvbWUgaG93LiBMaWtlIGEgd2F5IHRvIGFkZCBpbiB0b29sc1xyXG5leHBvcnQgZGVmYXVsdCAoe1xyXG4gICAgY29tbWFuZDogYHB1c2ggPG1lc3NhZ2U+YCxcclxuICAgIGFsaWFzOiBbIGBwdWJsaXNoYCBdLFxyXG4gICAgaGFuZGxlcjogYXN5bmMgKHsgbWVzc2FnZSB9KSA9PiB7XHJcbiAgICAgICAgYXdhaXQgdm9ycGFsLmV4ZWMoYGNvbW1pdCAke21lc3NhZ2V9YCk7XHJcblxyXG4gICAgICAgIGF3YWl0IFByb21pc2UuYWxsKGdsb2Iuc3luYyhgLi9BVkFUQVJTLyoudG9tbGApLlxyXG4gICAgICAgICAgICBtYXAoKGF2YXRhcikgPT4ge1xyXG4gICAgICAgICAgICAgICAgY29uc3QgeyBBRE1JTiB9ID0gZ2V0X2NvbmZpZyhhdmF0YXIpO1xyXG4gICAgICAgICAgICAgICAgaWYoQURNSU4gJiYgQURNSU4uemFsZ28pIHtcclxuICAgICAgICAgICAgICAgICAgICBjb25zdCB7IFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB1cmwgPSBgaHR0cDovL2xvY2FsaG9zdDo4MDgwYCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgemFsZ28gXHJcbiAgICAgICAgICAgICAgICAgICAgfSA9IEFETUlOO1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBQVVNISU5HIFske2F2YXRhcn1dIC0gJHt1cmx9YCk7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmZXRjaChgJHt1cmx9L3phbGdvYCwge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBtZXRob2Q6IGBQT1NUYCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgY2FjaGU6IGBuby1jYWNoZWAsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGhlYWRlcnM6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiQ29udGVudC1UeXBlXCI6IGBhcHBsaWNhdGlvbi9qc29uYFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB6YWxnb1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9KVxyXG4gICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcclxuICAgICAgICAgICAgfSkpO1xyXG5cclxuICAgIH1cclxufSk7IiwiaW1wb3J0IGdldF9za2lsbHMgZnJvbSBcIi4uL2xpYi9nZXRfc2tpbGxzLmpzXCI7XHJcblxyXG5leHBvcnQgZGVmYXVsdCAoe1xyXG4gICAgY29tbWFuZDogYHNraWxsc2AsXHJcbiAgICBoZWxwOiBgTGlzdCBhdmFpbGFibGUgc2tpbGxzYCxcclxuXHJcbiAgICBoYW5kbGVyOiAoKSA9PiB7XHJcbiAgICAgICAgY29uc3Qge1xyXG4gICAgICAgICAgICBTSE9QLFxyXG4gICAgICAgICAgICBTS0lMTFNcclxuICAgICAgICB9ID0gZ2V0X3NraWxscygpO1xyXG5cclxuICAgICAgICBjb25zb2xlLmxvZyhgXHJcblNIT1BcclxuJHtPYmplY3Qua2V5cyhTSE9QKS5cclxuICAgICAgICBtYXAoKHMpID0+IGBbJHtzfV1gKS5cclxuICAgICAgICBqb2luKGAgPSBgKX1cclxuXHJcblNLSUxMU1xyXG4ke09iamVjdC5rZXlzKFNLSUxMUykuXHJcbiAgICAgICAgbWFwKChzKSA9PiBgWyR7c31dYCkuXHJcbiAgICAgICAgam9pbihgIG8gYCl9XHJcbmApO1xyXG4gICAgfVxyXG59KTsiLCJpbXBvcnQgcG0yIGZyb20gXCJwbTJcIjtcclxuXHJcbmltcG9ydCB0b21sX3RvX2pzIGZyb20gXCIuLi90cmFuc2Zvcm1zL3RvbWxfdG9fanMuanNcIjtcclxuXHJcbmltcG9ydCBwcm9tcHRfYXZhdGFycyBmcm9tIFwiLi4vbGliL3Byb21wdF9hdmF0YXJzLmpzXCI7XHJcblxyXG5leHBvcnQgZGVmYXVsdCAoe1xyXG4gICAgY29tbWFuZGVyOiBgc3Bhd24gW0FWQVRBUlMuLi5dYCxcclxuICAgIGhlbHA6IGBzcGF3biBbQVZBVEFSU10gZmlsZXNgLFxyXG4gICAgaGlkZGVuOiB0cnVlLFxyXG4gICAgYXN5bmMgaGFuZGxlcih7IEFWQVRBUlMgfSkge1xyXG4gICAgICAgIGNvbnN0IGF2YXRhcnMgPSBhd2FpdCBwcm9tcHRfYXZhdGFycyh7XHJcbiAgICAgICAgICAgIGNtZDogdGhpcyxcclxuICAgICAgICAgICAgQVZBVEFSU1xyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICBhdmF0YXJzLmZvckVhY2goKGF2YXRhcikgPT4ge1xyXG4gICAgICAgICAgICBjb25zdCB7XHJcbiAgICAgICAgICAgICAgICBvdXRwdXQsXHJcbiAgICAgICAgICAgIH0gPSB0b21sX3RvX2pzKGAuL0FWQVRBUlMvJHthdmF0YXJ9LnRvbWxgKTtcclxuXHJcbiAgICAgICAgICAgIC8vIEhBQ0s6IGNvdWxkIG5hbWUgdGhlIGZpbGUgb2YgdGhlIFRPTUwgc29tZXRoaW5nIGduYXJseVxyXG4gICAgICAgICAgICBwbTIuc3RhcnQoe1xyXG4gICAgICAgICAgICAgICAgbmFtZTogYXZhdGFyLFxyXG4gICAgICAgICAgICAgICAgc2NyaXB0OiBvdXRwdXQsXHJcbiAgICAgICAgICAgICAgICB3YXRjaDogYC4vJHtvdXRwdXR9YCxcclxuICAgICAgICAgICAgICAgIGZvcmNlOiB0cnVlLFxyXG4gICAgICAgICAgICAgICAgd2F0Y2hfb3B0aW9uczoge1xyXG4gICAgICAgICAgICAgICAgICAgIC8vIHl1cCBQTTIgd2FzIHNldHRpbmcgYSBkZWZhdWx0IGlnbm9yZVxyXG4gICAgICAgICAgICAgICAgICAgIGlnbm9yZWQ6IGBgLFxyXG4gICAgICAgICAgICAgICAgICAgIHVzZVBvbGxpbmc6IHRydWVcclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICBtYXhfcmVzdGFydDogMFxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9KTtcclxuICAgIH1cclxufSk7XHJcbiIsImV4cG9ydCBkZWZhdWx0IChcclxuICAgIGFjdGlvbl9tYXAsIFxyXG4gICAgcmVkdWNlciA9IChpKSA9PiBpXHJcbikgPT4gKGlucHV0KSA9PiB7XHJcbiAgICBjb25zdCBrZXkgPSByZWR1Y2VyKGlucHV0KTtcclxuXHJcbiAgICBpZighYWN0aW9uX21hcFtrZXldKSB7XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiBhY3Rpb25fbWFwW2tleV0oaW5wdXQpO1xyXG59OyIsImltcG9ydCBjaG9raWRhciBmcm9tIFwiY2hva2lkYXJcIjtcclxuaW1wb3J0IHJvbGx1cCBmcm9tIFwicm9sbHVwXCI7XHJcbmltcG9ydCBjIGZyb20gXCJjaGFsa1wiO1xyXG5cclxuaW1wb3J0IHRvbWxfdG9fanMgZnJvbSBcIi4uL3RyYW5zZm9ybXMvdG9tbF90b19qcy5qc1wiO1xyXG5cclxuaW1wb3J0IGFjdGlvbiBmcm9tIFwiLi4vbGliL2FjdGlvbi5qc1wiO1xyXG5pbXBvcnQgcHJvbXB0X2F2YXRhcnMgZnJvbSBcIi4uL2xpYi9wcm9tcHRfYXZhdGFycy5qc1wiO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgKHtcclxuICAgIGNvbW1hbmQ6IGBsb2FkIFtBVkFUQVJTLi4uXWAsXHJcbiAgICBoZWxwOiBgbG9hZCBbQVZBVEFSXSBzYXZlc2AsXHJcbiAgICBhbGlhczogWyBgcmVnZW5lcmF0ZWAsIGByZWNyZWF0ZWAsIGB3YXRjaGAgXSxcclxuICAgIGhpZGRlbjogdHJ1ZSxcclxuICAgIGNhbmNlbCAoKSB7XHJcbiAgICAgICAgdGhpcy53YXRjaGVycy5mb3JFYWNoKCh3YXRjaGVyKSA9PiB3YXRjaGVyLmNsb3NlKCkpO1xyXG4gICAgICAgIGNvbnNvbGUubG9nKGBZT1VSIFdBVENIIEhBUyBFTkRFRGApO1xyXG4gICAgfSxcclxuICAgIGFzeW5jIGhhbmRsZXIoeyBBVkFUQVJTIH0pIHtcclxuICAgICAgICB0aGlzLndhdGNoZXJzID0gW107XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgIGNvbnN0IGF2YXRhcnMgPSBhd2FpdCBwcm9tcHRfYXZhdGFycyh7XHJcbiAgICAgICAgICAgIGNtZDogdGhpcyxcclxuICAgICAgICAgICAgQVZBVEFSU1xyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGF2YXRhcnMuZm9yRWFjaCgodGFyZ2V0KSA9PiB7XHJcbiAgICAgICAgICAgIGNvbnN0IGZpbGVfcGF0aCA9IGAuL0FWQVRBUlMvJHt0YXJnZXR9LnRvbWxgO1xyXG5cclxuICAgICAgICAgICAgY29uc3QgZGF0YSA9IHRvbWxfdG9fanMoZmlsZV9wYXRoKTtcclxuXHJcbiAgICAgICAgICAgIGNvbnN0IHsgYnVpbGRfaW5mbyB9ID0gZGF0YTtcclxuICAgICAgICBcclxuICAgICAgICAgICAgLy8gcmVidWlsZCBvbiBmaWxlIGNoYWduZVxyXG4gICAgICAgICAgICBjb25zdCB3YXRjaGVyID0gY2hva2lkYXIud2F0Y2goZmlsZV9wYXRoKTtcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICB3YXRjaGVyLm9uKGBjaGFuZ2VgLCAoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICB0b21sX3RvX2pzKGZpbGVfcGF0aCk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHRoaXMud2F0Y2hlcnMucHVzaCh3YXRjaGVyKTtcclxuXHJcbiAgICAgICAgICAgIGNvbnN0IHJvbGx1cF93YXRjaGVyID0gcm9sbHVwLndhdGNoKHtcclxuICAgICAgICAgICAgICAgIC4uLmJ1aWxkX2luZm8sXHJcbiAgICAgICAgICAgICAgICB3YXRjaDoge1xyXG4gICAgICAgICAgICAgICAgICAgIGNsZWFyU2NyZWVuOiB0cnVlXHJcbiAgICAgICAgICAgICAgICB9ICAgXHJcbiAgICAgICAgICAgIH0pLlxyXG4gICAgICAgICAgICAgICAgb24oYGV2ZW50YCwgYWN0aW9uKHtcclxuICAgICAgICAgICAgICAgICAgICBFUlJPUjogKGUpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coZSk7XHJcbiAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICBGQVRBTDogKHsgZXJyb3IgfSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKGMucmVkLmJvbGQoZXJyb3IpKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9LCAoeyBjb2RlIH0pID0+IGNvZGUgXHJcbiAgICAgICAgICAgICAgICApKTtcclxuXHJcbiAgICAgICAgICAgIHRoaXMud2F0Y2hlcnMucHVzaChyb2xsdXBfd2F0Y2hlcik7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcbn0pO1xyXG4iLCJpbXBvcnQgd2F0Y2ggZnJvbSBcIi4vd2F0Y2guanNcIjtcclxuaW1wb3J0IHNwYXduIGZyb20gXCIuL3NwYXduLmpzXCI7XHJcbmltcG9ydCBwbTIgZnJvbSBcIi4uL2xpYi9wbTIuanNcIjtcclxuXHJcbmltcG9ydCBwcm9tcHRfYXZhdGFycyBmcm9tIFwiLi4vbGliL3Byb21wdF9hdmF0YXJzLmpzXCI7XHJcblxyXG5jb25zdCBydW5fYXZhdGFycyA9ICh7IEFWQVRBUlMgfSkgPT4ge1xyXG4gICAgd2F0Y2guaGFuZGxlcih7IEFWQVRBUlMgfSk7XHJcbiAgICBzcGF3bi5oYW5kbGVyKHsgQVZBVEFSUyB9KTtcclxuXHJcbiAgICByZXR1cm4gcG0yKHtcclxuICAgICAgICBjb21tYW5kczogWyBgbG9nc2AgXVxyXG4gICAgfSkuZG9uZTtcclxufTtcclxuXHJcbmV4cG9ydCBkZWZhdWx0ICh7XHJcbiAgICBjb21tYW5kOiBgcnVuIFtBVkFUQVJTLi4uXWAsXHJcbiAgICBoZWxwOiBgcnVuIGFuZCB3YXRjaCBbQVZBVEFSXSBmaWxlc2AsXHJcbiAgICBhbGlhczogWyBgZGV2YCwgYHN0YXJ0YCBdLFxyXG4gICAgYXN5bmMgaGFuZGxlcih7IEFWQVRBUlMgfSkge1xyXG4gICAgICAgIGNvbnN0IGF2YXRhcnMgPSBhd2FpdCBwcm9tcHRfYXZhdGFycyh7XHJcbiAgICAgICAgICAgIGNtZDogdGhpcyxcclxuICAgICAgICAgICAgQVZBVEFSU1xyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICByZXR1cm4gcnVuX2F2YXRhcnMoeyBBVkFUQVJTOiBhdmF0YXJzIH0pO1xyXG4gICAgfSxcclxuXHJcbiAgICBjYW5jZWwoKSB7XHJcbiAgICAgICAgd2F0Y2guY2FuY2VsKCk7XHJcbiAgICB9XHJcbn0pO1xyXG5cclxuIiwiaW1wb3J0IHBtMiBmcm9tIFwiLi4vbGliL3BtMi5qc1wiO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQoe1xyXG4gICAgY29tbWFuZDogYHN0YXR1cyBbQVZBVEFSXWAsXHJcbiAgICBoZWxwOiBgc3RhdHVzIG9mIGFjdGl2ZSBbQVZBVEFSXXMuYCxcclxuICAgIGFsaWFzOiBbIGBwc2AsIGBhY3RpdmVgLCBgc3RhdHNgIF0sXHJcbiAgICBoYW5kbGVyOiAoKSA9PiBwbTIoe1xyXG4gICAgICAgIGNvbW1hbmRzOiBbIGBwc2AgXVxyXG4gICAgfSkuZG9uZVxyXG59KTsiLCJpbXBvcnQgcG0yIGZyb20gXCIuLi9saWIvcG0yLmpzXCI7XHJcbmltcG9ydCBnZXRfbGlzdCBmcm9tIFwiLi4vbGliL2dldF9saXN0LmpzXCI7XHJcblxyXG5leHBvcnQgZGVmYXVsdCAoe1xyXG4gICAgY29tbWFuZDogYHN0b3AgW0FWQVRBUlMuLi5dYCxcclxuICAgIGhlbHA6IGBzdG9wIGFjdGl2ZSBbQVZBVEFSXSBmaWxlcy4gYCwgXHJcbiAgICBcclxuICAgIGNhbmNlbCgpIHtcclxuICAgICAgICB0aGlzLmNhbmNlbGVyKCk7XHJcbiAgICB9LFxyXG4gICAgXHJcbiAgICBoYW5kbGVyKHsgQVZBVEFSUyA9IGdldF9saXN0KCkgfSkge1xyXG4gICAgICAgIGNvbnN0IHdob20gPSBBVkFUQVJTLm1hcCgoY2hhcikgPT4gYFske2NoYXJ9XWApLlxyXG4gICAgICAgICAgICBqb2luKGAgLSBgKTtcclxuXHJcbiAgICAgICAgY29uc29sZS5sb2coYFNUT1BQSU5HICR7d2hvbX1gKTtcclxuXHJcbiAgICAgICAgY29uc3QgeyBjYW5jZWwsIGRvbmUgfSA9IHBtMih7XHJcbiAgICAgICAgICAgIGNvbW1hbmRzOiBbIGBkZWxldGVgLCBgYWxsYCBdXHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIHRoaXMuY2FuY2VsZXIgPSBjYW5jZWw7XHJcblxyXG4gICAgICAgIHJldHVybiBkb25lO1xyXG4gICAgfVxyXG59KTtcclxuXHJcbiIsImltcG9ydCB7IHZlcnNpb24gfSBmcm9tIFwiLi4vLi4vcGFja2FnZS5qc29uXCI7XHJcblxyXG5leHBvcnQgZGVmYXVsdCAoe1xyXG4gICAgY29tbWFuZDogYHZlcnNpb25gLFxyXG4gICAgaGVscDogYFZlcnNpb24gaXMgJHt2ZXJzaW9ufWAsXHJcbiAgICBoYW5kbGVyOiAoKSA9PiB7XHJcbiAgICAgICAgY29uc29sZS5sb2codmVyc2lvbik7XHJcbiAgICB9XHJcbn0pOyIsImNvbnN0IHJlcyA9IHt9O1xuaW1wb3J0IGYwIGZyb20gXCIvVXNlcnMvR2FtZXMvUHJvamVjdHMvSVNFS0FJL3NyYy9jb21tYW5kcy9hdmF0YXJzLmpzXCI7XG5yZXNbXCJhdmF0YXJzXCJdID0gZjA7XG5pbXBvcnQgZjEgZnJvbSBcIi9Vc2Vycy9HYW1lcy9Qcm9qZWN0cy9JU0VLQUkvc3JjL2NvbW1hbmRzL2J1aWxkLmpzXCI7XG5yZXNbXCJidWlsZFwiXSA9IGYxO1xuaW1wb3J0IGYyIGZyb20gXCIvVXNlcnMvR2FtZXMvUHJvamVjdHMvSVNFS0FJL3NyYy9jb21tYW5kcy9jb21taXQuanNcIjtcbnJlc1tcImNvbW1pdFwiXSA9IGYyO1xuaW1wb3J0IGYzIGZyb20gXCIvVXNlcnMvR2FtZXMvUHJvamVjdHMvSVNFS0FJL3NyYy9jb21tYW5kcy9jcmVhdGUuanNcIjtcbnJlc1tcImNyZWF0ZVwiXSA9IGYzO1xuaW1wb3J0IGY0IGZyb20gXCIvVXNlcnMvR2FtZXMvUHJvamVjdHMvSVNFS0FJL3NyYy9jb21tYW5kcy9sb2dzLmpzXCI7XG5yZXNbXCJsb2dzXCJdID0gZjQ7XG5pbXBvcnQgZjUgZnJvbSBcIi9Vc2Vycy9HYW1lcy9Qcm9qZWN0cy9JU0VLQUkvc3JjL2NvbW1hbmRzL3B1bGwuanNcIjtcbnJlc1tcInB1bGxcIl0gPSBmNTtcbmltcG9ydCBmNiBmcm9tIFwiL1VzZXJzL0dhbWVzL1Byb2plY3RzL0lTRUtBSS9zcmMvY29tbWFuZHMvcHVzaC5qc1wiO1xucmVzW1wicHVzaFwiXSA9IGY2O1xuaW1wb3J0IGY3IGZyb20gXCIvVXNlcnMvR2FtZXMvUHJvamVjdHMvSVNFS0FJL3NyYy9jb21tYW5kcy9za2lsbHMuanNcIjtcbnJlc1tcInNraWxsc1wiXSA9IGY3O1xuaW1wb3J0IGY4IGZyb20gXCIvVXNlcnMvR2FtZXMvUHJvamVjdHMvSVNFS0FJL3NyYy9jb21tYW5kcy9zcGF3bi5qc1wiO1xucmVzW1wic3Bhd25cIl0gPSBmODtcbmltcG9ydCBmOSBmcm9tIFwiL1VzZXJzL0dhbWVzL1Byb2plY3RzL0lTRUtBSS9zcmMvY29tbWFuZHMvc3RhcnQuanNcIjtcbnJlc1tcInN0YXJ0XCJdID0gZjk7XG5pbXBvcnQgZjEwIGZyb20gXCIvVXNlcnMvR2FtZXMvUHJvamVjdHMvSVNFS0FJL3NyYy9jb21tYW5kcy9zdGF0dXMuanNcIjtcbnJlc1tcInN0YXR1c1wiXSA9IGYxMDtcbmltcG9ydCBmMTEgZnJvbSBcIi9Vc2Vycy9HYW1lcy9Qcm9qZWN0cy9JU0VLQUkvc3JjL2NvbW1hbmRzL3N0b3AuanNcIjtcbnJlc1tcInN0b3BcIl0gPSBmMTE7XG5pbXBvcnQgZjEyIGZyb20gXCIvVXNlcnMvR2FtZXMvUHJvamVjdHMvSVNFS0FJL3NyYy9jb21tYW5kcy92ZXJzaW9uLmpzXCI7XG5yZXNbXCJ2ZXJzaW9uXCJdID0gZjEyO1xuaW1wb3J0IGYxMyBmcm9tIFwiL1VzZXJzL0dhbWVzL1Byb2plY3RzL0lTRUtBSS9zcmMvY29tbWFuZHMvd2F0Y2guanNcIjtcbnJlc1tcIndhdGNoXCJdID0gZjEzO1xuZXhwb3J0IGRlZmF1bHQgcmVzOyIsImltcG9ydCBjIGZyb20gXCJjaGFsa1wiO1xyXG5cclxuY29uc3QgeyBsb2cgfSA9IGNvbnNvbGU7XHJcblxyXG5jb25zb2xlLmxvZyA9ICguLi5hcmdzKSA9PiBsb2coXHJcbiAgICAuLi5hcmdzLm1hcChcclxuICAgICAgICAoaXRlbSkgPT4gdHlwZW9mIGl0ZW0gPT09IGBzdHJpbmdgXHJcbiAgICAgICAgICAgID8gYy5ncmVlbihcclxuICAgICAgICAgICAgICAgIGl0ZW0ucmVwbGFjZSgvKFxcWy5bXlxcXVxcW10qXFxdKS91ZywgYy5ib2xkLndoaXRlKGAkMWApKVxyXG4gICAgICAgICAgICApXHJcbiAgICAgICAgICAgIDogaXRlbVxyXG4gICAgKVxyXG4pO1xyXG4iLCIjIS91c3IvYmluL2VudiBub2RlXHJcblxyXG5pbXBvcnQgdm9ycGFsIGZyb20gXCJ2b3JwYWxcIjtcclxuaW1wb3J0IGNvbW1hbmRzIGZyb20gXCIuL2NvbW1hbmRzLyouanNcIjtcclxuaW1wb3J0IHsgdmVyc2lvbiB9IGZyb20gXCIuLi9wYWNrYWdlLmpzb25cIjtcclxuXHJcbmltcG9ydCBcIi4vbGliL2Zvcm1hdC5qc1wiO1xyXG5cclxuaW1wb3J0IGNoYWxrIGZyb20gXCJjaGFsa1wiO1xyXG5cclxuY29uc3QgdiA9IHZvcnBhbCgpO1xyXG5cclxuT2JqZWN0LmVudHJpZXMoY29tbWFuZHMpLlxyXG4gICAgZm9yRWFjaCgoW1xyXG4gICAgICAgIG5hbWUsIHtcclxuICAgICAgICAgICAgaGVscCxcclxuICAgICAgICAgICAgaGFuZGxlcixcclxuICAgICAgICAgICAgYXV0b2NvbXBsZXRlLFxyXG4gICAgICAgICAgICBoaWRkZW4sXHJcbiAgICAgICAgICAgIGNvbW1hbmQsXHJcbiAgICAgICAgICAgIGFsaWFzID0gW10sXHJcbiAgICAgICAgICAgIG9wdGlvbnMgPSB7fSxcclxuICAgICAgICAgICAgY2FuY2VsID0gKCkgPT4ge31cclxuICAgICAgICB9XHJcbiAgICBdKSA9PiB7IFxyXG4gICAgICAgIGNvbnN0IGlzdCA9IHYuY29tbWFuZChjb21tYW5kIHx8IG5hbWUsIGhlbHApLlxyXG4gICAgICAgICAgICBhbGlhcyhhbGlhcykuXHJcbiAgICAgICAgICAgIGF1dG9jb21wbGV0ZShhdXRvY29tcGxldGUgfHwgW10pLlxyXG4gICAgICAgICAgICBjYW5jZWwoY2FuY2VsKS5cclxuICAgICAgICAgICAgYWN0aW9uKGhhbmRsZXIpO1xyXG5cclxuICAgICAgICBpZihoaWRkZW4pIHtcclxuICAgICAgICAgICAgaXN0LmhpZGRlbigpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgT2JqZWN0LmVudHJpZXMob3B0aW9ucykuXHJcbiAgICAgICAgICAgIGZvckVhY2goKFsgb3B0aW9uLCBvcHRpb25faGVscCBdKSA9PiB7XHJcbiAgICAgICAgICAgICAgICBpc3Qub3B0aW9uKG9wdGlvbiwgb3B0aW9uX2hlbHApO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgIH0pO1xyXG5cclxuY29uc3Qgc3RhcnR1cF9jb21tYW5kcyA9IHByb2Nlc3MuYXJndi5zbGljZSgyKTtcclxuXHJcbmlmKHN0YXJ0dXBfY29tbWFuZHMubGVuZ3RoID4gMCkge1xyXG4gICAgdi5leGVjKHN0YXJ0dXBfY29tbWFuZHMuam9pbihgIGApKTtcclxufSBlbHNlIHtcclxuXHJcbiAgICBwcm9jZXNzLnN0ZG91dC53cml0ZShgXFx4MUJjYCk7XHJcblxyXG4gICAgY29uc29sZS5sb2coY2hhbGsuZ3JlZW4oYFxyXG7ilojilojilZfilojilojilojilojilojilojilojilZfilojilojilojilojilojilojilojilZfilojilojilZcgIOKWiOKWiOKVlyDilojilojilojilojilojilZcg4paI4paI4pWXICAgICAg4paI4paI4paI4paI4paI4paI4paI4pWX4paI4paI4paI4pWXICAg4paI4paI4pWXIOKWiOKWiOKWiOKWiOKWiOKWiOKVlyDilojilojilZfilojilojilojilZcgICDilojilojilZfilojilojilojilojilojilojilojilZcgICAgXHJcbuKWiOKWiOKVkeKWiOKWiOKVlOKVkOKVkOKVkOKVkOKVneKWiOKWiOKVlOKVkOKVkOKVkOKVkOKVneKWiOKWiOKVkSDilojilojilZTilZ3ilojilojilZTilZDilZDilojilojilZfilojilojilZHiloQg4paI4paI4pWX4paE4paI4paI4pWU4pWQ4pWQ4pWQ4pWQ4pWd4paI4paI4paI4paI4pWXICDilojilojilZHilojilojilZTilZDilZDilZDilZDilZ0g4paI4paI4pWR4paI4paI4paI4paI4pWXICDilojilojilZHilojilojilZTilZDilZDilZDilZDilZ0gICAgXHJcbuKWiOKWiOKVkeKWiOKWiOKWiOKWiOKWiOKWiOKWiOKVl+KWiOKWiOKWiOKWiOKWiOKVlyAg4paI4paI4paI4paI4paI4pWU4pWdIOKWiOKWiOKWiOKWiOKWiOKWiOKWiOKVkeKWiOKWiOKVkSDilojilojilojilojilZfilojilojilojilojilojilZcgIOKWiOKWiOKVlOKWiOKWiOKVlyDilojilojilZHilojilojilZEgIOKWiOKWiOKWiOKVl+KWiOKWiOKVkeKWiOKWiOKVlOKWiOKWiOKVlyDilojilojilZHilojilojilojilojilojilZcgICAgICBcclxu4paI4paI4pWR4pWa4pWQ4pWQ4pWQ4pWQ4paI4paI4pWR4paI4paI4pWU4pWQ4pWQ4pWdICDilojilojilZTilZDilojilojilZcg4paI4paI4pWU4pWQ4pWQ4paI4paI4pWR4paI4paI4pWR4paA4pWa4paI4paI4pWU4paA4paI4paI4pWU4pWQ4pWQ4pWdICDilojilojilZHilZrilojilojilZfilojilojilZHilojilojilZEgICDilojilojilZHilojilojilZHilojilojilZHilZrilojilojilZfilojilojilZHilojilojilZTilZDilZDilZ0gICAgICBcclxu4paI4paI4pWR4paI4paI4paI4paI4paI4paI4paI4pWR4paI4paI4paI4paI4paI4paI4paI4pWX4paI4paI4pWRICDilojilojilZfilojilojilZEgIOKWiOKWiOKVkeKWiOKWiOKVkSAg4pWa4pWQ4pWdIOKWiOKWiOKWiOKWiOKWiOKWiOKWiOKVl+KWiOKWiOKVkSDilZrilojilojilojilojilZHilZrilojilojilojilojilojilojilZTilZ3ilojilojilZHilojilojilZEg4pWa4paI4paI4paI4paI4pWR4paI4paI4paI4paI4paI4paI4paI4pWXICAgIFxyXG7ilZrilZDilZ3ilZrilZDilZDilZDilZDilZDilZDilZ3ilZrilZDilZDilZDilZDilZDilZDilZ3ilZrilZDilZ0gIOKVmuKVkOKVneKVmuKVkOKVnSAg4pWa4pWQ4pWd4pWa4pWQ4pWdICAgICAg4pWa4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWd4pWa4pWQ4pWdICDilZrilZDilZDilZDilZ0g4pWa4pWQ4pWQ4pWQ4pWQ4pWQ4pWdIOKVmuKVkOKVneKVmuKVkOKVnSAg4pWa4pWQ4pWQ4pWQ4pWd4pWa4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWdICAgIFxyXG5WRVJTSU9OOiAke3ZlcnNpb259ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcclxuYCkpO1xyXG5cclxuICAgIHYuZGVsaW1pdGVyKGNoYWxrLmJvbGQuZ3JlZW4oYD5gKSkuXHJcbiAgICAgICAgc2hvdygpO1xyXG59Il0sIm5hbWVzIjpbImdsb2IiLCJjcmVhdGVGaWx0ZXIiLCJ0ZXJzZXIiLCJ0b21sIiwiZ2l0IiwiZXhlYyIsInNwYXduIiwicG0yIiwid2F0Y2giLCJ2ZXJzaW9uIiwiY29tbWFuZHMiLCJjaGFsayJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFHQSxlQUFlLE1BQU1BLE1BQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO0lBQzlDLEdBQUcsQ0FBQyxDQUFDLFVBQVUsS0FBSyxJQUFJLENBQUMsUUFBUSxDQUFDLFVBQVUsRUFBRSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7O0FDRjNELFNBQWUsQ0FBQztJQUNaLElBQUksRUFBRSxDQUFDLDhCQUE4QixDQUFDO0lBQ3RDLEtBQUssRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLFNBQVMsQ0FBQyxFQUFFO0lBQ3JDLE9BQU8sRUFBRSxDQUFDLElBQUksRUFBRSxFQUFFLEtBQUs7UUFDbkIsT0FBTyxDQUFDLEdBQUcsQ0FBQyxRQUFRLEVBQUU7WUFDbEIsR0FBRyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUNwQixJQUFJLENBQUMsQ0FBQyxHQUFHLENB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
