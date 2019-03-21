#!/usr/bin/env node
'use strict';

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var vorpal = _interopDefault(require('vorpal'));
var child_process = require('child_process');
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
var pm2 = _interopDefault(require('pm2'));
var chokidar = _interopDefault(require('chokidar'));

// pipe out to pm2

var f3 = ({
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

var f0 = ({
    command: `active`,
    help: `Show active [CLASS] files.`,
    alias: [ `ps` ],
    handler: () => 
        f3.handler({
            commands: [ `ps` ]
        })
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

const log_equip = (equip) => 
    c.yellow(equip);

var toml_to_js = (configFile) => 
    // Mix Config File in and run these in order
    Object.values({
        gather_equipment: () => 
            ({
                EQUIPMENT: glob$1.sync(`./SHOP/*/`).
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
            EQUIPMENT,
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
                    key === key.toUpperCase() && EQUIPMENT[key]).
                map((key) => {
                    write(`import ${key} from "../SHOP/${key}/index.js";`);

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
SHOP:
${Object.keys(EQUIPMENT).
        map(log_equip).
        join(` - `)}

EQUIPPED:
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
    glob$1.sync(`./CLASS/*.toml`).
        map((class_path) => 
            path.basename(class_path, `.toml`));

var filter_list = (classes) => 
    (fn) => 
        Promise.all(classes.filter((target) => {
            const is_okay = get_list().
                indexOf(target) !== -1;

            if(!is_okay) {
                console.log(`${target} is not an available [CLASS]`);
            }
        
            return is_okay;
        }).
            map(fn));

var f1 = ({
    command: `build [CLASS...]`,
    help: `build all [CLASS] files.`,
    autocomplete: get_list(),
    hidden: true,
    handler: ({ CLASS = get_list() }) => 
        filter_list(CLASS)(async (target) => {
            const { build_info, name } = await toml_to_js(`./CLASS/${target}.toml`);
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
                console.log(`Built ${promises.length} [CLASS] file(s).`);
            })
});

var f2 = ({
    command: `logs [CLASS...]`,
    help: `follow the logs`,
    handler: ({ CLASS = [] }) => 
        new Promise(() => 
            f3.handler({
                commands: [ `logs`, ...CLASS ]
            }))
});

var f4 = ({
    help: `Show available [CLASS] files from the [SHOP].`,
    alias: [ `ls` ],
    handler: (args, cb) => {
        console.log(get_list().
            map((i) => 
                `[${i}]`).
            join(` - `), `\r\n`);    
            
        cb();
    }
});

var f5 = ({
    commander: `spawn [CLASS...]`,
    help: `spawn [CLASS] files`,
    hidden: true,
    handler: ({
        CLASS = get_list()
    }) => {
        filter_list(CLASS)((name) => {
            const {
                output,
            } = toml_to_js(`./CLASS/${name}.toml`);
            console.log(`watching`, output);

            pm2.start({
                name,
                script: output,
                watch: [ `./${output}` ],
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
    command: `watch [CLASS...]`,
    help: `watch [CLASS] files for changes and rebuild.`,
    hidden: true,
    cancel () {
        this.watchers.forEach((watcher) => 
            watcher.close());
        console.log(`YOUR WATCH HAS ENDED`);
    },
    handler({ CLASS = get_list() }, cb) {
        return new Promise((resolve) => {
            this.watchers = [];
            
            filter_list(CLASS)((target) => {
                const file_path = `./CLASS/${target}.toml`;

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

var f6 = ({
    command: `start [CLASS...]`,
    help: `start and watch [CLASS] files`, 
    handler: (data) => { 
        f8.handler(data);
        f5.handler(data);
        f3.handler({
            commands: [ `logs` ]
        });
    },
    cancel: () => {
        f8.cancel();
    }
});

var f7 = ({
    command: `stop [CLASS...]`,
    help: `stop active CLASS] files. `, 

    handler: ({ CLASS = [ `all` ] }) => 
        f3.handler({
            commands: [ `delete`, ...CLASS ]
        })
});

const res = {};
res["active"] = f0;
res["build"] = f1;
res["logs"] = f2;
res["pm2"] = f3;
res["shop"] = f4;
res["spawn"] = f5;
res["start"] = f6;
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2xpLmpzIiwic291cmNlcyI6WyIuLi9zcmMvY29tbWFuZHMvcG0yLmpzIiwiLi4vc3JjL2NvbW1hbmRzL2FjdGl2ZS5qcyIsIi4uL3NyYy9yb2xsdXAvcGx1Z2luLWdsb2IuanMiLCIuLi9zcmMvcm9sbHVwL3ZlcnNpb24uanMiLCIuLi9zcmMvcm9sbHVwL2J1aWxkZXJzLmpzIiwiLi4vc3JjL3RyYW5zZm9ybXMvdG9tbF90b19qcy5qcyIsIi4uL3NyYy9saWIvZ2V0X2xpc3QuanMiLCIuLi9zcmMvbGliL2ZpbHRlcl9saXN0LmpzIiwiLi4vc3JjL2NvbW1hbmRzL2J1aWxkLmpzIiwiLi4vc3JjL2NvbW1hbmRzL2xvZ3MuanMiLCIuLi9zcmMvY29tbWFuZHMvc2hvcC5qcyIsIi4uL3NyYy9jb21tYW5kcy9zcGF3bi5qcyIsIi4uL3NyYy9saWIvYWN0aW9uLmpzIiwiLi4vc3JjL2NvbW1hbmRzL3dhdGNoLmpzIiwiLi4vc3JjL2NvbW1hbmRzL3N0YXJ0LmpzIiwiLi4vc3JjL2NvbW1hbmRzL3N0b3AuanMiLCIuLi80ZWU0OTVmYjE4MGUyYjRhNjVhN2MxNTI2MDk4YmIwZCIsIi4uL3NyYy9saWIvZm9ybWF0LmpzIiwiLi4vc3JjL2NsaS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyBwaXBlIG91dCB0byBwbTJcclxuaW1wb3J0IHsgc3Bhd24gfSBmcm9tIFwiY2hpbGRfcHJvY2Vzc1wiO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgKHtcclxuICAgIGNvbW1hbmQ6IGBwbTIgW2NvbW1hbmRzLi4uXWAsXHJcblxyXG4gICAgaGVscDogYGV4ZWN1dGUgYSBwbTIgY29tbWFuZGAsXHJcbiAgICBoaWRkZW46IHRydWUsXHJcblxyXG4gICAgY2FuY2VsKCkge1xyXG4gICAgICAgIGlmKCF0aGlzLm5vZGUpIHtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdGhpcy5ub2RlLmtpbGwoKTtcclxuICAgIH0sXHJcblxyXG4gICAgaGFuZGxlcih7IGNvbW1hbmRzIH0sIGNiKSB7XHJcbiAgICAgICAgaWYoIWNvbW1hbmRzKSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGBZb3UgbXVzdCBwcm92aWRlIGNvbW1hbmRzIGZvciBwbTJcXHJcXG5gKTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHJldHVybiBjYigpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHtcclxuICAgICAgICAgICAgdGhpcy5ub2RlID0gc3Bhd24oYG5vZGVgLCBgJHtfX2Rpcm5hbWV9Ly4uL25vZGVfbW9kdWxlcy9wbTIvYmluL3BtMiAke2NvbW1hbmRzLmpvaW4oYCBgKX1gLnNwbGl0KGAgYCksIHtcclxuICAgICAgICAgICAgICAgIGVudjogcHJvY2Vzcy5lbnYsXHJcbiAgICAgICAgICAgICAgICBzdGRpbzogYGluaGVyaXRgXHJcbiAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgdGhpcy5ub2RlLm9uKGBjbG9zZWAsICgpID0+IHtcclxuICAgICAgICAgICAgICAgIHJlc29sdmUoKTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcbn0pOyIsImltcG9ydCBwbTIgZnJvbSBcIi4vcG0yLmpzXCI7XHJcblxyXG5leHBvcnQgZGVmYXVsdCh7XHJcbiAgICBjb21tYW5kOiBgYWN0aXZlYCxcclxuICAgIGhlbHA6IGBTaG93IGFjdGl2ZSBbQ0xBU1NdIGZpbGVzLmAsXHJcbiAgICBhbGlhczogWyBgcHNgIF0sXHJcbiAgICBoYW5kbGVyOiAoKSA9PiBcclxuICAgICAgICBwbTIuaGFuZGxlcih7XHJcbiAgICAgICAgICAgIGNvbW1hbmRzOiBbIGBwc2AgXVxyXG4gICAgICAgIH0pXHJcbn0pOyIsIlxyXG5pbXBvcnQgZnMgZnJvbSBcImZzXCI7XHJcbmltcG9ydCBvcyBmcm9tIFwib3NcIjtcclxuaW1wb3J0IGdsb2IgZnJvbSBcImdsb2JcIjtcclxuaW1wb3J0IHBhdGggZnJvbSBcInBhdGhcIjtcclxuaW1wb3J0IG1kNSBmcm9tIFwibWQ1XCI7XHJcblxyXG5pbXBvcnQgeyBjcmVhdGVGaWx0ZXIgfSBmcm9tIFwicm9sbHVwLXBsdWdpbnV0aWxzXCI7XHJcblxyXG5jb25zdCBnZXRGU1ByZWZpeCA9IChwcmVmaXggPSBwcm9jZXNzLmN3ZCgpKSA9PiB7XHJcbiAgICBjb25zdCBwYXJlbnQgPSBwYXRoLmpvaW4ocHJlZml4LCBgLi5gKTtcclxuICAgIGlmIChwYXJlbnQgPT09IHByZWZpeCkge1xyXG4gICAgICAgIHJldHVybiBwcmVmaXg7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIHJldHVybiBnZXRGU1ByZWZpeChwYXJlbnQpO1xyXG59O1xyXG5cclxuY29uc3QgZnNQcmVmaXggPSBnZXRGU1ByZWZpeCgpO1xyXG5jb25zdCByb290UGF0aCA9IHBhdGguam9pbihgL2ApO1xyXG5cclxuY29uc3QgdG9VUkxTdHJpbmcgPSAoZmlsZVBhdGgpID0+IHtcclxuICAgIGNvbnN0IHBhdGhGcmFnbWVudHMgPSBwYXRoLmpvaW4oZmlsZVBhdGgpLlxyXG4gICAgICAgIHJlcGxhY2UoZnNQcmVmaXgsIHJvb3RQYXRoKS5cclxuICAgICAgICBzcGxpdChwYXRoLnNlcCk7XHJcbiAgICBpZiAoIXBhdGguaXNBYnNvbHV0ZShmaWxlUGF0aCkpIHtcclxuICAgICAgICBwYXRoRnJhZ21lbnRzLnVuc2hpZnQoYC5gKTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgcmV0dXJuIHBhdGhGcmFnbWVudHMuam9pbihgL2ApO1xyXG59O1xyXG5cclxuY29uc3QgcmVzb2x2ZU5hbWUgPSAoZnJvbSkgPT4gXHJcbiAgICBmcm9tLnNwbGl0KGAvYCkuXHJcbiAgICAgICAgcG9wKCkuXHJcbiAgICAgICAgc3BsaXQoYC5gKS5cclxuICAgICAgICBzaGlmdCgpO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgKHsgXHJcbiAgICBpbmNsdWRlLCBcclxuICAgIGV4Y2x1ZGUgXHJcbn0gPSBmYWxzZSkgPT4ge1xyXG4gICAgY29uc3QgZmlsdGVyID0gY3JlYXRlRmlsdGVyKGluY2x1ZGUsIGV4Y2x1ZGUpO1xyXG4gICAgXHJcbiAgICByZXR1cm4ge1xyXG4gICAgICAgIG5hbWU6IGByb2xsdXAtZ2xvYmAsXHJcbiAgICAgICAgbG9hZDogKGlkKSA9PiB7XHJcbiAgICAgICAgICAgIGNvbnN0IHNyY0ZpbGUgPSBwYXRoLmpvaW4ob3MudG1wZGlyKCksIGlkKTtcclxuXHJcbiAgICAgICAgICAgIGxldCBvcHRpb25zO1xyXG4gICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgb3B0aW9ucyA9IEpTT04ucGFyc2UoZnMucmVhZEZpbGVTeW5jKHNyY0ZpbGUpKTtcclxuICAgICAgICAgICAgfSBjYXRjaChlcnIpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgY29uc3QgeyBpbXBvcnRlZSwgaW1wb3J0ZXIgfSA9IG9wdGlvbnM7XHJcblxyXG4gICAgICAgICAgICBjb25zdCBpbXBvcnRlZUlzQWJzb2x1dGUgPSBwYXRoLmlzQWJzb2x1dGUoaW1wb3J0ZWUpO1xyXG4gICAgICAgICAgICBjb25zdCBjd2QgPSBwYXRoLmRpcm5hbWUoaW1wb3J0ZXIpO1xyXG4gICAgICAgICAgICBjb25zdCBnbG9iUGF0dGVybiA9IGltcG9ydGVlO1xyXG5cclxuICAgICAgICAgICAgY29uc3QgZmlsZXMgPSBnbG9iLnN5bmMoZ2xvYlBhdHRlcm4sIHtcclxuICAgICAgICAgICAgICAgIGN3ZFxyXG4gICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgIGxldCBjb2RlID0gWyBgY29uc3QgcmVzID0ge307YCBdO1xyXG4gICAgICAgICAgICBsZXQgaW1wb3J0QXJyYXkgPSBbXTtcclxuXHJcbiAgICAgICAgICAgIGZpbGVzLmZvckVhY2goKGZpbGUsIGkpID0+IHtcclxuICAgICAgICAgICAgICAgIGxldCBmcm9tO1xyXG4gICAgICAgICAgICAgICAgaWYgKGltcG9ydGVlSXNBYnNvbHV0ZSkge1xyXG4gICAgICAgICAgICAgICAgICAgIGZyb20gPSB0b1VSTFN0cmluZyhmaWxlKTtcclxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgZnJvbSA9IHRvVVJMU3RyaW5nKHBhdGgucmVzb2x2ZShjd2QsIGZpbGUpKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGNvZGUucHVzaChgaW1wb3J0IGYke2l9IGZyb20gXCIke2Zyb219XCI7YCk7XHJcbiAgICAgICAgICAgICAgICBjb2RlLnB1c2goYHJlc1tcIiR7cmVzb2x2ZU5hbWUoZnJvbSl9XCJdID0gZiR7aX07YCk7XHJcbiAgICAgICAgICAgICAgICBpbXBvcnRBcnJheS5wdXNoKGZyb20pO1xyXG4gICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgIGNvZGUucHVzaChgZXhwb3J0IGRlZmF1bHQgcmVzO2ApO1xyXG5cclxuICAgICAgICAgICAgY29kZSA9IGNvZGUuam9pbihgXFxuYCk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgICAgIHJldHVybiBjb2RlO1xyXG5cclxuICAgICAgICB9LFxyXG4gICAgICAgIHJlc29sdmVJZDogKGltcG9ydGVlLCBpbXBvcnRlcikgPT4ge1xyXG4gICAgICAgICAgICBpZiAoIWZpbHRlcihpbXBvcnRlZSkgfHwgIWltcG9ydGVlLmluY2x1ZGVzKGAqYCkpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgY29uc3QgaGFzaCA9IG1kNShpbXBvcnRlZSArIGltcG9ydGVyKTtcclxuXHJcbiAgICAgICAgICAgIGZzLndyaXRlRmlsZVN5bmMocGF0aC5qb2luKG9zLnRtcGRpcigpLCBoYXNoKSwgSlNPTi5zdHJpbmdpZnkoe1xyXG4gICAgICAgICAgICAgICAgaW1wb3J0ZWUsXHJcbiAgICAgICAgICAgICAgICBpbXBvcnRlclxyXG4gICAgICAgICAgICB9KSk7XHJcblxyXG4gICAgICAgICAgICByZXR1cm4gaGFzaDtcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG59OyIsImltcG9ydCBmcyBmcm9tIFwiZnNcIjtcclxuXHJcbmV4cG9ydCBkZWZhdWx0ICh7XHJcbiAgICBwYXRoLFxyXG4gICAgdmVyc2lvblxyXG59KSA9PiBcclxuICAgICh7XHJcbiAgICAgICAgbmFtZTogYHJvbGx1cC13cml0ZWAsXHJcbiAgICAgICAgYnVpbGRTdGFydDogKCkgPT4ge1xyXG4gICAgICAgICAgICBmcy53cml0ZUZpbGVTeW5jKHBhdGgsIHZlcnNpb24oKSk7XHJcbiAgICAgICAgfVxyXG4gICAgfSk7IiwiaW1wb3J0IHRvbWwgZnJvbSBcInJvbGx1cC1wbHVnaW4tdG9tbFwiO1xyXG5cclxuXHJcbmltcG9ydCBzdmVsdGUgZnJvbSBcInJvbGx1cC1wbHVnaW4tc3ZlbHRlXCI7XHJcbmltcG9ydCByZXNvbHZlIGZyb20gXCJyb2xsdXAtcGx1Z2luLW5vZGUtcmVzb2x2ZVwiO1xyXG5pbXBvcnQgY29weSBmcm9tIFwicm9sbHVwLXBsdWdpbi1jb3B5LWdsb2JcIjtcclxuaW1wb3J0IHJlcGxhY2UgZnJvbSBcInJvbGx1cC1wbHVnaW4tcmVwbGFjZVwiO1xyXG5cclxuaW1wb3J0IGpzb24gZnJvbSBcInJvbGx1cC1wbHVnaW4tanNvblwiO1xyXG5pbXBvcnQgbWQgZnJvbSBcInJvbGx1cC1wbHVnaW4tY29tbW9ubWFya1wiO1xyXG5pbXBvcnQgY2pzIGZyb20gXCJyb2xsdXAtcGx1Z2luLWNvbW1vbmpzXCI7XHJcblxyXG5pbXBvcnQgeyB0ZXJzZXIgfSBmcm9tIFwicm9sbHVwLXBsdWdpbi10ZXJzZXJcIjtcclxuaW1wb3J0IHV1aWQgZnJvbSBcInV1aWQvdjFcIjtcclxuXHJcbi8qXHJcbiAqIGltcG9ydCBzcHJpdGVzbWl0aCBmcm9tIFwicm9sbHVwLXBsdWdpbi1zcHJpdGVcIjtcclxuICogaW1wb3J0IHRleHR1cmVQYWNrZXIgZnJvbSBcInNwcml0ZXNtaXRoLXRleHR1cmVwYWNrZXJcIjtcclxuICovXHJcblxyXG5pbXBvcnQgZ2xvYiBmcm9tIFwiLi9wbHVnaW4tZ2xvYi5qc1wiO1xyXG5pbXBvcnQgdmVyc2lvbiBmcm9tIFwiLi92ZXJzaW9uLmpzXCI7XHJcblxyXG5jb25zdCBDT0RFX1ZFUlNJT04gPSB1dWlkKCk7XHJcbmNvbnN0IHByb2R1Y3Rpb24gPSAhcHJvY2Vzcy5lbnYuUk9MTFVQX1dBVENIO1xyXG5cclxuY29uc3QgZG9fY29weSA9IChjb3B5T2JqZWN0KSA9PiBcclxuICAgIGNvcHkoT2JqZWN0LmtleXMoY29weU9iamVjdCkuXHJcbiAgICAgICAgbWFwKFxyXG4gICAgICAgICAgICAoa2V5KSA9PiBcclxuICAgICAgICAgICAgICAgICh7XHJcbiAgICAgICAgICAgICAgICAgICAgZmlsZXM6IGtleSxcclxuICAgICAgICAgICAgICAgICAgICBkZXN0OiBjb3B5T2JqZWN0W2tleV1cclxuICAgICAgICAgICAgICAgIH0pXHJcbiAgICAgICAgKSk7XHJcblxyXG5sZXQgQ0xJRU5UX1ZFUlNJT04gPSB1dWlkKCk7XHJcblxyXG5jb25zdCBleHRlcm5hbCA9IFtcclxuICAgIGBleHByZXNzYCxcclxuICAgIGBpc2VrYWlgLFxyXG4gICAgYGZzYCxcclxuICAgIGBodHRwYCxcclxuICAgIGBodHRwc2BcclxuXTtcclxuXHJcbmNvbnN0IG5vZGUgPSAoe1xyXG4gICAgaW5wdXQsXHJcbiAgICBvdXRwdXQsXHJcbiAgICBjb3B5OiBjb3B5T2JqZWN0ID0ge31cclxufSkgPT4gXHJcbiAgICAoe1xyXG4gICAgICAgIGlucHV0LFxyXG4gICAgICAgIG91dHB1dDoge1xyXG4gICAgICAgICAgICBzb3VyY2VtYXA6IGBpbmxpbmVgLFxyXG4gICAgICAgICAgICBmaWxlOiBvdXRwdXQsXHJcbiAgICAgICAgICAgIGZvcm1hdDogYGNqc2AsXHJcbiAgICAgICAgfSxcclxuICAgICAgICBleHRlcm5hbCxcclxuICAgICAgICBwbHVnaW5zOiBbXHJcbiAgICAgICAgICAgIGdsb2IoKSxcclxuICAgICAgICAgICAgcmVwbGFjZSh7XHJcbiAgICAgICAgICAgICAgICBDT0RFX1ZFUlNJT04sXHJcbiAgICAgICAgICAgIH0pLFxyXG4gICAgICAgICAgICBtZCgpLFxyXG4gICAgICAgICAgICBkb19jb3B5KGNvcHlPYmplY3QpLFxyXG4gICAgICAgICAgICB0b21sXHJcbiAgICAgICAgXSxcclxuICAgIH0pO1xyXG5cclxuY29uc3QgYnJvd3NlciA9ICh7XHJcbiAgICBpbnB1dCxcclxuICAgIG91dHB1dCxcclxuICAgIGNzczogY3NzUGF0aCxcclxuICAgIGNvcHk6IGNvcHlPYmplY3QsXHJcbn0pID0+IFxyXG4gICAgKHtcclxuICAgICAgICBpbnB1dCxcclxuICAgICAgICBvdXRwdXQ6IHtcclxuICAgICAgICAgICAgZmlsZTogb3V0cHV0LFxyXG4gICAgICAgICAgICBmb3JtYXQ6IGBpaWZlYCxcclxuICAgICAgICB9LFxyXG4gICAgICAgIGV4dGVybmFsOiBbIGB1dWlkYCwgYHV1aWQvdjFgLCBgcGl4aS5qc2AgXSxcclxuICAgICAgICBwbHVnaW5zOiBbXHJcbiAgICAgICAgLy8gLy8gbWFrZSB0aGlzIGEgcmVhY3RpdmUgcGx1Z2luIHRvIFwiLnRpbGVtYXAuanNvblwiXHJcbiAgICAgICAgLy8gICAgIHNwcml0ZXNtaXRoKHtcclxuICAgICAgICAvLyAgICAgICAgIHNyYzoge1xyXG4gICAgICAgIC8vICAgICAgICAgICAgIGN3ZDogXCIuL2dvYmxpbi5saWZlL0JST1dTRVIuUElYSS9cclxuICAgICAgICAvLyAgICAgICAgICAgICBnbG9iOiBcIioqLyoucG5nXCJcclxuICAgICAgICAvLyAgICAgICAgIH0sXHJcbiAgICAgICAgLy8gICAgICAgICB0YXJnZXQ6IHtcclxuICAgICAgICAvLyAgICAgICAgICAgICBpbWFnZTogXCIuL2Jpbi9wdWJsaWMvaW1hZ2VzL3Nwcml0ZS5wbmdcIixcclxuICAgICAgICAvLyAgICAgICAgICAgICBjc3M6IFwiLi9iaW4vcHVibGljL2FydC9kZWZhdWx0Lmpzb25cIlxyXG4gICAgICAgIC8vICAgICAgICAgfSxcclxuICAgICAgICAvLyAgICAgICAgIG91dHB1dDoge1xyXG4gICAgICAgIC8vICAgICAgICAgICAgIGltYWdlOiBcIi4vYmluL3B1YmxpYy9pbWFnZXMvc3ByaXRlLnBuZ1wiXHJcbiAgICAgICAgLy8gICAgICAgICB9LFxyXG4gICAgICAgIC8vICAgICAgICAgc3ByaXRlc21pdGhPcHRpb25zOiB7XHJcbiAgICAgICAgLy8gICAgICAgICAgICAgcGFkZGluZzogMFxyXG4gICAgICAgIC8vICAgICAgICAgfSxcclxuICAgICAgICAvLyAgICAgICAgIGN1c3RvbVRlbXBsYXRlOiB0ZXh0dXJlUGFja2VyXHJcbiAgICAgICAgLy8gICAgIH0pLFxyXG4gICAgICAgICAgICBnbG9iKCksXHJcbiAgICAgICAgICAgIGNqcyh7XHJcbiAgICAgICAgICAgICAgICBpbmNsdWRlOiBgbm9kZV9tb2R1bGVzLyoqYCwgXHJcbiAgICAgICAgICAgIH0pLFxyXG4gICAgICAgICAgICBqc29uKCksXHJcbiAgICAgICAgICAgIHJlcGxhY2Uoe1xyXG4gICAgICAgICAgICAgICAgQ09ERV9WRVJTSU9OLFxyXG4gICAgICAgICAgICAgICAgQ0xJRU5UX1ZFUlNJT046ICgpID0+IFxyXG4gICAgICAgICAgICAgICAgICAgIENMSUVOVF9WRVJTSU9OXHJcbiAgICAgICAgICAgIH0pLFxyXG4gICAgICAgICAgICB0b21sLFxyXG4gICAgICAgICAgICBtZCgpLFxyXG4gICAgICAgICAgICBzdmVsdGUoe1xyXG4gICAgICAgICAgICAgICAgY3NzOiAoY3NzKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgY3NzLndyaXRlKGNzc1BhdGgpO1xyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgfSksXHJcbiAgICAgICAgICAgIHJlc29sdmUoKSxcclxuICAgICAgICAgICAgcHJvZHVjdGlvbiAmJiB0ZXJzZXIoKSxcclxuICAgICAgICAgICAgZG9fY29weShjb3B5T2JqZWN0KSxcclxuICAgICAgICAgICAgdmVyc2lvbih7XHJcbiAgICAgICAgICAgICAgICBwYXRoOiBgLi8uTUFHSUMvY2xpZW50LnZlcnNpb25gLFxyXG4gICAgICAgICAgICAgICAgdmVyc2lvbjogKCkgPT4gXHJcbiAgICAgICAgICAgICAgICAgICAgQ0xJRU5UX1ZFUlNJT05cclxuICAgICAgICAgICAgfSlcclxuICAgICAgICBdXHJcbiAgICB9KTtcclxuXHJcbmV4cG9ydCBkZWZhdWx0IHtcclxuICAgIG5vZGUsXHJcbiAgICBicm93c2VyXHJcbn07IiwiaW1wb3J0IGZzIGZyb20gXCJmc1wiO1xyXG5pbXBvcnQgdG9tbCBmcm9tIFwidG9tbFwiO1xyXG5pbXBvcnQgcGF0aCBmcm9tIFwicGF0aFwiO1xyXG5pbXBvcnQgZ2xvYiBmcm9tIFwiZ2xvYlwiO1xyXG5pbXBvcnQgYyBmcm9tIFwiY2hhbGtcIjtcclxuaW1wb3J0IGJ1aWxkZXJzIGZyb20gXCIuLi9yb2xsdXAvYnVpbGRlcnMuanNcIjtcclxuXHJcbmMuZW5hYmxlZCA9IHRydWU7XHJcbmMubGV2ZWwgPSAzO1xyXG5cclxuY29uc3QgbG9nX2VxdWlwID0gKGVxdWlwKSA9PiBcclxuICAgIGMueWVsbG93KGVxdWlwKTtcclxuXHJcbmV4cG9ydCBkZWZhdWx0IChjb25maWdGaWxlKSA9PiBcclxuICAgIC8vIE1peCBDb25maWcgRmlsZSBpbiBhbmQgcnVuIHRoZXNlIGluIG9yZGVyXHJcbiAgICBPYmplY3QudmFsdWVzKHtcclxuICAgICAgICBnYXRoZXJfZXF1aXBtZW50OiAoKSA9PiBcclxuICAgICAgICAgICAgKHtcclxuICAgICAgICAgICAgICAgIEVRVUlQTUVOVDogZ2xvYi5zeW5jKGAuL1NIT1AvKi9gKS5cclxuICAgICAgICAgICAgICAgICAgICByZWR1Y2UoKG9iaiwgZXF1aXBfcGF0aCkgPT4gXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICh7IFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgW3BhdGguYmFzZW5hbWUoZXF1aXBfcGF0aCldOiB0cnVlLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLi4ub2JqIFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB9KSwge30pXHJcbiAgICAgICAgICAgIH0pLFxyXG5cclxuICAgICAgICByZWFkX2NvbmZpZzogKHtcclxuICAgICAgICAgICAgY29uZmlnRmlsZSxcclxuICAgICAgICB9KSA9PiB7XHJcbiAgICAgICAgLy8gdmVyaWZ5IHRvbWwgZXhpc3RzXHJcbiAgICAgICAgICAgIGxldCByYXc7XHJcblxyXG4gICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgcmF3ID0gZnMucmVhZEZpbGVTeW5jKGNvbmZpZ0ZpbGUsIGB1dGYtOGApO1xyXG4gICAgICAgICAgICB9IGNhdGNoIChleGNlcHRpb24pIHtcclxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgQ291bGRuJ3QgcmVhZCAke2NvbmZpZ0ZpbGV9LiBBcmUgeW91IHN1cmUgdGhpcyBwYXRoIGlzIGNvcnJlY3Q/YCk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGNvbnN0IGNvbmZpZyA9IHRvbWwucGFyc2UocmF3KTtcclxuXHJcbiAgICAgICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgICAgICBjb25maWcsXHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgfSxcclxuXHJcbiAgICAgICAgc2V0X25hbWVzOiAoe1xyXG4gICAgICAgICAgICBjb25maWdGaWxlLFxyXG4gICAgICAgICAgICBjb25maWdcclxuICAgICAgICB9KSA9PiB7XHJcbiAgICAgICAgICAgIGNvbnN0IG5hbWUgPSBwYXRoLmJhc2VuYW1lKGNvbmZpZ0ZpbGUsIGAudG9tbGApO1xyXG5cclxuICAgICAgICAgICAgY29uc3QgcGFja2FnZV9wYXRoID0gcGF0aC5kaXJuYW1lKHBhdGgucmVzb2x2ZShjb25maWdGaWxlKSk7XHJcbiAgICAgICAgICAgIGNvbnN0IHBhY2thZ2VfbmFtZSA9IHBhY2thZ2VfcGF0aC5cclxuICAgICAgICAgICAgICAgIHNwbGl0KHBhdGguc2VwKS5cclxuICAgICAgICAgICAgICAgIHBvcCgpO1xyXG5cclxuICAgICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgICAgIHBhY2thZ2VfcGF0aCxcclxuICAgICAgICAgICAgICAgIHBhY2thZ2VfbmFtZSxcclxuICAgICAgICAgICAgICAgIG5hbWUsXHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgfSxcclxuXHJcbiAgICAgICAgd3JpdGVfZW50cnk6ICh7XHJcbiAgICAgICAgICAgIGNvbmZpZyxcclxuICAgICAgICAgICAgbmFtZSxcclxuICAgICAgICAgICAgRVFVSVBNRU5ULFxyXG4gICAgICAgIH0pID0+IHtcclxuICAgICAgICAvLyBXUklURSBPVVQgRklMRVxyXG4gICAgICAgICAgICBsZXQgZW50cnkgPSBgYDtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGNvbnN0IHdyaXRlID0gKGRhdGEpID0+IFxyXG4gICAgICAgICAgICAgICAgZW50cnkgKz0gYCR7ZGF0YX1cXHJcXG5gO1xyXG4gICAgICAgIFxyXG4gICAgICAgICAgICB3cml0ZShgaW1wb3J0IGlzZWthaSBmcm9tIFwiaXNla2FpXCI7YCk7XHJcbiAgICAgICAgICAgIHdyaXRlKGBpc2VrYWkuU0VUKCR7SlNPTi5zdHJpbmdpZnkoY29uZmlnKX0pO2ApO1xyXG4gICAgICAgICAgICB3cml0ZShgYCk7XHJcbiAgICBcclxuICAgICAgICAgICAgY29uc3QgZXF1aXBlZCA9IE9iamVjdC5rZXlzKGNvbmZpZykuXHJcbiAgICAgICAgICAgICAgICBmaWx0ZXIoKGtleSkgPT4gXHJcbiAgICAgICAgICAgICAgICAgICAga2V5ID09PSBrZXkudG9VcHBlckNhc2UoKSAmJiBFUVVJUE1FTlRba2V5XSkuXHJcbiAgICAgICAgICAgICAgICBtYXAoKGtleSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIHdyaXRlKGBpbXBvcnQgJHtrZXl9IGZyb20gXCIuLi9TSE9QLyR7a2V5fS9pbmRleC5qc1wiO2ApO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4ga2V5O1xyXG4gICAgICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICBjb25zdCBrZXlzID0gZXF1aXBlZC5yZWR1Y2UoKG91dHB1dCwga2V5KSA9PiBcclxuICAgICAgICAgICAgICAgIGAke291dHB1dH0gICAgJHtrZXl9LFxcclxcbmAsIGBgKTtcclxuXHJcbiAgICAgICAgICAgIHdyaXRlKGBcclxuaXNla2FpLkVRVUlQKHtcXHJcXG4ke2tleXN9fSk7YCk7XHJcblxyXG4gICAgICAgICAgICBjb25zdCBpbnB1dCA9IHBhdGguam9pbihgLk1BR0lDYCwgYCR7bmFtZX0uZW50cnkuanNgKTtcclxuXHJcbiAgICAgICAgICAgIC8vIHdyaXRlIG91dCB0aGVpciBpbmRleC5qc1xyXG4gICAgICAgICAgICBmcy53cml0ZUZpbGVTeW5jKGlucHV0LCBlbnRyeSwgYHV0Zi04YCk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBjb25zb2xlLmxvZyhgXHJcblske25hbWV9XVske2NvbmZpZy5OT0RFID8gYE5PREVgIDogYEJST1dTRVJgfV1cclxuU0hPUDpcclxuJHtPYmplY3Qua2V5cyhFUVVJUE1FTlQpLlxyXG4gICAgICAgIG1hcChsb2dfZXF1aXApLlxyXG4gICAgICAgIGpvaW4oYCAtIGApfVxyXG5cclxuRVFVSVBQRUQ6XHJcbiR7Yy5yZWQoZXF1aXBlZC5qb2luKGAgLSBgKSl9XHJcbmApO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgICAgIGlucHV0XHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgfSxcclxuXHJcbiAgICAgICAgcnVuX2J1aWxkZXJzOiAoe1xyXG4gICAgICAgICAgICBpbnB1dCxcclxuICAgICAgICAgICAgbmFtZSxcclxuICAgICAgICAgICAgY29uZmlnLFxyXG4gICAgICAgIH0pID0+IHtcclxuICAgICAgICAgICAgY29uc3QgdGFyZ2V0ID0gY29uZmlnLk5PREUgXHJcbiAgICAgICAgICAgICAgICA/IGBOT0RFYCBcclxuICAgICAgICAgICAgICAgIDogYEJST1dTRVJgO1xyXG5cclxuICAgICAgICAgICAgY29uc3Qgb3V0cHV0ID0gYC5NQUdJQy8ke25hbWV9LiR7dGFyZ2V0fS5qc2A7XHJcblxyXG4gICAgICAgICAgICBpZihjb25maWcuTk9ERSAmJiBjb25maWcuQlJPV1NFUikge1xyXG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBZb3UgY2Fubm90IHRhcmdldCBib3RoIFtOT0RFXSBhbmQgW0JST1dTRVJdYCk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGlmKGNvbmZpZy5OT0RFKSB7ICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICAgICAgICAgIG91dHB1dCxcclxuICAgICAgICAgICAgICAgICAgICBidWlsZF9pbmZvOiBidWlsZGVycy5ub2RlKHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaW5wdXQsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG91dHB1dFxyXG4gICAgICAgICAgICAgICAgICAgIH0pXHJcbiAgICAgICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgICAgIGlmKGNvbmZpZy5CUk9XU0VSKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICAgICAgICAgIG91dHB1dCxcclxuICAgICAgICAgICAgICAgICAgICBidWlsZF9pbmZvOiBidWlsZGVycy5icm93c2VyKHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaW5wdXQsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG91dHB1dFxyXG4gICAgICAgICAgICAgICAgICAgIH0pXHJcbiAgICAgICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFlvdSBtdXN0IHNwZWNpZnkgZWl0aGVyIFtOT0RFXSBvciBbQlJPV1NFUl0gZm9yIHlvdXIgdGFyZ2V0YCk7XHJcbiAgICAgICAgfVxyXG4gICAgfSkuXHJcbiAgICAgICAgcmVkdWNlKChzdGF0ZSwgZm4pID0+IFxyXG4gICAgICAgICAgICAoe1xyXG4gICAgICAgICAgICAgICAgLi4uc3RhdGUsXHJcbiAgICAgICAgICAgICAgICAuLi5mbihzdGF0ZSlcclxuICAgICAgICAgICAgfSksIHsgY29uZmlnRmlsZSB9KTtcclxuIiwiaW1wb3J0IGdsb2IgZnJvbSBcImdsb2JcIjtcclxuaW1wb3J0IHBhdGggZnJvbSBcInBhdGhcIjtcclxuXHJcbmV4cG9ydCBkZWZhdWx0ICgpID0+IFxyXG4gICAgZ2xvYi5zeW5jKGAuL0NMQVNTLyoudG9tbGApLlxyXG4gICAgICAgIG1hcCgoY2xhc3NfcGF0aCkgPT4gXHJcbiAgICAgICAgICAgIHBhdGguYmFzZW5hbWUoY2xhc3NfcGF0aCwgYC50b21sYCkpOyIsImltcG9ydCBnZXRfbGlzdCBmcm9tIFwiLi9nZXRfbGlzdC5qc1wiO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgKGNsYXNzZXMpID0+IFxyXG4gICAgKGZuKSA9PiBcclxuICAgICAgICBQcm9taXNlLmFsbChjbGFzc2VzLmZpbHRlcigodGFyZ2V0KSA9PiB7XHJcbiAgICAgICAgICAgIGNvbnN0IGlzX29rYXkgPSBnZXRfbGlzdCgpLlxyXG4gICAgICAgICAgICAgICAgaW5kZXhPZih0YXJnZXQpICE9PSAtMTtcclxuXHJcbiAgICAgICAgICAgIGlmKCFpc19va2F5KSB7XHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgJHt0YXJnZXR9IGlzIG5vdCBhbiBhdmFpbGFibGUgW0NMQVNTXWApO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgICAgIHJldHVybiBpc19va2F5O1xyXG4gICAgICAgIH0pLlxyXG4gICAgICAgICAgICBtYXAoZm4pKTtcclxuIiwiaW1wb3J0IHRvbWxfdG9fanMgZnJvbSBcIi4uL3RyYW5zZm9ybXMvdG9tbF90b19qcy5qc1wiO1xyXG5pbXBvcnQgcm9sbHVwIGZyb20gXCJyb2xsdXBcIjtcclxuXHJcbmltcG9ydCBnZXRfbGlzdCBmcm9tIFwiLi4vbGliL2dldF9saXN0LmpzXCI7XHJcbmltcG9ydCBmaWx0ZXJfbGlzdCBmcm9tIFwiLi4vbGliL2ZpbHRlcl9saXN0LmpzXCI7XHJcblxyXG5leHBvcnQgZGVmYXVsdCAoe1xyXG4gICAgY29tbWFuZDogYGJ1aWxkIFtDTEFTUy4uLl1gLFxyXG4gICAgaGVscDogYGJ1aWxkIGFsbCBbQ0xBU1NdIGZpbGVzLmAsXHJcbiAgICBhdXRvY29tcGxldGU6IGdldF9saXN0KCksXHJcbiAgICBoaWRkZW46IHRydWUsXHJcbiAgICBoYW5kbGVyOiAoeyBDTEFTUyA9IGdldF9saXN0KCkgfSkgPT4gXHJcbiAgICAgICAgZmlsdGVyX2xpc3QoQ0xBU1MpKGFzeW5jICh0YXJnZXQpID0+IHtcclxuICAgICAgICAgICAgY29uc3QgeyBidWlsZF9pbmZvLCBuYW1lIH0gPSBhd2FpdCB0b21sX3RvX2pzKGAuL0NMQVNTLyR7dGFyZ2V0fS50b21sYCk7XHJcbiAgICAgICAgICAgIGNvbnN0IGJ1bmRsZSA9IGF3YWl0IHJvbGx1cC5yb2xsdXAoYnVpbGRfaW5mbyk7XHJcblxyXG4gICAgICAgICAgICAvKlxyXG4gICAgICAgICAgICAgKiBjb25zb2xlLmxvZyhgR2VuZXJhdGluZyBvdXRwdXQuLi5gKTtcclxuICAgICAgICAgICAgICogY29uc3QgeyBvdXRwdXQgfSA9IGF3YWl0IGJ1bmRsZS5nZW5lcmF0ZShidWlsZF9pbmZvLm91dHB1dCk7XHJcbiAgICAgICAgICAgICAqL1xyXG5cclxuICAgICAgICAgICAgLy8gY29uc29sZS5sb2cob3V0cHV0KTtcclxuICAgICAgICAgICAgYXdhaXQgYnVuZGxlLndyaXRlKGJ1aWxkX2luZm8ub3V0cHV0KTtcclxuICAgICAgICAgICAgY29uc29sZS5sb2coYFske25hbWV9XSBCdWlsZCBDb21wbGV0ZS5cXHJcXG5gKTtcclxuICAgICAgICB9KS5cclxuICAgICAgICAgICAgdGhlbigocHJvbWlzZXMpID0+IHtcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBCdWlsdCAke3Byb21pc2VzLmxlbmd0aH0gW0NMQVNTXSBmaWxlKHMpLmApO1xyXG4gICAgICAgICAgICB9KVxyXG59KTsiLCJpbXBvcnQgcG0yIGZyb20gXCIuL3BtMi5qc1wiO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgKHtcclxuICAgIGNvbW1hbmQ6IGBsb2dzIFtDTEFTUy4uLl1gLFxyXG4gICAgaGVscDogYGZvbGxvdyB0aGUgbG9nc2AsXHJcbiAgICBoYW5kbGVyOiAoeyBDTEFTUyA9IFtdIH0pID0+IFxyXG4gICAgICAgIG5ldyBQcm9taXNlKCgpID0+IFxyXG4gICAgICAgICAgICBwbTIuaGFuZGxlcih7XHJcbiAgICAgICAgICAgICAgICBjb21tYW5kczogWyBgbG9nc2AsIC4uLkNMQVNTIF1cclxuICAgICAgICAgICAgfSkpXHJcbn0pOyIsImltcG9ydCBnZXRfbGlzdCBmcm9tIFwiLi4vbGliL2dldF9saXN0LmpzXCI7XHJcblxyXG5leHBvcnQgZGVmYXVsdCAoe1xyXG4gICAgaGVscDogYFNob3cgYXZhaWxhYmxlIFtDTEFTU10gZmlsZXMgZnJvbSB0aGUgW1NIT1BdLmAsXHJcbiAgICBhbGlhczogWyBgbHNgIF0sXHJcbiAgICBoYW5kbGVyOiAoYXJncywgY2IpID0+IHtcclxuICAgICAgICBjb25zb2xlLmxvZyhnZXRfbGlzdCgpLlxyXG4gICAgICAgICAgICBtYXAoKGkpID0+IFxyXG4gICAgICAgICAgICAgICAgYFske2l9XWApLlxyXG4gICAgICAgICAgICBqb2luKGAgLSBgKSwgYFxcclxcbmApOyAgICBcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgY2IoKTtcclxuICAgIH1cclxufSk7IiwiaW1wb3J0IHBtMiBmcm9tIFwicG0yXCI7XHJcblxyXG5pbXBvcnQgdG9tbF90b19qcyBmcm9tIFwiLi4vdHJhbnNmb3Jtcy90b21sX3RvX2pzLmpzXCI7XHJcbmltcG9ydCBnZXRfbGlzdCBmcm9tIFwiLi4vbGliL2dldF9saXN0LmpzXCI7XHJcbmltcG9ydCBmaWx0ZXJfbGlzdCBmcm9tIFwiLi4vbGliL2ZpbHRlcl9saXN0LmpzXCI7XHJcblxyXG5leHBvcnQgZGVmYXVsdCAoe1xyXG4gICAgY29tbWFuZGVyOiBgc3Bhd24gW0NMQVNTLi4uXWAsXHJcbiAgICBoZWxwOiBgc3Bhd24gW0NMQVNTXSBmaWxlc2AsXHJcbiAgICBoaWRkZW46IHRydWUsXHJcbiAgICBoYW5kbGVyOiAoe1xyXG4gICAgICAgIENMQVNTID0gZ2V0X2xpc3QoKVxyXG4gICAgfSkgPT4ge1xyXG4gICAgICAgIGZpbHRlcl9saXN0KENMQVNTKSgobmFtZSkgPT4ge1xyXG4gICAgICAgICAgICBjb25zdCB7XHJcbiAgICAgICAgICAgICAgICBvdXRwdXQsXHJcbiAgICAgICAgICAgIH0gPSB0b21sX3RvX2pzKGAuL0NMQVNTLyR7bmFtZX0udG9tbGApO1xyXG4gICAgICAgICAgICBjb25zb2xlLmxvZyhgd2F0Y2hpbmdgLCBvdXRwdXQpO1xyXG5cclxuICAgICAgICAgICAgcG0yLnN0YXJ0KHtcclxuICAgICAgICAgICAgICAgIG5hbWUsXHJcbiAgICAgICAgICAgICAgICBzY3JpcHQ6IG91dHB1dCxcclxuICAgICAgICAgICAgICAgIHdhdGNoOiBbIGAuLyR7b3V0cHV0fWAgXSxcclxuICAgICAgICAgICAgICAgIG1heF9yZXN0YXJ0OiA1IFxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9KTtcclxuXHJcbiAgICB9XHJcbn0pO1xyXG4iLCJleHBvcnQgZGVmYXVsdCAoXHJcbiAgICBhY3Rpb25fbWFwLCBcclxuICAgIHJlZHVjZXIgPSAoaSkgPT4gXHJcbiAgICAgICAgaVxyXG4pID0+IFxyXG4gICAgKGlucHV0KSA9PiB7XHJcbiAgICAgICAgY29uc3Qga2V5ID0gcmVkdWNlcihpbnB1dCk7XHJcblxyXG4gICAgICAgIGlmKCFhY3Rpb25fbWFwW2tleV0pIHtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmV0dXJuIGFjdGlvbl9tYXBba2V5XShpbnB1dCk7XHJcbiAgICB9OyIsImltcG9ydCBjaG9raWRhciBmcm9tIFwiY2hva2lkYXJcIjtcclxuaW1wb3J0IHJvbGx1cCBmcm9tIFwicm9sbHVwXCI7XHJcbmltcG9ydCBjIGZyb20gXCJjaGFsa1wiO1xyXG5cclxuaW1wb3J0IHRvbWxfdG9fanMgZnJvbSBcIi4uL3RyYW5zZm9ybXMvdG9tbF90b19qcy5qc1wiO1xyXG5cclxuaW1wb3J0IGFjdGlvbiBmcm9tIFwiLi4vbGliL2FjdGlvbi5qc1wiO1xyXG5pbXBvcnQgZmlsdGVyX2xpc3QgZnJvbSBcIi4uL2xpYi9maWx0ZXJfbGlzdC5qc1wiO1xyXG5pbXBvcnQgZ2V0X2xpc3QgZnJvbSBcIi4uL2xpYi9nZXRfbGlzdC5qc1wiO1xyXG5cclxuY29uc3Qgd2F0Y2hfcHJvbXB0ID0gKCkgPT4gXHJcbiAgICBjb25zb2xlLmxvZyhgW0JVSUxUXSBQUkVTUyBbQ1RSTCtDXSBUTyBRVUlUIFlPVVIgV0FUQ0hgKTtcclxuXHJcbmV4cG9ydCBkZWZhdWx0ICh7XHJcbiAgICBjb21tYW5kOiBgd2F0Y2ggW0NMQVNTLi4uXWAsXHJcbiAgICBoZWxwOiBgd2F0Y2ggW0NMQVNTXSBmaWxlcyBmb3IgY2hhbmdlcyBhbmQgcmVidWlsZC5gLFxyXG4gICAgaGlkZGVuOiB0cnVlLFxyXG4gICAgY2FuY2VsICgpIHtcclxuICAgICAgICB0aGlzLndhdGNoZXJzLmZvckVhY2goKHdhdGNoZXIpID0+IFxyXG4gICAgICAgICAgICB3YXRjaGVyLmNsb3NlKCkpO1xyXG4gICAgICAgIGNvbnNvbGUubG9nKGBZT1VSIFdBVENIIEhBUyBFTkRFRGApO1xyXG4gICAgfSxcclxuICAgIGhhbmRsZXIoeyBDTEFTUyA9IGdldF9saXN0KCkgfSwgY2IpIHtcclxuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHtcclxuICAgICAgICAgICAgdGhpcy53YXRjaGVycyA9IFtdO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgZmlsdGVyX2xpc3QoQ0xBU1MpKCh0YXJnZXQpID0+IHtcclxuICAgICAgICAgICAgICAgIGNvbnN0IGZpbGVfcGF0aCA9IGAuL0NMQVNTLyR7dGFyZ2V0fS50b21sYDtcclxuXHJcbiAgICAgICAgICAgICAgICBjb25zdCBkYXRhID0gdG9tbF90b19qcyhmaWxlX3BhdGgpO1xyXG5cclxuICAgICAgICAgICAgICAgIGNvbnN0IHsgYnVpbGRfaW5mbyB9ID0gZGF0YTtcclxuICAgICAgICBcclxuICAgICAgICAgICAgICAgIC8vIHJlYnVpbGQgb24gZmlsZSBjaGFnbmVcclxuICAgICAgICAgICAgICAgIGNvbnN0IHdhdGNoZXIgPSBjaG9raWRhci53YXRjaChmaWxlX3BhdGgpO1xyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICB3YXRjaGVyLm9uKGBjaGFuZ2VgLCAoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgdG9tbF90b19qcyhmaWxlX3BhdGgpO1xyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIHRoaXMud2F0Y2hlcnMucHVzaCh3YXRjaGVyKTtcclxuXHJcbiAgICAgICAgICAgICAgICBjb25zdCByb2xsdXBfd2F0Y2hlciA9IHJvbGx1cC53YXRjaCh7XHJcbiAgICAgICAgICAgICAgICAgICAgLi4uYnVpbGRfaW5mbyxcclxuICAgICAgICAgICAgICAgICAgICB3YXRjaDoge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjbGVhclNjcmVlbjogdHJ1ZVxyXG4gICAgICAgICAgICAgICAgICAgIH0gICBcclxuICAgICAgICAgICAgICAgIH0pLlxyXG4gICAgICAgICAgICAgICAgICAgIG9uKGBldmVudGAsIGFjdGlvbih7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIEJVTkRMRV9FTkQ6ICgpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHdhdGNoX3Byb21wdCgpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBGQVRBTDogKHsgZXJyb3IgfSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihjLnJlZC5ib2xkKGVycm9yKSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICB9LCAoeyBjb2RlIH0pID0+IFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb2RlIFxyXG4gICAgICAgICAgICAgICAgICAgICkpO1xyXG5cclxuICAgICAgICAgICAgICAgIHRoaXMud2F0Y2hlcnMucHVzaChyb2xsdXBfd2F0Y2hlcik7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG59KTtcclxuIiwiaW1wb3J0IHdhdGNoIGZyb20gXCIuL3dhdGNoLmpzXCI7XHJcbmltcG9ydCBzcGF3biBmcm9tIFwiLi9zcGF3bi5qc1wiO1xyXG5pbXBvcnQgZXhlYyBmcm9tIFwiLi9wbTIuanNcIjtcclxuXHJcbmV4cG9ydCBkZWZhdWx0ICh7XHJcbiAgICBjb21tYW5kOiBgc3RhcnQgW0NMQVNTLi4uXWAsXHJcbiAgICBoZWxwOiBgc3RhcnQgYW5kIHdhdGNoIFtDTEFTU10gZmlsZXNgLCBcclxuICAgIGhhbmRsZXI6IChkYXRhKSA9PiB7IFxyXG4gICAgICAgIHdhdGNoLmhhbmRsZXIoZGF0YSk7XHJcbiAgICAgICAgc3Bhd24uaGFuZGxlcihkYXRhKTtcclxuICAgICAgICBleGVjLmhhbmRsZXIoe1xyXG4gICAgICAgICAgICBjb21tYW5kczogWyBgbG9nc2AgXVxyXG4gICAgICAgIH0pO1xyXG4gICAgfSxcclxuICAgIGNhbmNlbDogKCkgPT4ge1xyXG4gICAgICAgIHdhdGNoLmNhbmNlbCgpO1xyXG4gICAgfVxyXG59KTtcclxuXHJcbiIsImltcG9ydCBwbTIgZnJvbSBcIi4vcG0yLmpzXCI7XHJcblxyXG5leHBvcnQgZGVmYXVsdCAoe1xyXG4gICAgY29tbWFuZDogYHN0b3AgW0NMQVNTLi4uXWAsXHJcbiAgICBoZWxwOiBgc3RvcCBhY3RpdmUgQ0xBU1NdIGZpbGVzLiBgLCBcclxuXHJcbiAgICBoYW5kbGVyOiAoeyBDTEFTUyA9IFsgYGFsbGAgXSB9KSA9PiBcclxuICAgICAgICBwbTIuaGFuZGxlcih7XHJcbiAgICAgICAgICAgIGNvbW1hbmRzOiBbIGBkZWxldGVgLCAuLi5DTEFTUyBdXHJcbiAgICAgICAgfSlcclxufSk7XHJcblxyXG4iLCJjb25zdCByZXMgPSB7fTtcbmltcG9ydCBmMCBmcm9tIFwiL1VzZXJzL0dhbWVzL1Byb2plY3RzL0lTRUtBSS9zcmMvY29tbWFuZHMvYWN0aXZlLmpzXCI7XG5yZXNbXCJhY3RpdmVcIl0gPSBmMDtcbmltcG9ydCBmMSBmcm9tIFwiL1VzZXJzL0dhbWVzL1Byb2plY3RzL0lTRUtBSS9zcmMvY29tbWFuZHMvYnVpbGQuanNcIjtcbnJlc1tcImJ1aWxkXCJdID0gZjE7XG5pbXBvcnQgZjIgZnJvbSBcIi9Vc2Vycy9HYW1lcy9Qcm9qZWN0cy9JU0VLQUkvc3JjL2NvbW1hbmRzL2xvZ3MuanNcIjtcbnJlc1tcImxvZ3NcIl0gPSBmMjtcbmltcG9ydCBmMyBmcm9tIFwiL1VzZXJzL0dhbWVzL1Byb2plY3RzL0lTRUtBSS9zcmMvY29tbWFuZHMvcG0yLmpzXCI7XG5yZXNbXCJwbTJcIl0gPSBmMztcbmltcG9ydCBmNCBmcm9tIFwiL1VzZXJzL0dhbWVzL1Byb2plY3RzL0lTRUtBSS9zcmMvY29tbWFuZHMvc2hvcC5qc1wiO1xucmVzW1wic2hvcFwiXSA9IGY0O1xuaW1wb3J0IGY1IGZyb20gXCIvVXNlcnMvR2FtZXMvUHJvamVjdHMvSVNFS0FJL3NyYy9jb21tYW5kcy9zcGF3bi5qc1wiO1xucmVzW1wic3Bhd25cIl0gPSBmNTtcbmltcG9ydCBmNiBmcm9tIFwiL1VzZXJzL0dhbWVzL1Byb2plY3RzL0lTRUtBSS9zcmMvY29tbWFuZHMvc3RhcnQuanNcIjtcbnJlc1tcInN0YXJ0XCJdID0gZjY7XG5pbXBvcnQgZjcgZnJvbSBcIi9Vc2Vycy9HYW1lcy9Qcm9qZWN0cy9JU0VLQUkvc3JjL2NvbW1hbmRzL3N0b3AuanNcIjtcbnJlc1tcInN0b3BcIl0gPSBmNztcbmltcG9ydCBmOCBmcm9tIFwiL1VzZXJzL0dhbWVzL1Byb2plY3RzL0lTRUtBSS9zcmMvY29tbWFuZHMvd2F0Y2guanNcIjtcbnJlc1tcIndhdGNoXCJdID0gZjg7XG5leHBvcnQgZGVmYXVsdCByZXM7IiwiaW1wb3J0IGMgZnJvbSBcImNoYWxrXCI7XHJcblxyXG5jb25zdCB7IGxvZyB9ID0gY29uc29sZTtcclxuXHJcbmNvbnNvbGUubG9nID0gKC4uLmFyZ3MpID0+IFxyXG4gICAgbG9nKFxyXG4gICAgICAgIC4uLmFyZ3MubWFwKFxyXG4gICAgICAgICAgICAoaXRlbSkgPT4gXHJcbiAgICAgICAgICAgICAgICB0eXBlb2YgaXRlbSA9PT0gYHN0cmluZ2BcclxuICAgICAgICAgICAgICAgICAgICA/IGMuZ3JlZW4oXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGl0ZW0ucmVwbGFjZSgvKFxcWy5bXlxcXVxcW10qXFxdKS91ZywgYy5ib2xkLndoaXRlKGAkMWApKVxyXG4gICAgICAgICAgICAgICAgICAgIClcclxuICAgICAgICAgICAgICAgICAgICA6IGl0ZW1cclxuICAgICAgICApXHJcbiAgICApO1xyXG4iLCIjIS91c3IvYmluL2VudiBub2RlXHJcblxyXG5pbXBvcnQgdm9ycGFsIGZyb20gXCJ2b3JwYWxcIjtcclxuaW1wb3J0IGNvbW1hbmRzIGZyb20gXCIuL2NvbW1hbmRzLyouanNcIjtcclxuaW1wb3J0IHsgdmVyc2lvbiB9IGZyb20gXCIuLi9wYWNrYWdlLmpzb25cIjtcclxuXHJcbmltcG9ydCBcIi4vbGliL2Zvcm1hdC5qc1wiO1xyXG5cclxuaW1wb3J0IGNoYWxrIGZyb20gXCJjaGFsa1wiO1xyXG5cclxuY29uc3QgdiA9IHZvcnBhbCgpO1xyXG5wcm9jZXNzLnN0ZG91dC53cml0ZShgXFx4MUJjYCk7XHJcblxyXG5jb25zb2xlLmxvZyhjaGFsay5ncmVlbihgXHJcbuKWiOKWiOKVl+KWiOKWiOKWiOKWiOKWiOKWiOKWiOKVl+KWiOKWiOKWiOKWiOKWiOKWiOKWiOKVl+KWiOKWiOKVlyAg4paI4paI4pWXIOKWiOKWiOKWiOKWiOKWiOKVlyDilojilojilZcgICAgICDilojilojilojilojilojilojilojilZfilojilojilojilZcgICDilojilojilZcg4paI4paI4paI4paI4paI4paI4pWXIOKWiOKWiOKVl+KWiOKWiOKWiOKVlyAgIOKWiOKWiOKVl+KWiOKWiOKWiOKWiOKWiOKWiOKWiOKVlyAgICBcclxu4paI4paI4pWR4paI4paI4pWU4pWQ4pWQ4pWQ4pWQ4pWd4paI4paI4pWU4pWQ4pWQ4pWQ4pWQ4pWd4paI4paI4pWRIOKWiOKWiOKVlOKVneKWiOKWiOKVlOKVkOKVkOKWiOKWiOKVl+KWiOKWiOKVkeKWhCDilojilojilZfiloTilojilojilZTilZDilZDilZDilZDilZ3ilojilojilojilojilZcgIOKWiOKWiOKVkeKWiOKWiOKVlOKVkOKVkOKVkOKVkOKVnSDilojilojilZHilojilojilojilojilZcgIOKWiOKWiOKVkeKWiOKWiOKVlOKVkOKVkOKVkOKVkOKVnSAgICBcclxu4paI4paI4pWR4paI4paI4paI4paI4paI4paI4paI4pWX4paI4paI4paI4paI4paI4pWXICDilojilojilojilojilojilZTilZ0g4paI4paI4paI4paI4paI4paI4paI4pWR4paI4paI4pWRIOKWiOKWiOKWiOKWiOKVl+KWiOKWiOKWiOKWiOKWiOKVlyAg4paI4paI4pWU4paI4paI4pWXIOKWiOKWiOKVkeKWiOKWiOKVkSAg4paI4paI4paI4pWX4paI4paI4pWR4paI4paI4pWU4paI4paI4pWXIOKWiOKWiOKVkeKWiOKWiOKWiOKWiOKWiOKVlyAgICAgIFxyXG7ilojilojilZHilZrilZDilZDilZDilZDilojilojilZHilojilojilZTilZDilZDilZ0gIOKWiOKWiOKVlOKVkOKWiOKWiOKVlyDilojilojilZTilZDilZDilojilojilZHilojilojilZHiloDilZrilojilojilZTiloDilojilojilZTilZDilZDilZ0gIOKWiOKWiOKVkeKVmuKWiOKWiOKVl+KWiOKWiOKVkeKWiOKWiOKVkSAgIOKWiOKWiOKVkeKWiOKWiOKVkeKWiOKWiOKVkeKVmuKWiOKWiOKVl+KWiOKWiOKVkeKWiOKWiOKVlOKVkOKVkOKVnSAgICAgIFxyXG7ilojilojilZHilojilojilojilojilojilojilojilZHilojilojilojilojilojilojilojilZfilojilojilZEgIOKWiOKWiOKVl+KWiOKWiOKVkSAg4paI4paI4pWR4paI4paI4pWRICDilZrilZDilZ0g4paI4paI4paI4paI4paI4paI4paI4pWX4paI4paI4pWRIOKVmuKWiOKWiOKWiOKWiOKVkeKVmuKWiOKWiOKWiOKWiOKWiOKWiOKVlOKVneKWiOKWiOKVkeKWiOKWiOKVkSDilZrilojilojilojilojilZHilojilojilojilojilojilojilojilZcgICAgXHJcbuKVmuKVkOKVneKVmuKVkOKVkOKVkOKVkOKVkOKVkOKVneKVmuKVkOKVkOKVkOKVkOKVkOKVkOKVneKVmuKVkOKVnSAg4pWa4pWQ4pWd4pWa4pWQ4pWdICDilZrilZDilZ3ilZrilZDilZ0gICAgICDilZrilZDilZDilZDilZDilZDilZDilZ3ilZrilZDilZ0gIOKVmuKVkOKVkOKVkOKVnSDilZrilZDilZDilZDilZDilZDilZ0g4pWa4pWQ4pWd4pWa4pWQ4pWdICDilZrilZDilZDilZDilZ3ilZrilZDilZDilZDilZDilZDilZDilZ0gICAgXHJcblZFUlNJT046ICR7dmVyc2lvbn0gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxyXG5gKSk7XHJcblxyXG5cclxuT2JqZWN0LmVudHJpZXMoY29tbWFuZHMpLlxyXG4gICAgZm9yRWFjaCgoW1xyXG4gICAgICAgIG5hbWUsIHtcclxuICAgICAgICAgICAgaGVscCxcclxuICAgICAgICAgICAgaGFuZGxlcixcclxuICAgICAgICAgICAgYXV0b2NvbXBsZXRlLFxyXG4gICAgICAgICAgICBoaWRkZW4sXHJcbiAgICAgICAgICAgIGNvbW1hbmQsXHJcbiAgICAgICAgICAgIGFsaWFzID0gW10sXHJcbiAgICAgICAgICAgIGNhbmNlbCA9ICgpID0+IHt9XHJcbiAgICAgICAgfVxyXG4gICAgXSkgPT4geyBcclxuICAgICAgICBjb25zdCBpc3QgPSB2LmNvbW1hbmQoY29tbWFuZCB8fCBuYW1lLCBoZWxwKS5cclxuICAgICAgICAgICAgYWxpYXMoYWxpYXMpLlxyXG4gICAgICAgICAgICBhdXRvY29tcGxldGUoYXV0b2NvbXBsZXRlIHx8IFtdKS5cclxuICAgICAgICAgICAgY2FuY2VsKGNhbmNlbCkuXHJcbiAgICAgICAgICAgIGFjdGlvbihoYW5kbGVyKTtcclxuXHJcbiAgICAgICAgaWYoaGlkZGVuKSB7XHJcbiAgICAgICAgICAgIGlzdC5oaWRkZW4oKTtcclxuICAgICAgICB9XHJcbiAgICB9KTtcclxuXHJcblxyXG5jb25zdCBzdGFydHVwX2NvbW1hbmRzID0gcHJvY2Vzcy5hcmd2LnNsaWNlKDIpO1xyXG5cclxuc3RhcnR1cF9jb21tYW5kcy5yZWR1Y2UoKHByZXYsIGN1cikgPT4gXHJcbiAgICBwcmV2LnRoZW4oKCkgPT4gXHJcbiAgICAgICAgdi5leGVjKGN1cikpLCBQcm9taXNlLnJlc29sdmUoKVxyXG4pLlxyXG4gICAgdGhlbigoKSA9PiB7XHJcbiAgICAgICAgaWYoc3RhcnR1cF9jb21tYW5kcy5sZW5ndGggPiAwKSB7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgdi5kZWxpbWl0ZXIoY2hhbGsuYm9sZC5ncmVlbihgPmApKS5cclxuICAgICAgICAgICAgc2hvdygpO1xyXG4gICAgfSk7XHJcblxyXG4iXSwibmFtZXMiOlsic3Bhd24iLCJwbTIiLCJjcmVhdGVGaWx0ZXIiLCJnbG9iIiwidG9tbCIsInRlcnNlciIsIndhdGNoIiwiZXhlYyIsImNoYWxrIiwidmVyc2lvbiIsImNvbW1hbmRzIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBO0FBQ0E7QUFFQSxTQUFlLENBQUM7SUFDWixPQUFPLEVBQUUsQ0FBQyxpQkFBaUIsQ0FBQzs7SUFFNUIsSUFBSSxFQUFFLENBQUMscUJBQXFCLENBQUM7SUFDN0IsTUFBTSxFQUFFLElBQUk7O0lBRVosTUFBTSxHQUFHO1FBQ0wsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUU7WUFDWCxPQUFPO1NBQ1Y7O1FBRUQsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQztLQUNwQjs7SUFFRCxPQUFPLENBQUMsRUFBRSxRQUFRLEVBQUUsRUFBRSxFQUFFLEVBQUU7UUFDdEIsR0FBRyxDQUFDLFFBQVEsRUFBRTtZQUNWLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQyxxQ0FBcUMsQ0FBQyxDQUFDLENBQUM7O1lBRXJELE9BQU8sRUFBRSxFQUFFLENBQUM7U0FDZjs7UUFFRCxPQUFPLElBQUksT0FBTyxDQUFDLENBQUMsT0FBTyxLQUFLO1lBQzVCLElBQUksQ0FBQyxJQUFJLEdBQUdBLG1CQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLEVBQUUsU0FBUyxDQUFDLDZCQUE2QixFQUFFLFFBQVEsQ0FBQyxJQUFJLENBQUMs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
