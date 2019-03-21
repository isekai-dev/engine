#!/usr/bin/env node
'use strict';

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var vorpal = _interopDefault(require('vorpal'));
var fs = _interopDefault(require('fs'));
var toml = _interopDefault(require('toml'));
var path = _interopDefault(require('path'));
var glob$1 = _interopDefault(require('glob'));
var c = _interopDefault(require('chalk'));
var toml$1 = _interopDefault(require('rollup-plugin-toml'));
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
var rollup = _interopDefault(require('rollup'));
var child_process = require('child_process');
var pm2 = _interopDefault(require('pm2'));
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

const do_copy = (copyObject) => 
    copy(Object.keys(copyObject).
        map(
            (key) => 
                ({
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
}) => 
    ({
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
            do_copy(copyObject),
            toml$1
        ],
    });

const browser = ({
    input,
    output,
    css: cssPath,
    copy: copyObject,
}) => 
    ({
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
                CLIENT_VERSION: () => 
                    CLIENT_VERSION
            }),
            toml$1,
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
                path: `./.MAGIC/client.version`,
                version: () => 
                    CLIENT_VERSION
            })
        ]
    });

var builders = {
    node,
    browser
};

c.enabled = true;
c.level = 3;

var toml_to_js = (configFile) => 
    // Mix Config File in and run these in order
    Object.values({
        gather_SKILLS: () => 
            ({
                SKILLS: glob$1.sync(`./SKILLS/*/`).
                    reduce((obj, equip_path) => 
                        ({ 
                            [path.basename(equip_path)]: true,
                            ...obj 
                        }), {})
            }),

        read_config: ({
            configFile,
        }) => {
        // verify toml exists
            let raw;

            try {
                raw = fs.readFileSync(configFile, `utf-8`);
            } catch (exception) {
                throw new Error(`Couldn't read ${configFile}. Are you sure this path is correct?`);
            }

            const config = toml.parse(raw);

            return {
                config,
            };
        },

        set_names: ({
            configFile,
            config
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
            SKILLS,
        }) => {
        // WRITE OUT FILE
            let entry = ``;
            
            const write = (data) => 
                entry += `${data}\r\n`;
        
            write(`import isekai from "isekai";`);
            write(`isekai.SET(${JSON.stringify(config)});`);
            write(``);
    
            const equiped = Object.keys(config).
                filter((key) => 
                    key === key.toUpperCase() && SKILLS[key]).
                map((key) => {
                    write(`import ${key} from "../SKILLS/${key}/index.js";`);

                    return key;
                });

            const keys = equiped.reduce((output, key) => 
                `${output}    ${key},\r\n`, ``);

            write(`
isekai.EQUIP({\r\n${keys}});`);

            const input = path.join(`.MAGIC`, `${name}.entry.js`);

            // write out their index.js
            fs.writeFileSync(input, entry, `utf-8`);
            
            console.log(`
[${name}][${config.NODE ? `NODE` : `BROWSER`}]

[SKILLS]:
${c.red(equiped.join(` - `))}
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

            const output = `.MAGIC/${name}.${target}.js`;

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

            throw new Error(`You must specify either [NODE] or [BROWSER] for your target`);
        }
    }).
        reduce((state, fn) => 
            ({
                ...state,
                ...fn(state)
            }), { configFile });

var get_list = () => 
    glob$1.sync(`./CHARACTERS/*.toml`).
        map((class_path) => 
            path.basename(class_path, `.toml`));

var filter_list = (classes) => 
    (fn) => 
        Promise.all(classes.filter((target) => {
            const is_okay = get_list().
                indexOf(target) !== -1;

            if(!is_okay) {
                console.log(`${target} is not an available [CHARACTER]`);
            }
        
            return is_okay;
        }).
            map(fn));

var f0 = ({
    command: `build [CHARACTERS...]`,
    help: `build all [CHARACTERS] files.`,
    autocomplete: get_list(),
    hidden: true,
    handler: ({ CHARACTERS = get_list() }) => 
        filter_list(CHARACTERS)(async (target) => {
            const { build_info, name } = await toml_to_js(`./CHARACTERS/${target}.toml`);
            const bundle = await rollup.rollup(build_info);

            /*
             * console.log(`Generating output...`);
             * const { output } = await bundle.generate(build_info.output);
             */

            // console.log(output);
            await bundle.write(build_info.output);
            console.log(`[${name}] Build Complete.\r\n`);
        }).
            then((promises) => {
                console.log(`Built ${promises.length} [CHARACTER] file(s).`);
            })
});

// pipe out to pm2

var f2 = ({
    command: `pm2 [commands...]`,

    help: `execute a pm2 command`,
    hidden: true,

    cancel() {
        if(!this.node) {
            return;
        }

        this.node.kill();
    },

    handler({ commands }, cb) {
        if(!commands) {
            console.log(`You must provide commands for pm2\r\n`);
            
            return cb();
        }
        
        return new Promise((resolve) => {
            this.node = child_process.spawn(`node`, `${__dirname}/../node_modules/pm2/bin/pm2 ${commands.join(` `)}`.split(` `), {
                env: process.env,
                stdio: `inherit`
            });

            this.node.on(`close`, () => {
                resolve();
            });
        });
    }
});

var f1 = ({
    command: `logs [CHARACTERS...]`,
    help: `follow the logs`,
    handler: ({ CHARACTERS = [] }) => 
        new Promise(() => 
            f2.handler({
                commands: [ `logs`, ...CHARACTERS ]
            }))
});

var f3 = ({
    help: `Show available [CHARACTER] files.`,
    alias: [ `ls` ],
    handler: (args, cb) => {
        console.log(get_list().
            map((i) => 
                `[${i}]`).
            join(` - `), `\r\n`);    
            
        cb();
    }
});

var f4 = ({
    commander: `spawn [CHARACTERS...]`,
    help: `spawn [CHARACTERS] files`,
    hidden: true,
    handler: ({
        CHARACTERS = get_list()
    }) => {
        filter_list(CHARACTERS)((name) => {
            const {
                output,
            } = toml_to_js(`./CHARACTERS/${name}.toml`);
            console.log(`watching`, output);

            pm2.start({
                name,
                script: output,
                watch: true,
                watch_options: {
                    usePolling: true
                },
                max_restart: 5 
            });
        });

    }
});

var action = (
    action_map, 
    reducer = (i) => 
        i
) => 
    (input) => {
        const key = reducer(input);

        if(!action_map[key]) {
            return;
        }

        return action_map[key](input);
    };

const watch_prompt = () => 
    console.log(`[BUILT] PRESS [CTRL+C] TO QUIT YOUR WATCH`);

var f8 = ({
    command: `watch [CHARACTERS...]`,
    help: `watch [CHARACTER] files for changes and rebuild.`,
    hidden: true,
    cancel () {
        this.watchers.forEach((watcher) => 
            watcher.close());
        console.log(`YOUR WATCH HAS ENDED`);
    },
    handler({ CHARACTERS = get_list() }, cb) {
        return new Promise((resolve) => {
            this.watchers = [];
            
            filter_list(CHARACTERS)((target) => {
                const file_path = `./CHARACTERS/${target}.toml`;

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
                            watch_prompt();
                        },
                        FATAL: ({ error }) => {
                            console.error(c.red.bold(error));
                        }
                    }, ({ code }) => 
                        code 
                    ));

                this.watchers.push(rollup_watcher);
            });
        });
    }
});

var f7 = ({
    command: `stop [CHARACTERS...]`,
    help: `stop active CHARACTERS] files. `, 

    handler: ({ CHARACTERS = [ `all` ] }) => 
        f2.handler({
            commands: [ `delete`, ...CHARACTERS ]
        })
});

var f5 = ({
    command: `start [CHARACTERS...]`,
    help: `start and watch [CHARACTERS] files`, 
    handler(data) { 
        this.data = data.CHARACTERS 
            ? data
            : { CHARACTERS: get_list() };

        f8.handler(this.data);
        f4.handler(this.data);

        f2.handler({
            commands: [ `logs` ]
        });
    },
    cancel() {
        f8.cancel();
        console.log(`STOPPING ${this.data.CHARACTERS.map((i) => 
            `[${i}]`).
            join(` - `)}`);
        
        return f7.handler(this.data);
    }
});

var f6 = ({
    command: `status`,
    help: `[STATUS] of active [CHARACTERS] files.`,
    alias: [ `ps`, `active` ],
    handler: () => 
        f2.handler({
            commands: [ `ps` ]
        })
});

const res = {};
res["build"] = f0;
res["logs"] = f1;
res["pm2"] = f2;
res["shop"] = f3;
res["spawn"] = f4;
res["start"] = f5;
res["status"] = f6;
res["stop"] = f7;
res["watch"] = f8;

var version$1 = "0.0.2";

const { log } = console;

console.log = (...args) => 
    log(
        ...args.map(
            (item) => 
                typeof item === `string`
                    ? c.green(
                        item.replace(/(\[.[^\]\[]*\])/ug, c.bold.white(`$1`))
                    )
                    : item
        )
    );

const v = vorpal();
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


Object.entries(res).
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

        v.delimiter(c.bold.green(`>`)).
            show();
    });
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2xpLmpzIiwic291cmNlcyI6WyIuLi9zcmMvcm9sbHVwL3BsdWdpbi1nbG9iLmpzIiwiLi4vc3JjL3JvbGx1cC92ZXJzaW9uLmpzIiwiLi4vc3JjL3JvbGx1cC9idWlsZGVycy5qcyIsIi4uL3NyYy90cmFuc2Zvcm1zL3RvbWxfdG9fanMuanMiLCIuLi9zcmMvbGliL2dldF9saXN0LmpzIiwiLi4vc3JjL2xpYi9maWx0ZXJfbGlzdC5qcyIsIi4uL3NyYy9jb21tYW5kcy9idWlsZC5qcyIsIi4uL3NyYy9jb21tYW5kcy9wbTIuanMiLCIuLi9zcmMvY29tbWFuZHMvbG9ncy5qcyIsIi4uL3NyYy9jb21tYW5kcy9zaG9wLmpzIiwiLi4vc3JjL2NvbW1hbmRzL3NwYXduLmpzIiwiLi4vc3JjL2xpYi9hY3Rpb24uanMiLCIuLi9zcmMvY29tbWFuZHMvd2F0Y2guanMiLCIuLi9zcmMvY29tbWFuZHMvc3RvcC5qcyIsIi4uL3NyYy9jb21tYW5kcy9zdGFydC5qcyIsIi4uL3NyYy9jb21tYW5kcy9zdGF0dXMuanMiLCIuLi80ZWU0OTVmYjE4MGUyYjRhNjVhN2MxNTI2MDk4YmIwZCIsIi4uL3NyYy9saWIvZm9ybWF0LmpzIiwiLi4vc3JjL2NsaS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJcclxuaW1wb3J0IGZzIGZyb20gXCJmc1wiO1xyXG5pbXBvcnQgb3MgZnJvbSBcIm9zXCI7XHJcbmltcG9ydCBnbG9iIGZyb20gXCJnbG9iXCI7XHJcbmltcG9ydCBwYXRoIGZyb20gXCJwYXRoXCI7XHJcbmltcG9ydCBtZDUgZnJvbSBcIm1kNVwiO1xyXG5cclxuaW1wb3J0IHsgY3JlYXRlRmlsdGVyIH0gZnJvbSBcInJvbGx1cC1wbHVnaW51dGlsc1wiO1xyXG5cclxuY29uc3QgZ2V0RlNQcmVmaXggPSAocHJlZml4ID0gcHJvY2Vzcy5jd2QoKSkgPT4ge1xyXG4gICAgY29uc3QgcGFyZW50ID0gcGF0aC5qb2luKHByZWZpeCwgYC4uYCk7XHJcbiAgICBpZiAocGFyZW50ID09PSBwcmVmaXgpIHtcclxuICAgICAgICByZXR1cm4gcHJlZml4O1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICByZXR1cm4gZ2V0RlNQcmVmaXgocGFyZW50KTtcclxufTtcclxuXHJcbmNvbnN0IGZzUHJlZml4ID0gZ2V0RlNQcmVmaXgoKTtcclxuY29uc3Qgcm9vdFBhdGggPSBwYXRoLmpvaW4oYC9gKTtcclxuXHJcbmNvbnN0IHRvVVJMU3RyaW5nID0gKGZpbGVQYXRoKSA9PiB7XHJcbiAgICBjb25zdCBwYXRoRnJhZ21lbnRzID0gcGF0aC5qb2luKGZpbGVQYXRoKS5cclxuICAgICAgICByZXBsYWNlKGZzUHJlZml4LCByb290UGF0aCkuXHJcbiAgICAgICAgc3BsaXQocGF0aC5zZXApO1xyXG4gICAgaWYgKCFwYXRoLmlzQWJzb2x1dGUoZmlsZVBhdGgpKSB7XHJcbiAgICAgICAgcGF0aEZyYWdtZW50cy51bnNoaWZ0KGAuYCk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIHJldHVybiBwYXRoRnJhZ21lbnRzLmpvaW4oYC9gKTtcclxufTtcclxuXHJcbmNvbnN0IHJlc29sdmVOYW1lID0gKGZyb20pID0+IFxyXG4gICAgZnJvbS5zcGxpdChgL2ApLlxyXG4gICAgICAgIHBvcCgpLlxyXG4gICAgICAgIHNwbGl0KGAuYCkuXHJcbiAgICAgICAgc2hpZnQoKTtcclxuXHJcbmV4cG9ydCBkZWZhdWx0ICh7IFxyXG4gICAgaW5jbHVkZSwgXHJcbiAgICBleGNsdWRlIFxyXG59ID0gZmFsc2UpID0+IHtcclxuICAgIGNvbnN0IGZpbHRlciA9IGNyZWF0ZUZpbHRlcihpbmNsdWRlLCBleGNsdWRlKTtcclxuICAgIFxyXG4gICAgcmV0dXJuIHtcclxuICAgICAgICBuYW1lOiBgcm9sbHVwLWdsb2JgLFxyXG4gICAgICAgIGxvYWQ6IChpZCkgPT4ge1xyXG4gICAgICAgICAgICBjb25zdCBzcmNGaWxlID0gcGF0aC5qb2luKG9zLnRtcGRpcigpLCBpZCk7XHJcblxyXG4gICAgICAgICAgICBsZXQgb3B0aW9ucztcclxuICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICAgIG9wdGlvbnMgPSBKU09OLnBhcnNlKGZzLnJlYWRGaWxlU3luYyhzcmNGaWxlKSk7XHJcbiAgICAgICAgICAgIH0gY2F0Y2goZXJyKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGNvbnN0IHsgaW1wb3J0ZWUsIGltcG9ydGVyIH0gPSBvcHRpb25zO1xyXG5cclxuICAgICAgICAgICAgY29uc3QgaW1wb3J0ZWVJc0Fic29sdXRlID0gcGF0aC5pc0Fic29sdXRlKGltcG9ydGVlKTtcclxuICAgICAgICAgICAgY29uc3QgY3dkID0gcGF0aC5kaXJuYW1lKGltcG9ydGVyKTtcclxuICAgICAgICAgICAgY29uc3QgZ2xvYlBhdHRlcm4gPSBpbXBvcnRlZTtcclxuXHJcbiAgICAgICAgICAgIGNvbnN0IGZpbGVzID0gZ2xvYi5zeW5jKGdsb2JQYXR0ZXJuLCB7XHJcbiAgICAgICAgICAgICAgICBjd2RcclxuICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICBsZXQgY29kZSA9IFsgYGNvbnN0IHJlcyA9IHt9O2AgXTtcclxuICAgICAgICAgICAgbGV0IGltcG9ydEFycmF5ID0gW107XHJcblxyXG4gICAgICAgICAgICBmaWxlcy5mb3JFYWNoKChmaWxlLCBpKSA9PiB7XHJcbiAgICAgICAgICAgICAgICBsZXQgZnJvbTtcclxuICAgICAgICAgICAgICAgIGlmIChpbXBvcnRlZUlzQWJzb2x1dGUpIHtcclxuICAgICAgICAgICAgICAgICAgICBmcm9tID0gdG9VUkxTdHJpbmcoZmlsZSk7XHJcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgIGZyb20gPSB0b1VSTFN0cmluZyhwYXRoLnJlc29sdmUoY3dkLCBmaWxlKSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBjb2RlLnB1c2goYGltcG9ydCBmJHtpfSBmcm9tIFwiJHtmcm9tfVwiO2ApO1xyXG4gICAgICAgICAgICAgICAgY29kZS5wdXNoKGByZXNbXCIke3Jlc29sdmVOYW1lKGZyb20pfVwiXSA9IGYke2l9O2ApO1xyXG4gICAgICAgICAgICAgICAgaW1wb3J0QXJyYXkucHVzaChmcm9tKTtcclxuICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICBjb2RlLnB1c2goYGV4cG9ydCBkZWZhdWx0IHJlcztgKTtcclxuXHJcbiAgICAgICAgICAgIGNvZGUgPSBjb2RlLmpvaW4oYFxcbmApO1xyXG4gICAgICAgIFxyXG4gICAgICAgICAgICByZXR1cm4gY29kZTtcclxuXHJcbiAgICAgICAgfSxcclxuICAgICAgICByZXNvbHZlSWQ6IChpbXBvcnRlZSwgaW1wb3J0ZXIpID0+IHtcclxuICAgICAgICAgICAgaWYgKCFmaWx0ZXIoaW1wb3J0ZWUpIHx8ICFpbXBvcnRlZS5pbmNsdWRlcyhgKmApKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGNvbnN0IGhhc2ggPSBtZDUoaW1wb3J0ZWUgKyBpbXBvcnRlcik7XHJcblxyXG4gICAgICAgICAgICBmcy53cml0ZUZpbGVTeW5jKHBhdGguam9pbihvcy50bXBkaXIoKSwgaGFzaCksIEpTT04uc3RyaW5naWZ5KHtcclxuICAgICAgICAgICAgICAgIGltcG9ydGVlLFxyXG4gICAgICAgICAgICAgICAgaW1wb3J0ZXJcclxuICAgICAgICAgICAgfSkpO1xyXG5cclxuICAgICAgICAgICAgcmV0dXJuIGhhc2g7XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxufTsiLCJpbXBvcnQgZnMgZnJvbSBcImZzXCI7XHJcblxyXG5leHBvcnQgZGVmYXVsdCAoe1xyXG4gICAgcGF0aCxcclxuICAgIHZlcnNpb25cclxufSkgPT4gXHJcbiAgICAoe1xyXG4gICAgICAgIG5hbWU6IGByb2xsdXAtd3JpdGVgLFxyXG4gICAgICAgIGJ1aWxkU3RhcnQ6ICgpID0+IHtcclxuICAgICAgICAgICAgZnMud3JpdGVGaWxlU3luYyhwYXRoLCB2ZXJzaW9uKCkpO1xyXG4gICAgICAgIH1cclxuICAgIH0pOyIsImltcG9ydCB0b21sIGZyb20gXCJyb2xsdXAtcGx1Z2luLXRvbWxcIjtcclxuXHJcblxyXG5pbXBvcnQgc3ZlbHRlIGZyb20gXCJyb2xsdXAtcGx1Z2luLXN2ZWx0ZVwiO1xyXG5pbXBvcnQgcmVzb2x2ZSBmcm9tIFwicm9sbHVwLXBsdWdpbi1ub2RlLXJlc29sdmVcIjtcclxuaW1wb3J0IGNvcHkgZnJvbSBcInJvbGx1cC1wbHVnaW4tY29weS1nbG9iXCI7XHJcbmltcG9ydCByZXBsYWNlIGZyb20gXCJyb2xsdXAtcGx1Z2luLXJlcGxhY2VcIjtcclxuXHJcbmltcG9ydCBqc29uIGZyb20gXCJyb2xsdXAtcGx1Z2luLWpzb25cIjtcclxuaW1wb3J0IG1kIGZyb20gXCJyb2xsdXAtcGx1Z2luLWNvbW1vbm1hcmtcIjtcclxuaW1wb3J0IGNqcyBmcm9tIFwicm9sbHVwLXBsdWdpbi1jb21tb25qc1wiO1xyXG5cclxuaW1wb3J0IHsgdGVyc2VyIH0gZnJvbSBcInJvbGx1cC1wbHVnaW4tdGVyc2VyXCI7XHJcbmltcG9ydCB1dWlkIGZyb20gXCJ1dWlkL3YxXCI7XHJcblxyXG4vKlxyXG4gKiBpbXBvcnQgc3ByaXRlc21pdGggZnJvbSBcInJvbGx1cC1wbHVnaW4tc3ByaXRlXCI7XHJcbiAqIGltcG9ydCB0ZXh0dXJlUGFja2VyIGZyb20gXCJzcHJpdGVzbWl0aC10ZXh0dXJlcGFja2VyXCI7XHJcbiAqL1xyXG5cclxuaW1wb3J0IGdsb2IgZnJvbSBcIi4vcGx1Z2luLWdsb2IuanNcIjtcclxuaW1wb3J0IHZlcnNpb24gZnJvbSBcIi4vdmVyc2lvbi5qc1wiO1xyXG5cclxuY29uc3QgQ09ERV9WRVJTSU9OID0gdXVpZCgpO1xyXG5jb25zdCBwcm9kdWN0aW9uID0gIXByb2Nlc3MuZW52LlJPTExVUF9XQVRDSDtcclxuXHJcbmNvbnN0IGRvX2NvcHkgPSAoY29weU9iamVjdCkgPT4gXHJcbiAgICBjb3B5KE9iamVjdC5rZXlzKGNvcHlPYmplY3QpLlxyXG4gICAgICAgIG1hcChcclxuICAgICAgICAgICAgKGtleSkgPT4gXHJcbiAgICAgICAgICAgICAgICAoe1xyXG4gICAgICAgICAgICAgICAgICAgIGZpbGVzOiBrZXksXHJcbiAgICAgICAgICAgICAgICAgICAgZGVzdDogY29weU9iamVjdFtrZXldXHJcbiAgICAgICAgICAgICAgICB9KVxyXG4gICAgICAgICkpO1xyXG5cclxubGV0IENMSUVOVF9WRVJTSU9OID0gdXVpZCgpO1xyXG5cclxuY29uc3QgZXh0ZXJuYWwgPSBbXHJcbiAgICBgZXhwcmVzc2AsXHJcbiAgICBgaXNla2FpYCxcclxuICAgIGBmc2AsXHJcbiAgICBgaHR0cGAsXHJcbiAgICBgaHR0cHNgXHJcbl07XHJcblxyXG5jb25zdCBub2RlID0gKHtcclxuICAgIGlucHV0LFxyXG4gICAgb3V0cHV0LFxyXG4gICAgY29weTogY29weU9iamVjdCA9IHt9XHJcbn0pID0+IFxyXG4gICAgKHtcclxuICAgICAgICBpbnB1dCxcclxuICAgICAgICBvdXRwdXQ6IHtcclxuICAgICAgICAgICAgc291cmNlbWFwOiBgaW5saW5lYCxcclxuICAgICAgICAgICAgZmlsZTogb3V0cHV0LFxyXG4gICAgICAgICAgICBmb3JtYXQ6IGBjanNgLFxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgZXh0ZXJuYWwsXHJcbiAgICAgICAgcGx1Z2luczogW1xyXG4gICAgICAgICAgICBnbG9iKCksXHJcbiAgICAgICAgICAgIHJlcGxhY2Uoe1xyXG4gICAgICAgICAgICAgICAgQ09ERV9WRVJTSU9OLFxyXG4gICAgICAgICAgICB9KSxcclxuICAgICAgICAgICAgbWQoKSxcclxuICAgICAgICAgICAgZG9fY29weShjb3B5T2JqZWN0KSxcclxuICAgICAgICAgICAgdG9tbFxyXG4gICAgICAgIF0sXHJcbiAgICB9KTtcclxuXHJcbmNvbnN0IGJyb3dzZXIgPSAoe1xyXG4gICAgaW5wdXQsXHJcbiAgICBvdXRwdXQsXHJcbiAgICBjc3M6IGNzc1BhdGgsXHJcbiAgICBjb3B5OiBjb3B5T2JqZWN0LFxyXG59KSA9PiBcclxuICAgICh7XHJcbiAgICAgICAgaW5wdXQsXHJcbiAgICAgICAgb3V0cHV0OiB7XHJcbiAgICAgICAgICAgIGZpbGU6IG91dHB1dCxcclxuICAgICAgICAgICAgZm9ybWF0OiBgaWlmZWAsXHJcbiAgICAgICAgfSxcclxuICAgICAgICBleHRlcm5hbDogWyBgdXVpZGAsIGB1dWlkL3YxYCwgYHBpeGkuanNgIF0sXHJcbiAgICAgICAgcGx1Z2luczogW1xyXG4gICAgICAgIC8vIC8vIG1ha2UgdGhpcyBhIHJlYWN0aXZlIHBsdWdpbiB0byBcIi50aWxlbWFwLmpzb25cIlxyXG4gICAgICAgIC8vICAgICBzcHJpdGVzbWl0aCh7XHJcbiAgICAgICAgLy8gICAgICAgICBzcmM6IHtcclxuICAgICAgICAvLyAgICAgICAgICAgICBjd2Q6IFwiLi9nb2JsaW4ubGlmZS9CUk9XU0VSLlBJWEkvXHJcbiAgICAgICAgLy8gICAgICAgICAgICAgZ2xvYjogXCIqKi8qLnBuZ1wiXHJcbiAgICAgICAgLy8gICAgICAgICB9LFxyXG4gICAgICAgIC8vICAgICAgICAgdGFyZ2V0OiB7XHJcbiAgICAgICAgLy8gICAgICAgICAgICAgaW1hZ2U6IFwiLi9iaW4vcHVibGljL2ltYWdlcy9zcHJpdGUucG5nXCIsXHJcbiAgICAgICAgLy8gICAgICAgICAgICAgY3NzOiBcIi4vYmluL3B1YmxpYy9hcnQvZGVmYXVsdC5qc29uXCJcclxuICAgICAgICAvLyAgICAgICAgIH0sXHJcbiAgICAgICAgLy8gICAgICAgICBvdXRwdXQ6IHtcclxuICAgICAgICAvLyAgICAgICAgICAgICBpbWFnZTogXCIuL2Jpbi9wdWJsaWMvaW1hZ2VzL3Nwcml0ZS5wbmdcIlxyXG4gICAgICAgIC8vICAgICAgICAgfSxcclxuICAgICAgICAvLyAgICAgICAgIHNwcml0ZXNtaXRoT3B0aW9uczoge1xyXG4gICAgICAgIC8vICAgICAgICAgICAgIHBhZGRpbmc6IDBcclxuICAgICAgICAvLyAgICAgICAgIH0sXHJcbiAgICAgICAgLy8gICAgICAgICBjdXN0b21UZW1wbGF0ZTogdGV4dHVyZVBhY2tlclxyXG4gICAgICAgIC8vICAgICB9KSxcclxuICAgICAgICAgICAgZ2xvYigpLFxyXG4gICAgICAgICAgICBjanMoe1xyXG4gICAgICAgICAgICAgICAgaW5jbHVkZTogYG5vZGVfbW9kdWxlcy8qKmAsIFxyXG4gICAgICAgICAgICB9KSxcclxuICAgICAgICAgICAganNvbigpLFxyXG4gICAgICAgICAgICByZXBsYWNlKHtcclxuICAgICAgICAgICAgICAgIENPREVfVkVSU0lPTixcclxuICAgICAgICAgICAgICAgIENMSUVOVF9WRVJTSU9OOiAoKSA9PiBcclxuICAgICAgICAgICAgICAgICAgICBDTElFTlRfVkVSU0lPTlxyXG4gICAgICAgICAgICB9KSxcclxuICAgICAgICAgICAgdG9tbCxcclxuICAgICAgICAgICAgbWQoKSxcclxuICAgICAgICAgICAgc3ZlbHRlKHtcclxuICAgICAgICAgICAgICAgIGNzczogKGNzcykgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIGNzcy53cml0ZShjc3NQYXRoKTtcclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIH0pLFxyXG4gICAgICAgICAgICByZXNvbHZlKCksXHJcbiAgICAgICAgICAgIHByb2R1Y3Rpb24gJiYgdGVyc2VyKCksXHJcbiAgICAgICAgICAgIGRvX2NvcHkoY29weU9iamVjdCksXHJcbiAgICAgICAgICAgIHZlcnNpb24oe1xyXG4gICAgICAgICAgICAgICAgcGF0aDogYC4vLk1BR0lDL2NsaWVudC52ZXJzaW9uYCxcclxuICAgICAgICAgICAgICAgIHZlcnNpb246ICgpID0+IFxyXG4gICAgICAgICAgICAgICAgICAgIENMSUVOVF9WRVJTSU9OXHJcbiAgICAgICAgICAgIH0pXHJcbiAgICAgICAgXVxyXG4gICAgfSk7XHJcblxyXG5leHBvcnQgZGVmYXVsdCB7XHJcbiAgICBub2RlLFxyXG4gICAgYnJvd3NlclxyXG59OyIsImltcG9ydCBmcyBmcm9tIFwiZnNcIjtcclxuaW1wb3J0IHRvbWwgZnJvbSBcInRvbWxcIjtcclxuaW1wb3J0IHBhdGggZnJvbSBcInBhdGhcIjtcclxuaW1wb3J0IGdsb2IgZnJvbSBcImdsb2JcIjtcclxuaW1wb3J0IGMgZnJvbSBcImNoYWxrXCI7XHJcbmltcG9ydCBidWlsZGVycyBmcm9tIFwiLi4vcm9sbHVwL2J1aWxkZXJzLmpzXCI7XHJcblxyXG5jLmVuYWJsZWQgPSB0cnVlO1xyXG5jLmxldmVsID0gMztcclxuXHJcbmNvbnN0IGxvZ19lcXVpcCA9IChlcXVpcCkgPT4gXHJcbiAgICBjLnllbGxvdyhlcXVpcCk7XHJcblxyXG5leHBvcnQgZGVmYXVsdCAoY29uZmlnRmlsZSkgPT4gXHJcbiAgICAvLyBNaXggQ29uZmlnIEZpbGUgaW4gYW5kIHJ1biB0aGVzZSBpbiBvcmRlclxyXG4gICAgT2JqZWN0LnZhbHVlcyh7XHJcbiAgICAgICAgZ2F0aGVyX1NLSUxMUzogKCkgPT4gXHJcbiAgICAgICAgICAgICh7XHJcbiAgICAgICAgICAgICAgICBTS0lMTFM6IGdsb2Iuc3luYyhgLi9TS0lMTFMvKi9gKS5cclxuICAgICAgICAgICAgICAgICAgICByZWR1Y2UoKG9iaiwgZXF1aXBfcGF0aCkgPT4gXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICh7IFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgW3BhdGguYmFzZW5hbWUoZXF1aXBfcGF0aCldOiB0cnVlLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLi4ub2JqIFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB9KSwge30pXHJcbiAgICAgICAgICAgIH0pLFxyXG5cclxuICAgICAgICByZWFkX2NvbmZpZzogKHtcclxuICAgICAgICAgICAgY29uZmlnRmlsZSxcclxuICAgICAgICB9KSA9PiB7XHJcbiAgICAgICAgLy8gdmVyaWZ5IHRvbWwgZXhpc3RzXHJcbiAgICAgICAgICAgIGxldCByYXc7XHJcblxyXG4gICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgcmF3ID0gZnMucmVhZEZpbGVTeW5jKGNvbmZpZ0ZpbGUsIGB1dGYtOGApO1xyXG4gICAgICAgICAgICB9IGNhdGNoIChleGNlcHRpb24pIHtcclxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgQ291bGRuJ3QgcmVhZCAke2NvbmZpZ0ZpbGV9LiBBcmUgeW91IHN1cmUgdGhpcyBwYXRoIGlzIGNvcnJlY3Q/YCk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGNvbnN0IGNvbmZpZyA9IHRvbWwucGFyc2UocmF3KTtcclxuXHJcbiAgICAgICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgICAgICBjb25maWcsXHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgfSxcclxuXHJcbiAgICAgICAgc2V0X25hbWVzOiAoe1xyXG4gICAgICAgICAgICBjb25maWdGaWxlLFxyXG4gICAgICAgICAgICBjb25maWdcclxuICAgICAgICB9KSA9PiB7XHJcbiAgICAgICAgICAgIGNvbnN0IG5hbWUgPSBwYXRoLmJhc2VuYW1lKGNvbmZpZ0ZpbGUsIGAudG9tbGApO1xyXG5cclxuICAgICAgICAgICAgY29uc3QgcGFja2FnZV9wYXRoID0gcGF0aC5kaXJuYW1lKHBhdGgucmVzb2x2ZShjb25maWdGaWxlKSk7XHJcbiAgICAgICAgICAgIGNvbnN0IHBhY2thZ2VfbmFtZSA9IHBhY2thZ2VfcGF0aC5cclxuICAgICAgICAgICAgICAgIHNwbGl0KHBhdGguc2VwKS5cclxuICAgICAgICAgICAgICAgIHBvcCgpO1xyXG5cclxuICAgICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgICAgIHBhY2thZ2VfcGF0aCxcclxuICAgICAgICAgICAgICAgIHBhY2thZ2VfbmFtZSxcclxuICAgICAgICAgICAgICAgIG5hbWUsXHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgfSxcclxuXHJcbiAgICAgICAgd3JpdGVfZW50cnk6ICh7XHJcbiAgICAgICAgICAgIGNvbmZpZyxcclxuICAgICAgICAgICAgbmFtZSxcclxuICAgICAgICAgICAgU0tJTExTLFxyXG4gICAgICAgIH0pID0+IHtcclxuICAgICAgICAvLyBXUklURSBPVVQgRklMRVxyXG4gICAgICAgICAgICBsZXQgZW50cnkgPSBgYDtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGNvbnN0IHdyaXRlID0gKGRhdGEpID0+IFxyXG4gICAgICAgICAgICAgICAgZW50cnkgKz0gYCR7ZGF0YX1cXHJcXG5gO1xyXG4gICAgICAgIFxyXG4gICAgICAgICAgICB3cml0ZShgaW1wb3J0IGlzZWthaSBmcm9tIFwiaXNla2FpXCI7YCk7XHJcbiAgICAgICAgICAgIHdyaXRlKGBpc2VrYWkuU0VUKCR7SlNPTi5zdHJpbmdpZnkoY29uZmlnKX0pO2ApO1xyXG4gICAgICAgICAgICB3cml0ZShgYCk7XHJcbiAgICBcclxuICAgICAgICAgICAgY29uc3QgZXF1aXBlZCA9IE9iamVjdC5rZXlzKGNvbmZpZykuXHJcbiAgICAgICAgICAgICAgICBmaWx0ZXIoKGtleSkgPT4gXHJcbiAgICAgICAgICAgICAgICAgICAga2V5ID09PSBrZXkudG9VcHBlckNhc2UoKSAmJiBTS0lMTFNba2V5XSkuXHJcbiAgICAgICAgICAgICAgICBtYXAoKGtleSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIHdyaXRlKGBpbXBvcnQgJHtrZXl9IGZyb20gXCIuLi9TS0lMTFMvJHtrZXl9L2luZGV4LmpzXCI7YCk7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBrZXk7XHJcbiAgICAgICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgIGNvbnN0IGtleXMgPSBlcXVpcGVkLnJlZHVjZSgob3V0cHV0LCBrZXkpID0+IFxyXG4gICAgICAgICAgICAgICAgYCR7b3V0cHV0fSAgICAke2tleX0sXFxyXFxuYCwgYGApO1xyXG5cclxuICAgICAgICAgICAgd3JpdGUoYFxyXG5pc2VrYWkuRVFVSVAoe1xcclxcbiR7a2V5c319KTtgKTtcclxuXHJcbiAgICAgICAgICAgIGNvbnN0IGlucHV0ID0gcGF0aC5qb2luKGAuTUFHSUNgLCBgJHtuYW1lfS5lbnRyeS5qc2ApO1xyXG5cclxuICAgICAgICAgICAgLy8gd3JpdGUgb3V0IHRoZWlyIGluZGV4LmpzXHJcbiAgICAgICAgICAgIGZzLndyaXRlRmlsZVN5bmMoaW5wdXQsIGVudHJ5LCBgdXRmLThgKTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGBcclxuWyR7bmFtZX1dWyR7Y29uZmlnLk5PREUgPyBgTk9ERWAgOiBgQlJPV1NFUmB9XVxyXG5cclxuW1NLSUxMU106XHJcbiR7Yy5yZWQoZXF1aXBlZC5qb2luKGAgLSBgKSl9XHJcbmApO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgICAgIGlucHV0XHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgfSxcclxuXHJcbiAgICAgICAgcnVuX2J1aWxkZXJzOiAoe1xyXG4gICAgICAgICAgICBpbnB1dCxcclxuICAgICAgICAgICAgbmFtZSxcclxuICAgICAgICAgICAgY29uZmlnLFxyXG4gICAgICAgIH0pID0+IHtcclxuICAgICAgICAgICAgY29uc3QgdGFyZ2V0ID0gY29uZmlnLk5PREUgXHJcbiAgICAgICAgICAgICAgICA/IGBOT0RFYCBcclxuICAgICAgICAgICAgICAgIDogYEJST1dTRVJgO1xyXG5cclxuICAgICAgICAgICAgY29uc3Qgb3V0cHV0ID0gYC5NQUdJQy8ke25hbWV9LiR7dGFyZ2V0fS5qc2A7XHJcblxyXG4gICAgICAgICAgICBpZihjb25maWcuTk9ERSAmJiBjb25maWcuQlJPV1NFUikge1xyXG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBZb3UgY2Fubm90IHRhcmdldCBib3RoIFtOT0RFXSBhbmQgW0JST1dTRVJdYCk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGlmKGNvbmZpZy5OT0RFKSB7ICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICAgICAgICAgIG91dHB1dCxcclxuICAgICAgICAgICAgICAgICAgICBidWlsZF9pbmZvOiBidWlsZGVycy5ub2RlKHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaW5wdXQsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG91dHB1dFxyXG4gICAgICAgICAgICAgICAgICAgIH0pXHJcbiAgICAgICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgICAgIGlmKGNvbmZpZy5CUk9XU0VSKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICAgICAgICAgIG91dHB1dCxcclxuICAgICAgICAgICAgICAgICAgICBidWlsZF9pbmZvOiBidWlsZGVycy5icm93c2VyKHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaW5wdXQsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG91dHB1dFxyXG4gICAgICAgICAgICAgICAgICAgIH0pXHJcbiAgICAgICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFlvdSBtdXN0IHNwZWNpZnkgZWl0aGVyIFtOT0RFXSBvciBbQlJPV1NFUl0gZm9yIHlvdXIgdGFyZ2V0YCk7XHJcbiAgICAgICAgfVxyXG4gICAgfSkuXHJcbiAgICAgICAgcmVkdWNlKChzdGF0ZSwgZm4pID0+IFxyXG4gICAgICAgICAgICAoe1xyXG4gICAgICAgICAgICAgICAgLi4uc3RhdGUsXHJcbiAgICAgICAgICAgICAgICAuLi5mbihzdGF0ZSlcclxuICAgICAgICAgICAgfSksIHsgY29uZmlnRmlsZSB9KTtcclxuIiwiaW1wb3J0IGdsb2IgZnJvbSBcImdsb2JcIjtcclxuaW1wb3J0IHBhdGggZnJvbSBcInBhdGhcIjtcclxuXHJcbmV4cG9ydCBkZWZhdWx0ICgpID0+IFxyXG4gICAgZ2xvYi5zeW5jKGAuL0NIQVJBQ1RFUlMvKi50b21sYCkuXHJcbiAgICAgICAgbWFwKChjbGFzc19wYXRoKSA9PiBcclxuICAgICAgICAgICAgcGF0aC5iYXNlbmFtZShjbGFzc19wYXRoLCBgLnRvbWxgKSk7IiwiaW1wb3J0IGdldF9saXN0IGZyb20gXCIuL2dldF9saXN0LmpzXCI7XHJcblxyXG5leHBvcnQgZGVmYXVsdCAoY2xhc3NlcykgPT4gXHJcbiAgICAoZm4pID0+IFxyXG4gICAgICAgIFByb21pc2UuYWxsKGNsYXNzZXMuZmlsdGVyKCh0YXJnZXQpID0+IHtcclxuICAgICAgICAgICAgY29uc3QgaXNfb2theSA9IGdldF9saXN0KCkuXHJcbiAgICAgICAgICAgICAgICBpbmRleE9mKHRhcmdldCkgIT09IC0xO1xyXG5cclxuICAgICAgICAgICAgaWYoIWlzX29rYXkpIHtcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGAke3RhcmdldH0gaXMgbm90IGFuIGF2YWlsYWJsZSBbQ0hBUkFDVEVSXWApO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgICAgIHJldHVybiBpc19va2F5O1xyXG4gICAgICAgIH0pLlxyXG4gICAgICAgICAgICBtYXAoZm4pKTtcclxuIiwiaW1wb3J0IHRvbWxfdG9fanMgZnJvbSBcIi4uL3RyYW5zZm9ybXMvdG9tbF90b19qcy5qc1wiO1xyXG5pbXBvcnQgcm9sbHVwIGZyb20gXCJyb2xsdXBcIjtcclxuXHJcbmltcG9ydCBnZXRfbGlzdCBmcm9tIFwiLi4vbGliL2dldF9saXN0LmpzXCI7XHJcbmltcG9ydCBmaWx0ZXJfbGlzdCBmcm9tIFwiLi4vbGliL2ZpbHRlcl9saXN0LmpzXCI7XHJcblxyXG5leHBvcnQgZGVmYXVsdCAoe1xyXG4gICAgY29tbWFuZDogYGJ1aWxkIFtDSEFSQUNURVJTLi4uXWAsXHJcbiAgICBoZWxwOiBgYnVpbGQgYWxsIFtDSEFSQUNURVJTXSBmaWxlcy5gLFxyXG4gICAgYXV0b2NvbXBsZXRlOiBnZXRfbGlzdCgpLFxyXG4gICAgaGlkZGVuOiB0cnVlLFxyXG4gICAgaGFuZGxlcjogKHsgQ0hBUkFDVEVSUyA9IGdldF9saXN0KCkgfSkgPT4gXHJcbiAgICAgICAgZmlsdGVyX2xpc3QoQ0hBUkFDVEVSUykoYXN5bmMgKHRhcmdldCkgPT4ge1xyXG4gICAgICAgICAgICBjb25zdCB7IGJ1aWxkX2luZm8sIG5hbWUgfSA9IGF3YWl0IHRvbWxfdG9fanMoYC4vQ0hBUkFDVEVSUy8ke3RhcmdldH0udG9tbGApO1xyXG4gICAgICAgICAgICBjb25zdCBidW5kbGUgPSBhd2FpdCByb2xsdXAucm9sbHVwKGJ1aWxkX2luZm8pO1xyXG5cclxuICAgICAgICAgICAgLypcclxuICAgICAgICAgICAgICogY29uc29sZS5sb2coYEdlbmVyYXRpbmcgb3V0cHV0Li4uYCk7XHJcbiAgICAgICAgICAgICAqIGNvbnN0IHsgb3V0cHV0IH0gPSBhd2FpdCBidW5kbGUuZ2VuZXJhdGUoYnVpbGRfaW5mby5vdXRwdXQpO1xyXG4gICAgICAgICAgICAgKi9cclxuXHJcbiAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKG91dHB1dCk7XHJcbiAgICAgICAgICAgIGF3YWl0IGJ1bmRsZS53cml0ZShidWlsZF9pbmZvLm91dHB1dCk7XHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbJHtuYW1lfV0gQnVpbGQgQ29tcGxldGUuXFxyXFxuYCk7XHJcbiAgICAgICAgfSkuXHJcbiAgICAgICAgICAgIHRoZW4oKHByb21pc2VzKSA9PiB7XHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgQnVpbHQgJHtwcm9taXNlcy5sZW5ndGh9IFtDSEFSQUNURVJdIGZpbGUocykuYCk7XHJcbiAgICAgICAgICAgIH0pXHJcbn0pOyIsIi8vIHBpcGUgb3V0IHRvIHBtMlxyXG5pbXBvcnQgeyBzcGF3biB9IGZyb20gXCJjaGlsZF9wcm9jZXNzXCI7XHJcblxyXG5leHBvcnQgZGVmYXVsdCAoe1xyXG4gICAgY29tbWFuZDogYHBtMiBbY29tbWFuZHMuLi5dYCxcclxuXHJcbiAgICBoZWxwOiBgZXhlY3V0ZSBhIHBtMiBjb21tYW5kYCxcclxuICAgIGhpZGRlbjogdHJ1ZSxcclxuXHJcbiAgICBjYW5jZWwoKSB7XHJcbiAgICAgICAgaWYoIXRoaXMubm9kZSkge1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB0aGlzLm5vZGUua2lsbCgpO1xyXG4gICAgfSxcclxuXHJcbiAgICBoYW5kbGVyKHsgY29tbWFuZHMgfSwgY2IpIHtcclxuICAgICAgICBpZighY29tbWFuZHMpIHtcclxuICAgICAgICAgICAgY29uc29sZS5sb2coYFlvdSBtdXN0IHByb3ZpZGUgY29tbWFuZHMgZm9yIHBtMlxcclxcbmApO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgcmV0dXJuIGNiKCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xyXG4gICAgICAgICAgICB0aGlzLm5vZGUgPSBzcGF3bihgbm9kZWAsIGAke19fZGlybmFtZX0vLi4vbm9kZV9tb2R1bGVzL3BtMi9iaW4vcG0yICR7Y29tbWFuZHMuam9pbihgIGApfWAuc3BsaXQoYCBgKSwge1xyXG4gICAgICAgICAgICAgICAgZW52OiBwcm9jZXNzLmVudixcclxuICAgICAgICAgICAgICAgIHN0ZGlvOiBgaW5oZXJpdGBcclxuICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICB0aGlzLm5vZGUub24oYGNsb3NlYCwgKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgcmVzb2x2ZSgpO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9KTtcclxuICAgIH1cclxufSk7IiwiaW1wb3J0IHBtMiBmcm9tIFwiLi9wbTIuanNcIjtcclxuXHJcbmV4cG9ydCBkZWZhdWx0ICh7XHJcbiAgICBjb21tYW5kOiBgbG9ncyBbQ0hBUkFDVEVSUy4uLl1gLFxyXG4gICAgaGVscDogYGZvbGxvdyB0aGUgbG9nc2AsXHJcbiAgICBoYW5kbGVyOiAoeyBDSEFSQUNURVJTID0gW10gfSkgPT4gXHJcbiAgICAgICAgbmV3IFByb21pc2UoKCkgPT4gXHJcbiAgICAgICAgICAgIHBtMi5oYW5kbGVyKHtcclxuICAgICAgICAgICAgICAgIGNvbW1hbmRzOiBbIGBsb2dzYCwgLi4uQ0hBUkFDVEVSUyBdXHJcbiAgICAgICAgICAgIH0pKVxyXG59KTsiLCJpbXBvcnQgZ2V0X2xpc3QgZnJvbSBcIi4uL2xpYi9nZXRfbGlzdC5qc1wiO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgKHtcclxuICAgIGhlbHA6IGBTaG93IGF2YWlsYWJsZSBbQ0hBUkFDVEVSXSBmaWxlcy5gLFxyXG4gICAgYWxpYXM6IFsgYGxzYCBdLFxyXG4gICAgaGFuZGxlcjogKGFyZ3MsIGNiKSA9PiB7XHJcbiAgICAgICAgY29uc29sZS5sb2coZ2V0X2xpc3QoKS5cclxuICAgICAgICAgICAgbWFwKChpKSA9PiBcclxuICAgICAgICAgICAgICAgIGBbJHtpfV1gKS5cclxuICAgICAgICAgICAgam9pbihgIC0gYCksIGBcXHJcXG5gKTsgICAgXHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgIGNiKCk7XHJcbiAgICB9XHJcbn0pOyIsImltcG9ydCBwbTIgZnJvbSBcInBtMlwiO1xyXG5cclxuaW1wb3J0IHRvbWxfdG9fanMgZnJvbSBcIi4uL3RyYW5zZm9ybXMvdG9tbF90b19qcy5qc1wiO1xyXG5pbXBvcnQgZ2V0X2xpc3QgZnJvbSBcIi4uL2xpYi9nZXRfbGlzdC5qc1wiO1xyXG5pbXBvcnQgZmlsdGVyX2xpc3QgZnJvbSBcIi4uL2xpYi9maWx0ZXJfbGlzdC5qc1wiO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgKHtcclxuICAgIGNvbW1hbmRlcjogYHNwYXduIFtDSEFSQUNURVJTLi4uXWAsXHJcbiAgICBoZWxwOiBgc3Bhd24gW0NIQVJBQ1RFUlNdIGZpbGVzYCxcclxuICAgIGhpZGRlbjogdHJ1ZSxcclxuICAgIGhhbmRsZXI6ICh7XHJcbiAgICAgICAgQ0hBUkFDVEVSUyA9IGdldF9saXN0KClcclxuICAgIH0pID0+IHtcclxuICAgICAgICBmaWx0ZXJfbGlzdChDSEFSQUNURVJTKSgobmFtZSkgPT4ge1xyXG4gICAgICAgICAgICBjb25zdCB7XHJcbiAgICAgICAgICAgICAgICBvdXRwdXQsXHJcbiAgICAgICAgICAgIH0gPSB0b21sX3RvX2pzKGAuL0NIQVJBQ1RFUlMvJHtuYW1lfS50b21sYCk7XHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGB3YXRjaGluZ2AsIG91dHB1dCk7XHJcblxyXG4gICAgICAgICAgICBwbTIuc3RhcnQoe1xyXG4gICAgICAgICAgICAgICAgbmFtZSxcclxuICAgICAgICAgICAgICAgIHNjcmlwdDogb3V0cHV0LFxyXG4gICAgICAgICAgICAgICAgd2F0Y2g6IHRydWUsXHJcbiAgICAgICAgICAgICAgICB3YXRjaF9vcHRpb25zOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgdXNlUG9sbGluZzogdHJ1ZVxyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIG1heF9yZXN0YXJ0OiA1IFxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9KTtcclxuXHJcbiAgICB9XHJcbn0pO1xyXG4iLCJleHBvcnQgZGVmYXVsdCAoXHJcbiAgICBhY3Rpb25fbWFwLCBcclxuICAgIHJlZHVjZXIgPSAoaSkgPT4gXHJcbiAgICAgICAgaVxyXG4pID0+IFxyXG4gICAgKGlucHV0KSA9PiB7XHJcbiAgICAgICAgY29uc3Qga2V5ID0gcmVkdWNlcihpbnB1dCk7XHJcblxyXG4gICAgICAgIGlmKCFhY3Rpb25fbWFwW2tleV0pIHtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmV0dXJuIGFjdGlvbl9tYXBba2V5XShpbnB1dCk7XHJcbiAgICB9OyIsImltcG9ydCBjaG9raWRhciBmcm9tIFwiY2hva2lkYXJcIjtcclxuaW1wb3J0IHJvbGx1cCBmcm9tIFwicm9sbHVwXCI7XHJcbmltcG9ydCBjIGZyb20gXCJjaGFsa1wiO1xyXG5cclxuaW1wb3J0IHRvbWxfdG9fanMgZnJvbSBcIi4uL3RyYW5zZm9ybXMvdG9tbF90b19qcy5qc1wiO1xyXG5cclxuaW1wb3J0IGFjdGlvbiBmcm9tIFwiLi4vbGliL2FjdGlvbi5qc1wiO1xyXG5pbXBvcnQgZmlsdGVyX2xpc3QgZnJvbSBcIi4uL2xpYi9maWx0ZXJfbGlzdC5qc1wiO1xyXG5pbXBvcnQgZ2V0X2xpc3QgZnJvbSBcIi4uL2xpYi9nZXRfbGlzdC5qc1wiO1xyXG5cclxuY29uc3Qgd2F0Y2hfcHJvbXB0ID0gKCkgPT4gXHJcbiAgICBjb25zb2xlLmxvZyhgW0JVSUxUXSBQUkVTUyBbQ1RSTCtDXSBUTyBRVUlUIFlPVVIgV0FUQ0hgKTtcclxuXHJcbmV4cG9ydCBkZWZhdWx0ICh7XHJcbiAgICBjb21tYW5kOiBgd2F0Y2ggW0NIQVJBQ1RFUlMuLi5dYCxcclxuICAgIGhlbHA6IGB3YXRjaCBbQ0hBUkFDVEVSXSBmaWxlcyBmb3IgY2hhbmdlcyBhbmQgcmVidWlsZC5gLFxyXG4gICAgaGlkZGVuOiB0cnVlLFxyXG4gICAgY2FuY2VsICgpIHtcclxuICAgICAgICB0aGlzLndhdGNoZXJzLmZvckVhY2goKHdhdGNoZXIpID0+IFxyXG4gICAgICAgICAgICB3YXRjaGVyLmNsb3NlKCkpO1xyXG4gICAgICAgIGNvbnNvbGUubG9nKGBZT1VSIFdBVENIIEhBUyBFTkRFRGApO1xyXG4gICAgfSxcclxuICAgIGhhbmRsZXIoeyBDSEFSQUNURVJTID0gZ2V0X2xpc3QoKSB9LCBjYikge1xyXG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xyXG4gICAgICAgICAgICB0aGlzLndhdGNoZXJzID0gW107XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBmaWx0ZXJfbGlzdChDSEFSQUNURVJTKSgodGFyZ2V0KSA9PiB7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBmaWxlX3BhdGggPSBgLi9DSEFSQUNURVJTLyR7dGFyZ2V0fS50b21sYDtcclxuXHJcbiAgICAgICAgICAgICAgICBjb25zdCBkYXRhID0gdG9tbF90b19qcyhmaWxlX3BhdGgpO1xyXG5cclxuICAgICAgICAgICAgICAgIGNvbnN0IHsgYnVpbGRfaW5mbyB9ID0gZGF0YTtcclxuICAgICAgICBcclxuICAgICAgICAgICAgICAgIC8vIHJlYnVpbGQgb24gZmlsZSBjaGFnbmVcclxuICAgICAgICAgICAgICAgIGNvbnN0IHdhdGNoZXIgPSBjaG9raWRhci53YXRjaChmaWxlX3BhdGgpO1xyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICB3YXRjaGVyLm9uKGBjaGFuZ2VgLCAoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgdG9tbF90b19qcyhmaWxlX3BhdGgpO1xyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIHRoaXMud2F0Y2hlcnMucHVzaCh3YXRjaGVyKTtcclxuXHJcbiAgICAgICAgICAgICAgICBjb25zdCByb2xsdXBfd2F0Y2hlciA9IHJvbGx1cC53YXRjaCh7XHJcbiAgICAgICAgICAgICAgICAgICAgLi4uYnVpbGRfaW5mbyxcclxuICAgICAgICAgICAgICAgICAgICB3YXRjaDoge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjbGVhclNjcmVlbjogdHJ1ZVxyXG4gICAgICAgICAgICAgICAgICAgIH0gICBcclxuICAgICAgICAgICAgICAgIH0pLlxyXG4gICAgICAgICAgICAgICAgICAgIG9uKGBldmVudGAsIGFjdGlvbih7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIEJVTkRMRV9FTkQ6ICgpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHdhdGNoX3Byb21wdCgpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBGQVRBTDogKHsgZXJyb3IgfSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihjLnJlZC5ib2xkKGVycm9yKSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICB9LCAoeyBjb2RlIH0pID0+IFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb2RlIFxyXG4gICAgICAgICAgICAgICAgICAgICkpO1xyXG5cclxuICAgICAgICAgICAgICAgIHRoaXMud2F0Y2hlcnMucHVzaChyb2xsdXBfd2F0Y2hlcik7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG59KTtcclxuIiwiaW1wb3J0IHBtMiBmcm9tIFwiLi9wbTIuanNcIjtcclxuXHJcbmV4cG9ydCBkZWZhdWx0ICh7XHJcbiAgICBjb21tYW5kOiBgc3RvcCBbQ0hBUkFDVEVSUy4uLl1gLFxyXG4gICAgaGVscDogYHN0b3AgYWN0aXZlIENIQVJBQ1RFUlNdIGZpbGVzLiBgLCBcclxuXHJcbiAgICBoYW5kbGVyOiAoeyBDSEFSQUNURVJTID0gWyBgYWxsYCBdIH0pID0+IFxyXG4gICAgICAgIHBtMi5oYW5kbGVyKHtcclxuICAgICAgICAgICAgY29tbWFuZHM6IFsgYGRlbGV0ZWAsIC4uLkNIQVJBQ1RFUlMgXVxyXG4gICAgICAgIH0pXHJcbn0pO1xyXG5cclxuIiwiaW1wb3J0IHdhdGNoIGZyb20gXCIuL3dhdGNoLmpzXCI7XHJcbmltcG9ydCBzcGF3biBmcm9tIFwiLi9zcGF3bi5qc1wiO1xyXG5pbXBvcnQgZXhlYyBmcm9tIFwiLi9wbTIuanNcIjtcclxuaW1wb3J0IHN0b3AgZnJvbSBcIi4vc3RvcC5qc1wiO1xyXG5pbXBvcnQgZ2V0X2xpc3QgZnJvbSBcIi4uL2xpYi9nZXRfbGlzdC5qc1wiO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgKHtcclxuICAgIGNvbW1hbmQ6IGBzdGFydCBbQ0hBUkFDVEVSUy4uLl1gLFxyXG4gICAgaGVscDogYHN0YXJ0IGFuZCB3YXRjaCBbQ0hBUkFDVEVSU10gZmlsZXNgLCBcclxuICAgIGhhbmRsZXIoZGF0YSkgeyBcclxuICAgICAgICB0aGlzLmRhdGEgPSBkYXRhLkNIQVJBQ1RFUlMgXHJcbiAgICAgICAgICAgID8gZGF0YVxyXG4gICAgICAgICAgICA6IHsgQ0hBUkFDVEVSUzogZ2V0X2xpc3QoKSB9O1xyXG5cclxuICAgICAgICB3YXRjaC5oYW5kbGVyKHRoaXMuZGF0YSk7XHJcbiAgICAgICAgc3Bhd24uaGFuZGxlcih0aGlzLmRhdGEpO1xyXG5cclxuICAgICAgICBleGVjLmhhbmRsZXIoe1xyXG4gICAgICAgICAgICBjb21tYW5kczogWyBgbG9nc2AgXVxyXG4gICAgICAgIH0pO1xyXG4gICAgfSxcclxuICAgIGNhbmNlbCgpIHtcclxuICAgICAgICB3YXRjaC5jYW5jZWwoKTtcclxuICAgICAgICBjb25zb2xlLmxvZyhgU1RPUFBJTkcgJHt0aGlzLmRhdGEuQ0hBUkFDVEVSUy5tYXAoKGkpID0+IFxyXG4gICAgICAgICAgICBgWyR7aX1dYCkuXHJcbiAgICAgICAgICAgIGpvaW4oYCAtIGApfWApO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHJldHVybiBzdG9wLmhhbmRsZXIodGhpcy5kYXRhKTtcclxuICAgIH1cclxufSk7XHJcblxyXG4iLCJpbXBvcnQgcG0yIGZyb20gXCIuL3BtMi5qc1wiO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQoe1xyXG4gICAgY29tbWFuZDogYHN0YXR1c2AsXHJcbiAgICBoZWxwOiBgW1NUQVRVU10gb2YgYWN0aXZlIFtDSEFSQUNURVJTXSBmaWxlcy5gLFxyXG4gICAgYWxpYXM6IFsgYHBzYCwgYGFjdGl2ZWAgXSxcclxuICAgIGhhbmRsZXI6ICgpID0+IFxyXG4gICAgICAgIHBtMi5oYW5kbGVyKHtcclxuICAgICAgICAgICAgY29tbWFuZHM6IFsgYHBzYCBdXHJcbiAgICAgICAgfSlcclxufSk7IiwiY29uc3QgcmVzID0ge307XG5pbXBvcnQgZjAgZnJvbSBcIi9Vc2Vycy9HYW1lcy9Qcm9qZWN0cy9JU0VLQUkvc3JjL2NvbW1hbmRzL2J1aWxkLmpzXCI7XG5yZXNbXCJidWlsZFwiXSA9IGYwO1xuaW1wb3J0IGYxIGZyb20gXCIvVXNlcnMvR2FtZXMvUHJvamVjdHMvSVNFS0FJL3NyYy9jb21tYW5kcy9sb2dzLmpzXCI7XG5yZXNbXCJsb2dzXCJdID0gZjE7XG5pbXBvcnQgZjIgZnJvbSBcIi9Vc2Vycy9HYW1lcy9Qcm9qZWN0cy9JU0VLQUkvc3JjL2NvbW1hbmRzL3BtMi5qc1wiO1xucmVzW1wicG0yXCJdID0gZjI7XG5pbXBvcnQgZjMgZnJvbSBcIi9Vc2Vycy9HYW1lcy9Qcm9qZWN0cy9JU0VLQUkvc3JjL2NvbW1hbmRzL3Nob3AuanNcIjtcbnJlc1tcInNob3BcIl0gPSBmMztcbmltcG9ydCBmNCBmcm9tIFwiL1VzZXJzL0dhbWVzL1Byb2plY3RzL0lTRUtBSS9zcmMvY29tbWFuZHMvc3Bhd24uanNcIjtcbnJlc1tcInNwYXduXCJdID0gZjQ7XG5pbXBvcnQgZjUgZnJvbSBcIi9Vc2Vycy9HYW1lcy9Qcm9qZWN0cy9JU0VLQUkvc3JjL2NvbW1hbmRzL3N0YXJ0LmpzXCI7XG5yZXNbXCJzdGFydFwiXSA9IGY1O1xuaW1wb3J0IGY2IGZyb20gXCIvVXNlcnMvR2FtZXMvUHJvamVjdHMvSVNFS0FJL3NyYy9jb21tYW5kcy9zdGF0dXMuanNcIjtcbnJlc1tcInN0YXR1c1wiXSA9IGY2O1xuaW1wb3J0IGY3IGZyb20gXCIvVXNlcnMvR2FtZXMvUHJvamVjdHMvSVNFS0FJL3NyYy9jb21tYW5kcy9zdG9wLmpzXCI7XG5yZXNbXCJzdG9wXCJdID0gZjc7XG5pbXBvcnQgZjggZnJvbSBcIi9Vc2Vycy9HYW1lcy9Qcm9qZWN0cy9JU0VLQUkvc3JjL2NvbW1hbmRzL3dhdGNoLmpzXCI7XG5yZXNbXCJ3YXRjaFwiXSA9IGY4O1xuZXhwb3J0IGRlZmF1bHQgcmVzOyIsImltcG9ydCBjIGZyb20gXCJjaGFsa1wiO1xyXG5cclxuY29uc3QgeyBsb2cgfSA9IGNvbnNvbGU7XHJcblxyXG5jb25zb2xlLmxvZyA9ICguLi5hcmdzKSA9PiBcclxuICAgIGxvZyhcclxuICAgICAgICAuLi5hcmdzLm1hcChcclxuICAgICAgICAgICAgKGl0ZW0pID0+IFxyXG4gICAgICAgICAgICAgICAgdHlwZW9mIGl0ZW0gPT09IGBzdHJpbmdgXHJcbiAgICAgICAgICAgICAgICAgICAgPyBjLmdyZWVuKFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBpdGVtLnJlcGxhY2UoLyhcXFsuW15cXF1cXFtdKlxcXSkvdWcsIGMuYm9sZC53aGl0ZShgJDFgKSlcclxuICAgICAgICAgICAgICAgICAgICApXHJcbiAgICAgICAgICAgICAgICAgICAgOiBpdGVtXHJcbiAgICAgICAgKVxyXG4gICAgKTtcclxuIiwiIyEvdXNyL2Jpbi9lbnYgbm9kZVxyXG5cclxuaW1wb3J0IHZvcnBhbCBmcm9tIFwidm9ycGFsXCI7XHJcbmltcG9ydCBjb21tYW5kcyBmcm9tIFwiLi9jb21tYW5kcy8qLmpzXCI7XHJcbmltcG9ydCB7IHZlcnNpb24gfSBmcm9tIFwiLi4vcGFja2FnZS5qc29uXCI7XHJcblxyXG5pbXBvcnQgXCIuL2xpYi9mb3JtYXQuanNcIjtcclxuXHJcbmltcG9ydCBjaGFsayBmcm9tIFwiY2hhbGtcIjtcclxuXHJcbmNvbnN0IHYgPSB2b3JwYWwoKTtcclxucHJvY2Vzcy5zdGRvdXQud3JpdGUoYFxceDFCY2ApO1xyXG5cclxuY29uc29sZS5sb2coY2hhbGsuZ3JlZW4oYFxyXG7ilojilojilZfilojilojilojilojilojilojilojilZfilojilojilojilojilojilojilojilZfilojilojilZcgIOKWiOKWiOKVlyDilojilojilojilojilojilZcg4paI4paI4pWXICAgICAg4paI4paI4paI4paI4paI4paI4paI4pWX4paI4paI4paI4pWXICAg4paI4paI4pWXIOKWiOKWiOKWiOKWiOKWiOKWiOKVlyDilojilojilZfilojilojilojilZcgICDilojilojilZfilojilojilojilojilojilojilojilZcgICAgXHJcbuKWiOKWiOKVkeKWiOKWiOKVlOKVkOKVkOKVkOKVkOKVneKWiOKWiOKVlOKVkOKVkOKVkOKVkOKVneKWiOKWiOKVkSDilojilojilZTilZ3ilojilojilZTilZDilZDilojilojilZfilojilojilZHiloQg4paI4paI4pWX4paE4paI4paI4pWU4pWQ4pWQ4pWQ4pWQ4pWd4paI4paI4paI4paI4pWXICDilojilojilZHilojilojilZTilZDilZDilZDilZDilZ0g4paI4paI4pWR4paI4paI4paI4paI4pWXICDilojilojilZHilojilojilZTilZDilZDilZDilZDilZ0gICAgXHJcbuKWiOKWiOKVkeKWiOKWiOKWiOKWiOKWiOKWiOKWiOKVl+KWiOKWiOKWiOKWiOKWiOKVlyAg4paI4paI4paI4paI4paI4pWU4pWdIOKWiOKWiOKWiOKWiOKWiOKWiOKWiOKVkeKWiOKWiOKVkSDilojilojilojilojilZfilojilojilojilojilojilZcgIOKWiOKWiOKVlOKWiOKWiOKVlyDilojilojilZHilojilojilZEgIOKWiOKWiOKWiOKVl+KWiOKWiOKVkeKWiOKWiOKVlOKWiOKWiOKVlyDilojilojilZHilojilojilojilojilojilZcgICAgICBcclxu4paI4paI4pWR4pWa4pWQ4pWQ4pWQ4pWQ4paI4paI4pWR4paI4paI4pWU4pWQ4pWQ4pWdICDilojilojilZTilZDilojilojilZcg4paI4paI4pWU4pWQ4pWQ4paI4paI4pWR4paI4paI4pWR4paA4pWa4paI4paI4pWU4paA4paI4paI4pWU4pWQ4pWQ4pWdICDilojilojilZHilZrilojilojilZfilojilojilZHilojilojilZEgICDilojilojilZHilojilojilZHilojilojilZHilZrilojilojilZfilojilojilZHilojilojilZTilZDilZDilZ0gICAgICBcclxu4paI4paI4pWR4paI4paI4paI4paI4paI4paI4paI4pWR4paI4paI4paI4paI4paI4paI4paI4pWX4paI4paI4pWRICDilojilojilZfilojilojilZEgIOKWiOKWiOKVkeKWiOKWiOKVkSAg4pWa4pWQ4pWdIOKWiOKWiOKWiOKWiOKWiOKWiOKWiOKVl+KWiOKWiOKVkSDilZrilojilojilojilojilZHilZrilojilojilojilojilojilojilZTilZ3ilojilojilZHilojilojilZEg4pWa4paI4paI4paI4paI4pWR4paI4paI4paI4paI4paI4paI4paI4pWXICAgIFxyXG7ilZrilZDilZ3ilZrilZDilZDilZDilZDilZDilZDilZ3ilZrilZDilZDilZDilZDilZDilZDilZ3ilZrilZDilZ0gIOKVmuKVkOKVneKVmuKVkOKVnSAg4pWa4pWQ4pWd4pWa4pWQ4pWdICAgICAg4pWa4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWd4pWa4pWQ4pWdICDilZrilZDilZDilZDilZ0g4pWa4pWQ4pWQ4pWQ4pWQ4pWQ4pWdIOKVmuKVkOKVneKVmuKVkOKVnSAg4pWa4pWQ4pWQ4pWQ4pWd4pWa4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWdICAgIFxyXG5WRVJTSU9OOiAke3ZlcnNpb259ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcclxuYCkpO1xyXG5cclxuXHJcbk9iamVjdC5lbnRyaWVzKGNvbW1hbmRzKS5cclxuICAgIGZvckVhY2goKFtcclxuICAgICAgICBuYW1lLCB7XHJcbiAgICAgICAgICAgIGhlbHAsXHJcbiAgICAgICAgICAgIGhhbmRsZXIsXHJcbiAgICAgICAgICAgIGF1dG9jb21wbGV0ZSxcclxuICAgICAgICAgICAgaGlkZGVuLFxyXG4gICAgICAgICAgICBjb21tYW5kLFxyXG4gICAgICAgICAgICBhbGlhcyA9IFtdLFxyXG4gICAgICAgICAgICBjYW5jZWwgPSAoKSA9PiB7fVxyXG4gICAgICAgIH1cclxuICAgIF0pID0+IHsgXHJcbiAgICAgICAgY29uc3QgaXN0ID0gdi5jb21tYW5kKGNvbW1hbmQgfHwgbmFtZSwgaGVscCkuXHJcbiAgICAgICAgICAgIGFsaWFzKGFsaWFzKS5cclxuICAgICAgICAgICAgYXV0b2NvbXBsZXRlKGF1dG9jb21wbGV0ZSB8fCBbXSkuXHJcbiAgICAgICAgICAgIGNhbmNlbChjYW5jZWwpLlxyXG4gICAgICAgICAgICBhY3Rpb24oaGFuZGxlcik7XHJcblxyXG4gICAgICAgIGlmKGhpZGRlbikge1xyXG4gICAgICAgICAgICBpc3QuaGlkZGVuKCk7XHJcbiAgICAgICAgfVxyXG4gICAgfSk7XHJcblxyXG5cclxuY29uc3Qgc3RhcnR1cF9jb21tYW5kcyA9IHByb2Nlc3MuYXJndi5zbGljZSgyKTtcclxuXHJcbi8vIFRPRE86IGlzZWthaSBjcmVhdGUgZm9vIGluc3RlYWQgb2YgaXNla2FpIFwiY3JlYXRlIGZvb1wiXHJcbnN0YXJ0dXBfY29tbWFuZHMucmVkdWNlKChwcmV2LCBjdXIpID0+IFxyXG4gICAgcHJldi50aGVuKCgpID0+IFxyXG4gICAgICAgIHYuZXhlYyhjdXIpKSwgUHJvbWlzZS5yZXNvbHZlKClcclxuKS5cclxuICAgIHRoZW4oKCkgPT4ge1xyXG4gICAgICAgIGlmKHN0YXJ0dXBfY29tbWFuZHMubGVuZ3RoID4gMCkge1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB2LmRlbGltaXRlcihjaGFsay5ib2xkLmdyZWVuKGA+YCkpLlxyXG4gICAgICAgICAgICBzaG93KCk7XHJcbiAgICB9KTtcclxuXHJcbiJdLCJuYW1lcyI6WyJjcmVhdGVGaWx0ZXIiLCJnbG9iIiwidG9tbCIsInRlcnNlciIsInNwYXduIiwicG0yIiwid2F0Y2giLCJleGVjIiwic3RvcCIsImNoYWxrIiwidmVyc2lvbiIsImNvbW1hbmRzIl0sIm1h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
