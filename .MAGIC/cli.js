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
    help: `excute a pm2 command`,
    hidden: true,
    handler: ({ commands }) => 
        child_process.spawn(`node`, `${__dirname}/../node_modules/pm2/bin/pm2 ${commands.join(` `)}`.split(` `), {
            env: process.env,
            stdio: `inherit`
        })
});

var f0 = ({
    command: `active`,
    help: `Show active [CLASS] files.`,
    handler: () => {
        f3.handler({
            commands: [ `ps` ]
        });
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
            console.log(`[${name}] ${config.NODE ? `NODE` : `BROWSER`} build started.`);

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
[${name}]
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
    command: `build [classes...]`,
    help: `build all [CLASS] files.`,
    autocomplete: get_list(),
    hidden: true,
    handler: ({ classes = get_list() }) => 
        filter_list(classes)(async (target) => {
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
    command: `logs [targets...]`,
    help: `follow the logs`,
    handler: () => 
        new Promise(() => 
            f3.handler({
                commands: [ `logs` ]
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
        CLASS.forEach((name) => {
            const {
                output,
            } = toml_to_js(`./CLASS/${name}.toml`);
    
            pm2.start({
                name,
                script: output,
                watch: true,
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
    console.log(`PRESS [CTRL+C] TO QUIT YOUR WATCH`);

var f7 = ({
    command: `watch [classes...]`,
    help: `watch [CLASS] files for changes and rebuild.`,
    hidden: true,
    cancel () {
        this.watchers.forEach((watcher) => 
            watcher.close());
        console.log(`WATCH STOPPED`);
    },
    handler({ classes = get_list() }, cb) {
        watch_prompt();

        return new Promise((resolve) => {
            this.watchers = [];
            
            filter_list(classes)((target) => {
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
        f7.handler(data);
        f5.handler(data);
        f3.handler({
            commands: [ `logs` ]
        });
    },
    cancel: () => {
        f7.cancel();
    }
});

const res = {};
res["active"] = f0;
res["build"] = f1;
res["logs"] = f2;
res["pm2"] = f3;
res["shop"] = f4;
res["spawn"] = f5;
res["start"] = f6;
res["watch"] = f7;

var version$1 = "0.0.1";

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

v.delimiter(c.bold.green(`>`)).
    show();
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2xpLmpzIiwic291cmNlcyI6WyIuLi9zcmMvY29tbWFuZHMvcG0yLmpzIiwiLi4vc3JjL2NvbW1hbmRzL2FjdGl2ZS5qcyIsIi4uL3NyYy9yb2xsdXAvcGx1Z2luLWdsb2IuanMiLCIuLi9zcmMvcm9sbHVwL3ZlcnNpb24uanMiLCIuLi9zcmMvcm9sbHVwL2J1aWxkZXJzLmpzIiwiLi4vc3JjL3RyYW5zZm9ybXMvdG9tbF90b19qcy5qcyIsIi4uL3NyYy9saWIvZ2V0X2xpc3QuanMiLCIuLi9zcmMvbGliL2ZpbHRlcl9saXN0LmpzIiwiLi4vc3JjL2NvbW1hbmRzL2J1aWxkLmpzIiwiLi4vc3JjL2NvbW1hbmRzL2xvZ3MuanMiLCIuLi9zcmMvY29tbWFuZHMvc2hvcC5qcyIsIi4uL3NyYy9jb21tYW5kcy9zcGF3bi5qcyIsIi4uL3NyYy9saWIvYWN0aW9uLmpzIiwiLi4vc3JjL2NvbW1hbmRzL3dhdGNoLmpzIiwiLi4vc3JjL2NvbW1hbmRzL3N0YXJ0LmpzIiwiLi4vNGVlNDk1ZmIxODBlMmI0YTY1YTdjMTUyNjA5OGJiMGQiLCIuLi9zcmMvbGliL2Zvcm1hdC5qcyIsIi4uL3NyYy9jbGkuanMiXSwic291cmNlc0NvbnRlbnQiOlsiLy8gcGlwZSBvdXQgdG8gcG0yXHJcbmltcG9ydCB7IHNwYXduIH0gZnJvbSBcImNoaWxkX3Byb2Nlc3NcIjtcclxuXHJcbmV4cG9ydCBkZWZhdWx0ICh7XHJcbiAgICBjb21tYW5kOiBgcG0yIFtjb21tYW5kcy4uLl1gLFxyXG4gICAgaGVscDogYGV4Y3V0ZSBhIHBtMiBjb21tYW5kYCxcclxuICAgIGhpZGRlbjogdHJ1ZSxcclxuICAgIGhhbmRsZXI6ICh7IGNvbW1hbmRzIH0pID0+IFxyXG4gICAgICAgIHNwYXduKGBub2RlYCwgYCR7X19kaXJuYW1lfS8uLi9ub2RlX21vZHVsZXMvcG0yL2Jpbi9wbTIgJHtjb21tYW5kcy5qb2luKGAgYCl9YC5zcGxpdChgIGApLCB7XHJcbiAgICAgICAgICAgIGVudjogcHJvY2Vzcy5lbnYsXHJcbiAgICAgICAgICAgIHN0ZGlvOiBgaW5oZXJpdGBcclxuICAgICAgICB9KVxyXG59KTsiLCJpbXBvcnQgcG0yIGZyb20gXCIuL3BtMi5qc1wiO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQoe1xyXG4gICAgY29tbWFuZDogYGFjdGl2ZWAsXHJcbiAgICBoZWxwOiBgU2hvdyBhY3RpdmUgW0NMQVNTXSBmaWxlcy5gLFxyXG4gICAgaGFuZGxlcjogKCkgPT4ge1xyXG4gICAgICAgIHBtMi5oYW5kbGVyKHtcclxuICAgICAgICAgICAgY29tbWFuZHM6IFsgYHBzYCBdXHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcbn0pOyIsIlxyXG5pbXBvcnQgZnMgZnJvbSBcImZzXCI7XHJcbmltcG9ydCBvcyBmcm9tIFwib3NcIjtcclxuaW1wb3J0IGdsb2IgZnJvbSBcImdsb2JcIjtcclxuaW1wb3J0IHBhdGggZnJvbSBcInBhdGhcIjtcclxuaW1wb3J0IG1kNSBmcm9tIFwibWQ1XCI7XHJcblxyXG5pbXBvcnQgeyBjcmVhdGVGaWx0ZXIgfSBmcm9tIFwicm9sbHVwLXBsdWdpbnV0aWxzXCI7XHJcblxyXG5jb25zdCBnZXRGU1ByZWZpeCA9IChwcmVmaXggPSBwcm9jZXNzLmN3ZCgpKSA9PiB7XHJcbiAgICBjb25zdCBwYXJlbnQgPSBwYXRoLmpvaW4ocHJlZml4LCBgLi5gKTtcclxuICAgIGlmIChwYXJlbnQgPT09IHByZWZpeCkge1xyXG4gICAgICAgIHJldHVybiBwcmVmaXg7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIHJldHVybiBnZXRGU1ByZWZpeChwYXJlbnQpO1xyXG59O1xyXG5cclxuY29uc3QgZnNQcmVmaXggPSBnZXRGU1ByZWZpeCgpO1xyXG5jb25zdCByb290UGF0aCA9IHBhdGguam9pbihgL2ApO1xyXG5cclxuY29uc3QgdG9VUkxTdHJpbmcgPSAoZmlsZVBhdGgpID0+IHtcclxuICAgIGNvbnN0IHBhdGhGcmFnbWVudHMgPSBwYXRoLmpvaW4oZmlsZVBhdGgpLlxyXG4gICAgICAgIHJlcGxhY2UoZnNQcmVmaXgsIHJvb3RQYXRoKS5cclxuICAgICAgICBzcGxpdChwYXRoLnNlcCk7XHJcbiAgICBpZiAoIXBhdGguaXNBYnNvbHV0ZShmaWxlUGF0aCkpIHtcclxuICAgICAgICBwYXRoRnJhZ21lbnRzLnVuc2hpZnQoYC5gKTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgcmV0dXJuIHBhdGhGcmFnbWVudHMuam9pbihgL2ApO1xyXG59O1xyXG5cclxuY29uc3QgcmVzb2x2ZU5hbWUgPSAoZnJvbSkgPT4gXHJcbiAgICBmcm9tLnNwbGl0KGAvYCkuXHJcbiAgICAgICAgcG9wKCkuXHJcbiAgICAgICAgc3BsaXQoYC5gKS5cclxuICAgICAgICBzaGlmdCgpO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgKHsgXHJcbiAgICBpbmNsdWRlLCBcclxuICAgIGV4Y2x1ZGUgXHJcbn0gPSBmYWxzZSkgPT4ge1xyXG4gICAgY29uc3QgZmlsdGVyID0gY3JlYXRlRmlsdGVyKGluY2x1ZGUsIGV4Y2x1ZGUpO1xyXG4gICAgXHJcbiAgICByZXR1cm4ge1xyXG4gICAgICAgIG5hbWU6IGByb2xsdXAtZ2xvYmAsXHJcbiAgICAgICAgbG9hZDogKGlkKSA9PiB7XHJcbiAgICAgICAgICAgIGNvbnN0IHNyY0ZpbGUgPSBwYXRoLmpvaW4ob3MudG1wZGlyKCksIGlkKTtcclxuXHJcbiAgICAgICAgICAgIGxldCBvcHRpb25zO1xyXG4gICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgb3B0aW9ucyA9IEpTT04ucGFyc2UoZnMucmVhZEZpbGVTeW5jKHNyY0ZpbGUpKTtcclxuICAgICAgICAgICAgfSBjYXRjaChlcnIpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgY29uc3QgeyBpbXBvcnRlZSwgaW1wb3J0ZXIgfSA9IG9wdGlvbnM7XHJcblxyXG4gICAgICAgICAgICBjb25zdCBpbXBvcnRlZUlzQWJzb2x1dGUgPSBwYXRoLmlzQWJzb2x1dGUoaW1wb3J0ZWUpO1xyXG4gICAgICAgICAgICBjb25zdCBjd2QgPSBwYXRoLmRpcm5hbWUoaW1wb3J0ZXIpO1xyXG4gICAgICAgICAgICBjb25zdCBnbG9iUGF0dGVybiA9IGltcG9ydGVlO1xyXG5cclxuICAgICAgICAgICAgY29uc3QgZmlsZXMgPSBnbG9iLnN5bmMoZ2xvYlBhdHRlcm4sIHtcclxuICAgICAgICAgICAgICAgIGN3ZFxyXG4gICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgIGxldCBjb2RlID0gWyBgY29uc3QgcmVzID0ge307YCBdO1xyXG4gICAgICAgICAgICBsZXQgaW1wb3J0QXJyYXkgPSBbXTtcclxuXHJcbiAgICAgICAgICAgIGZpbGVzLmZvckVhY2goKGZpbGUsIGkpID0+IHtcclxuICAgICAgICAgICAgICAgIGxldCBmcm9tO1xyXG4gICAgICAgICAgICAgICAgaWYgKGltcG9ydGVlSXNBYnNvbHV0ZSkge1xyXG4gICAgICAgICAgICAgICAgICAgIGZyb20gPSB0b1VSTFN0cmluZyhmaWxlKTtcclxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgZnJvbSA9IHRvVVJMU3RyaW5nKHBhdGgucmVzb2x2ZShjd2QsIGZpbGUpKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGNvZGUucHVzaChgaW1wb3J0IGYke2l9IGZyb20gXCIke2Zyb219XCI7YCk7XHJcbiAgICAgICAgICAgICAgICBjb2RlLnB1c2goYHJlc1tcIiR7cmVzb2x2ZU5hbWUoZnJvbSl9XCJdID0gZiR7aX07YCk7XHJcbiAgICAgICAgICAgICAgICBpbXBvcnRBcnJheS5wdXNoKGZyb20pO1xyXG4gICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgIGNvZGUucHVzaChgZXhwb3J0IGRlZmF1bHQgcmVzO2ApO1xyXG5cclxuICAgICAgICAgICAgY29kZSA9IGNvZGUuam9pbihgXFxuYCk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgICAgIHJldHVybiBjb2RlO1xyXG5cclxuICAgICAgICB9LFxyXG4gICAgICAgIHJlc29sdmVJZDogKGltcG9ydGVlLCBpbXBvcnRlcikgPT4ge1xyXG4gICAgICAgICAgICBpZiAoIWZpbHRlcihpbXBvcnRlZSkgfHwgIWltcG9ydGVlLmluY2x1ZGVzKGAqYCkpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgY29uc3QgaGFzaCA9IG1kNShpbXBvcnRlZSArIGltcG9ydGVyKTtcclxuXHJcbiAgICAgICAgICAgIGZzLndyaXRlRmlsZVN5bmMocGF0aC5qb2luKG9zLnRtcGRpcigpLCBoYXNoKSwgSlNPTi5zdHJpbmdpZnkoe1xyXG4gICAgICAgICAgICAgICAgaW1wb3J0ZWUsXHJcbiAgICAgICAgICAgICAgICBpbXBvcnRlclxyXG4gICAgICAgICAgICB9KSk7XHJcblxyXG4gICAgICAgICAgICByZXR1cm4gaGFzaDtcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG59OyIsImltcG9ydCBmcyBmcm9tIFwiZnNcIjtcclxuXHJcbmV4cG9ydCBkZWZhdWx0ICh7XHJcbiAgICBwYXRoLFxyXG4gICAgdmVyc2lvblxyXG59KSA9PiBcclxuICAgICh7XHJcbiAgICAgICAgbmFtZTogYHJvbGx1cC13cml0ZWAsXHJcbiAgICAgICAgYnVpbGRTdGFydDogKCkgPT4ge1xyXG4gICAgICAgICAgICBmcy53cml0ZUZpbGVTeW5jKHBhdGgsIHZlcnNpb24oKSk7XHJcbiAgICAgICAgfVxyXG4gICAgfSk7IiwiaW1wb3J0IHRvbWwgZnJvbSBcInJvbGx1cC1wbHVnaW4tdG9tbFwiO1xyXG5cclxuXHJcbmltcG9ydCBzdmVsdGUgZnJvbSBcInJvbGx1cC1wbHVnaW4tc3ZlbHRlXCI7XHJcbmltcG9ydCByZXNvbHZlIGZyb20gXCJyb2xsdXAtcGx1Z2luLW5vZGUtcmVzb2x2ZVwiO1xyXG5pbXBvcnQgY29weSBmcm9tIFwicm9sbHVwLXBsdWdpbi1jb3B5LWdsb2JcIjtcclxuaW1wb3J0IHJlcGxhY2UgZnJvbSBcInJvbGx1cC1wbHVnaW4tcmVwbGFjZVwiO1xyXG5cclxuaW1wb3J0IGpzb24gZnJvbSBcInJvbGx1cC1wbHVnaW4tanNvblwiO1xyXG5pbXBvcnQgbWQgZnJvbSBcInJvbGx1cC1wbHVnaW4tY29tbW9ubWFya1wiO1xyXG5pbXBvcnQgY2pzIGZyb20gXCJyb2xsdXAtcGx1Z2luLWNvbW1vbmpzXCI7XHJcblxyXG5pbXBvcnQgeyB0ZXJzZXIgfSBmcm9tIFwicm9sbHVwLXBsdWdpbi10ZXJzZXJcIjtcclxuaW1wb3J0IHV1aWQgZnJvbSBcInV1aWQvdjFcIjtcclxuXHJcbi8qXHJcbiAqIGltcG9ydCBzcHJpdGVzbWl0aCBmcm9tIFwicm9sbHVwLXBsdWdpbi1zcHJpdGVcIjtcclxuICogaW1wb3J0IHRleHR1cmVQYWNrZXIgZnJvbSBcInNwcml0ZXNtaXRoLXRleHR1cmVwYWNrZXJcIjtcclxuICovXHJcblxyXG5pbXBvcnQgZ2xvYiBmcm9tIFwiLi9wbHVnaW4tZ2xvYi5qc1wiO1xyXG5pbXBvcnQgdmVyc2lvbiBmcm9tIFwiLi92ZXJzaW9uLmpzXCI7XHJcblxyXG5jb25zdCBDT0RFX1ZFUlNJT04gPSB1dWlkKCk7XHJcbmNvbnN0IHByb2R1Y3Rpb24gPSAhcHJvY2Vzcy5lbnYuUk9MTFVQX1dBVENIO1xyXG5cclxuY29uc3QgZG9fY29weSA9IChjb3B5T2JqZWN0KSA9PiBcclxuICAgIGNvcHkoT2JqZWN0LmtleXMoY29weU9iamVjdCkuXHJcbiAgICAgICAgbWFwKFxyXG4gICAgICAgICAgICAoa2V5KSA9PiBcclxuICAgICAgICAgICAgICAgICh7XHJcbiAgICAgICAgICAgICAgICAgICAgZmlsZXM6IGtleSxcclxuICAgICAgICAgICAgICAgICAgICBkZXN0OiBjb3B5T2JqZWN0W2tleV1cclxuICAgICAgICAgICAgICAgIH0pXHJcbiAgICAgICAgKSk7XHJcblxyXG5sZXQgQ0xJRU5UX1ZFUlNJT04gPSB1dWlkKCk7XHJcblxyXG5jb25zdCBleHRlcm5hbCA9IFtcclxuICAgIGBleHByZXNzYCxcclxuICAgIGBpc2VrYWlgLFxyXG4gICAgYGZzYCxcclxuICAgIGBodHRwYCxcclxuICAgIGBodHRwc2BcclxuXTtcclxuXHJcbmNvbnN0IG5vZGUgPSAoe1xyXG4gICAgaW5wdXQsXHJcbiAgICBvdXRwdXQsXHJcbiAgICBjb3B5OiBjb3B5T2JqZWN0ID0ge31cclxufSkgPT4gXHJcbiAgICAoe1xyXG4gICAgICAgIGlucHV0LFxyXG4gICAgICAgIG91dHB1dDoge1xyXG4gICAgICAgICAgICBzb3VyY2VtYXA6IGBpbmxpbmVgLFxyXG4gICAgICAgICAgICBmaWxlOiBvdXRwdXQsXHJcbiAgICAgICAgICAgIGZvcm1hdDogYGNqc2AsXHJcbiAgICAgICAgfSxcclxuICAgICAgICBleHRlcm5hbCxcclxuICAgICAgICBwbHVnaW5zOiBbXHJcbiAgICAgICAgICAgIGdsb2IoKSxcclxuICAgICAgICAgICAgcmVwbGFjZSh7XHJcbiAgICAgICAgICAgICAgICBDT0RFX1ZFUlNJT04sXHJcbiAgICAgICAgICAgIH0pLFxyXG4gICAgICAgICAgICBtZCgpLFxyXG4gICAgICAgICAgICBkb19jb3B5KGNvcHlPYmplY3QpLFxyXG4gICAgICAgICAgICB0b21sXHJcbiAgICAgICAgXSxcclxuICAgIH0pO1xyXG5cclxuY29uc3QgYnJvd3NlciA9ICh7XHJcbiAgICBpbnB1dCxcclxuICAgIG91dHB1dCxcclxuICAgIGNzczogY3NzUGF0aCxcclxuICAgIGNvcHk6IGNvcHlPYmplY3QsXHJcbn0pID0+IFxyXG4gICAgKHtcclxuICAgICAgICBpbnB1dCxcclxuICAgICAgICBvdXRwdXQ6IHtcclxuICAgICAgICAgICAgZmlsZTogb3V0cHV0LFxyXG4gICAgICAgICAgICBmb3JtYXQ6IGBpaWZlYCxcclxuICAgICAgICB9LFxyXG4gICAgICAgIGV4dGVybmFsOiBbIGB1dWlkYCwgYHV1aWQvdjFgLCBgcGl4aS5qc2AgXSxcclxuICAgICAgICBwbHVnaW5zOiBbXHJcbiAgICAgICAgLy8gLy8gbWFrZSB0aGlzIGEgcmVhY3RpdmUgcGx1Z2luIHRvIFwiLnRpbGVtYXAuanNvblwiXHJcbiAgICAgICAgLy8gICAgIHNwcml0ZXNtaXRoKHtcclxuICAgICAgICAvLyAgICAgICAgIHNyYzoge1xyXG4gICAgICAgIC8vICAgICAgICAgICAgIGN3ZDogXCIuL2dvYmxpbi5saWZlL0JST1dTRVIuUElYSS9cclxuICAgICAgICAvLyAgICAgICAgICAgICBnbG9iOiBcIioqLyoucG5nXCJcclxuICAgICAgICAvLyAgICAgICAgIH0sXHJcbiAgICAgICAgLy8gICAgICAgICB0YXJnZXQ6IHtcclxuICAgICAgICAvLyAgICAgICAgICAgICBpbWFnZTogXCIuL2Jpbi9wdWJsaWMvaW1hZ2VzL3Nwcml0ZS5wbmdcIixcclxuICAgICAgICAvLyAgICAgICAgICAgICBjc3M6IFwiLi9iaW4vcHVibGljL2FydC9kZWZhdWx0Lmpzb25cIlxyXG4gICAgICAgIC8vICAgICAgICAgfSxcclxuICAgICAgICAvLyAgICAgICAgIG91dHB1dDoge1xyXG4gICAgICAgIC8vICAgICAgICAgICAgIGltYWdlOiBcIi4vYmluL3B1YmxpYy9pbWFnZXMvc3ByaXRlLnBuZ1wiXHJcbiAgICAgICAgLy8gICAgICAgICB9LFxyXG4gICAgICAgIC8vICAgICAgICAgc3ByaXRlc21pdGhPcHRpb25zOiB7XHJcbiAgICAgICAgLy8gICAgICAgICAgICAgcGFkZGluZzogMFxyXG4gICAgICAgIC8vICAgICAgICAgfSxcclxuICAgICAgICAvLyAgICAgICAgIGN1c3RvbVRlbXBsYXRlOiB0ZXh0dXJlUGFja2VyXHJcbiAgICAgICAgLy8gICAgIH0pLFxyXG4gICAgICAgICAgICBnbG9iKCksXHJcbiAgICAgICAgICAgIGNqcyh7XHJcbiAgICAgICAgICAgICAgICBpbmNsdWRlOiBgbm9kZV9tb2R1bGVzLyoqYCwgXHJcbiAgICAgICAgICAgIH0pLFxyXG4gICAgICAgICAgICBqc29uKCksXHJcbiAgICAgICAgICAgIHJlcGxhY2Uoe1xyXG4gICAgICAgICAgICAgICAgQ09ERV9WRVJTSU9OLFxyXG4gICAgICAgICAgICAgICAgQ0xJRU5UX1ZFUlNJT046ICgpID0+IFxyXG4gICAgICAgICAgICAgICAgICAgIENMSUVOVF9WRVJTSU9OXHJcbiAgICAgICAgICAgIH0pLFxyXG4gICAgICAgICAgICB0b21sLFxyXG4gICAgICAgICAgICBtZCgpLFxyXG4gICAgICAgICAgICBzdmVsdGUoe1xyXG4gICAgICAgICAgICAgICAgY3NzOiAoY3NzKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgY3NzLndyaXRlKGNzc1BhdGgpO1xyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgfSksXHJcbiAgICAgICAgICAgIHJlc29sdmUoKSxcclxuICAgICAgICAgICAgcHJvZHVjdGlvbiAmJiB0ZXJzZXIoKSxcclxuICAgICAgICAgICAgZG9fY29weShjb3B5T2JqZWN0KSxcclxuICAgICAgICAgICAgdmVyc2lvbih7XHJcbiAgICAgICAgICAgICAgICBwYXRoOiBgLi8uTUFHSUMvY2xpZW50LnZlcnNpb25gLFxyXG4gICAgICAgICAgICAgICAgdmVyc2lvbjogKCkgPT4gXHJcbiAgICAgICAgICAgICAgICAgICAgQ0xJRU5UX1ZFUlNJT05cclxuICAgICAgICAgICAgfSlcclxuICAgICAgICBdXHJcbiAgICB9KTtcclxuXHJcbmV4cG9ydCBkZWZhdWx0IHtcclxuICAgIG5vZGUsXHJcbiAgICBicm93c2VyXHJcbn07IiwiaW1wb3J0IGZzIGZyb20gXCJmc1wiO1xyXG5pbXBvcnQgdG9tbCBmcm9tIFwidG9tbFwiO1xyXG5pbXBvcnQgcGF0aCBmcm9tIFwicGF0aFwiO1xyXG5pbXBvcnQgZ2xvYiBmcm9tIFwiZ2xvYlwiO1xyXG5pbXBvcnQgYyBmcm9tIFwiY2hhbGtcIjtcclxuaW1wb3J0IGJ1aWxkZXJzIGZyb20gXCIuLi9yb2xsdXAvYnVpbGRlcnMuanNcIjtcclxuXHJcbmMuZW5hYmxlZCA9IHRydWU7XHJcbmMubGV2ZWwgPSAzO1xyXG5cclxuY29uc3QgbG9nX2VxdWlwID0gKGVxdWlwKSA9PiBcclxuICAgIGMueWVsbG93KGVxdWlwKTtcclxuXHJcbmV4cG9ydCBkZWZhdWx0IChjb25maWdGaWxlKSA9PiBcclxuICAgIC8vIE1peCBDb25maWcgRmlsZSBpbiBhbmQgcnVuIHRoZXNlIGluIG9yZGVyXHJcbiAgICBPYmplY3QudmFsdWVzKHtcclxuICAgICAgICBnYXRoZXJfZXF1aXBtZW50OiAoKSA9PiBcclxuICAgICAgICAgICAgKHtcclxuICAgICAgICAgICAgICAgIEVRVUlQTUVOVDogZ2xvYi5zeW5jKGAuL1NIT1AvKi9gKS5cclxuICAgICAgICAgICAgICAgICAgICByZWR1Y2UoKG9iaiwgZXF1aXBfcGF0aCkgPT4gXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICh7IFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgW3BhdGguYmFzZW5hbWUoZXF1aXBfcGF0aCldOiB0cnVlLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLi4ub2JqIFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB9KSwge30pXHJcbiAgICAgICAgICAgIH0pLFxyXG4gICAgICAgIHJlYWRfY29uZmlnOiAoe1xyXG4gICAgICAgICAgICBjb25maWdGaWxlLFxyXG4gICAgICAgIH0pID0+IHtcclxuICAgICAgICAvLyB2ZXJpZnkgdG9tbCBleGlzdHNcclxuICAgICAgICAgICAgbGV0IHJhdztcclxuXHJcbiAgICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgICAgICByYXcgPSBmcy5yZWFkRmlsZVN5bmMoY29uZmlnRmlsZSwgYHV0Zi04YCk7XHJcbiAgICAgICAgICAgIH0gY2F0Y2ggKGV4Y2VwdGlvbikge1xyXG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBDb3VsZG4ndCByZWFkICR7Y29uZmlnRmlsZX0uIEFyZSB5b3Ugc3VyZSB0aGlzIHBhdGggaXMgY29ycmVjdD9gKTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgY29uc3QgY29uZmlnID0gdG9tbC5wYXJzZShyYXcpO1xyXG5cclxuICAgICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgICAgIGNvbmZpZyxcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICB9LFxyXG5cclxuICAgICAgICBzZXRfbmFtZXM6ICh7XHJcbiAgICAgICAgICAgIGNvbmZpZ0ZpbGUsXHJcbiAgICAgICAgICAgIGNvbmZpZ1xyXG4gICAgICAgIH0pID0+IHtcclxuICAgICAgICAgICAgY29uc3QgbmFtZSA9IHBhdGguYmFzZW5hbWUoY29uZmlnRmlsZSwgYC50b21sYCk7XHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbJHtuYW1lfV0gJHtjb25maWcuTk9ERSA/IGBOT0RFYCA6IGBCUk9XU0VSYH0gYnVpbGQgc3RhcnRlZC5gKTtcclxuXHJcbiAgICAgICAgICAgIGNvbnN0IHBhY2thZ2VfcGF0aCA9IHBhdGguZGlybmFtZShwYXRoLnJlc29sdmUoY29uZmlnRmlsZSkpO1xyXG4gICAgICAgICAgICBjb25zdCBwYWNrYWdlX25hbWUgPSBwYWNrYWdlX3BhdGguXHJcbiAgICAgICAgICAgICAgICBzcGxpdChwYXRoLnNlcCkuXHJcbiAgICAgICAgICAgICAgICBwb3AoKTtcclxuXHJcbiAgICAgICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgICAgICBwYWNrYWdlX3BhdGgsXHJcbiAgICAgICAgICAgICAgICBwYWNrYWdlX25hbWUsXHJcbiAgICAgICAgICAgICAgICBuYW1lLFxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgIH0sXHJcblxyXG4gICAgICAgIHdyaXRlX2VudHJ5OiAoe1xyXG4gICAgICAgICAgICBjb25maWcsXHJcbiAgICAgICAgICAgIG5hbWUsXHJcbiAgICAgICAgICAgIEVRVUlQTUVOVCxcclxuICAgICAgICB9KSA9PiB7XHJcbiAgICAgICAgLy8gV1JJVEUgT1VUIEZJTEVcclxuICAgICAgICAgICAgbGV0IGVudHJ5ID0gYGA7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBjb25zdCB3cml0ZSA9IChkYXRhKSA9PiBcclxuICAgICAgICAgICAgICAgIGVudHJ5ICs9IGAke2RhdGF9XFxyXFxuYDtcclxuICAgICAgICBcclxuICAgICAgICAgICAgd3JpdGUoYGltcG9ydCBpc2VrYWkgZnJvbSBcImlzZWthaVwiO2ApO1xyXG4gICAgICAgICAgICB3cml0ZShgaXNla2FpLlNFVCgke0pTT04uc3RyaW5naWZ5KGNvbmZpZyl9KTtgKTtcclxuICAgICAgICAgICAgd3JpdGUoYGApO1xyXG4gICAgXHJcbiAgICAgICAgICAgIGNvbnN0IGVxdWlwZWQgPSBPYmplY3Qua2V5cyhjb25maWcpLlxyXG4gICAgICAgICAgICAgICAgZmlsdGVyKChrZXkpID0+IFxyXG4gICAgICAgICAgICAgICAgICAgIGtleSA9PT0ga2V5LnRvVXBwZXJDYXNlKCkgJiYgRVFVSVBNRU5UW2tleV0pLlxyXG4gICAgICAgICAgICAgICAgbWFwKChrZXkpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICB3cml0ZShgaW1wb3J0ICR7a2V5fSBmcm9tIFwiLi4vU0hPUC8ke2tleX0vaW5kZXguanNcIjtgKTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGtleTtcclxuICAgICAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgY29uc3Qga2V5cyA9IGVxdWlwZWQucmVkdWNlKChvdXRwdXQsIGtleSkgPT4gXHJcbiAgICAgICAgICAgICAgICBgJHtvdXRwdXR9ICAgICR7a2V5fSxcXHJcXG5gLCBgYCk7XHJcblxyXG4gICAgICAgICAgICB3cml0ZShgXHJcbmlzZWthaS5FUVVJUCh7XFxyXFxuJHtrZXlzfX0pO2ApO1xyXG5cclxuICAgICAgICAgICAgY29uc3QgaW5wdXQgPSBwYXRoLmpvaW4oYC5NQUdJQ2AsIGAke25hbWV9LmVudHJ5LmpzYCk7XHJcblxyXG4gICAgICAgICAgICAvLyB3cml0ZSBvdXQgdGhlaXIgaW5kZXguanNcclxuICAgICAgICAgICAgZnMud3JpdGVGaWxlU3luYyhpbnB1dCwgZW50cnksIGB1dGYtOGApO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgY29uc29sZS5sb2coYFxyXG5bJHtuYW1lfV1cclxuU0hPUDpcclxuJHtPYmplY3Qua2V5cyhFUVVJUE1FTlQpLlxyXG4gICAgICAgIG1hcChsb2dfZXF1aXApLlxyXG4gICAgICAgIGpvaW4oYCAtIGApfVxyXG5cclxuRVFVSVBQRUQ6XHJcbiR7Yy5yZWQoZXF1aXBlZC5qb2luKGAgLSBgKSl9XHJcbmApO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgICAgIGlucHV0XHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgfSxcclxuXHJcbiAgICAgICAgcnVuX2J1aWxkZXJzOiAoe1xyXG4gICAgICAgICAgICBpbnB1dCxcclxuICAgICAgICAgICAgbmFtZSxcclxuICAgICAgICAgICAgY29uZmlnLFxyXG4gICAgICAgIH0pID0+IHtcclxuICAgICAgICAgICAgY29uc3QgdGFyZ2V0ID0gY29uZmlnLk5PREUgXHJcbiAgICAgICAgICAgICAgICA/IGBOT0RFYCBcclxuICAgICAgICAgICAgICAgIDogYEJST1dTRVJgO1xyXG5cclxuICAgICAgICAgICAgY29uc3Qgb3V0cHV0ID0gYC5NQUdJQy8ke25hbWV9LiR7dGFyZ2V0fS5qc2A7XHJcblxyXG4gICAgICAgICAgICBpZihjb25maWcuTk9ERSAmJiBjb25maWcuQlJPV1NFUikge1xyXG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBZb3UgY2Fubm90IHRhcmdldCBib3RoIFtOT0RFXSBhbmQgW0JST1dTRVJdYCk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGlmKGNvbmZpZy5OT0RFKSB7ICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICAgICAgICAgIG91dHB1dCxcclxuICAgICAgICAgICAgICAgICAgICBidWlsZF9pbmZvOiBidWlsZGVycy5ub2RlKHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaW5wdXQsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG91dHB1dFxyXG4gICAgICAgICAgICAgICAgICAgIH0pXHJcbiAgICAgICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgICAgIGlmKGNvbmZpZy5CUk9XU0VSKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICAgICAgICAgIG91dHB1dCxcclxuICAgICAgICAgICAgICAgICAgICBidWlsZF9pbmZvOiBidWlsZGVycy5icm93c2VyKHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaW5wdXQsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG91dHB1dFxyXG4gICAgICAgICAgICAgICAgICAgIH0pXHJcbiAgICAgICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFlvdSBtdXN0IHNwZWNpZnkgZWl0aGVyIFtOT0RFXSBvciBbQlJPV1NFUl0gZm9yIHlvdXIgdGFyZ2V0YCk7XHJcbiAgICAgICAgfVxyXG4gICAgfSkuXHJcbiAgICAgICAgcmVkdWNlKChzdGF0ZSwgZm4pID0+IFxyXG4gICAgICAgICAgICAoe1xyXG4gICAgICAgICAgICAgICAgLi4uc3RhdGUsXHJcbiAgICAgICAgICAgICAgICAuLi5mbihzdGF0ZSlcclxuICAgICAgICAgICAgfSksIHsgY29uZmlnRmlsZSB9KTtcclxuIiwiaW1wb3J0IGdsb2IgZnJvbSBcImdsb2JcIjtcclxuaW1wb3J0IHBhdGggZnJvbSBcInBhdGhcIjtcclxuXHJcbmV4cG9ydCBkZWZhdWx0ICgpID0+IFxyXG4gICAgZ2xvYi5zeW5jKGAuL0NMQVNTLyoudG9tbGApLlxyXG4gICAgICAgIG1hcCgoY2xhc3NfcGF0aCkgPT4gXHJcbiAgICAgICAgICAgIHBhdGguYmFzZW5hbWUoY2xhc3NfcGF0aCwgYC50b21sYCkpOyIsImltcG9ydCBnZXRfbGlzdCBmcm9tIFwiLi9nZXRfbGlzdC5qc1wiO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgKGNsYXNzZXMpID0+IFxyXG4gICAgKGZuKSA9PiBcclxuICAgICAgICBQcm9taXNlLmFsbChjbGFzc2VzLmZpbHRlcigodGFyZ2V0KSA9PiB7XHJcbiAgICAgICAgICAgIGNvbnN0IGlzX29rYXkgPSBnZXRfbGlzdCgpLlxyXG4gICAgICAgICAgICAgICAgaW5kZXhPZih0YXJnZXQpICE9PSAtMTtcclxuXHJcbiAgICAgICAgICAgIGlmKCFpc19va2F5KSB7XHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgJHt0YXJnZXR9IGlzIG5vdCBhbiBhdmFpbGFibGUgW0NMQVNTXWApO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgICAgIHJldHVybiBpc19va2F5O1xyXG4gICAgICAgIH0pLlxyXG4gICAgICAgICAgICBtYXAoZm4pKTtcclxuIiwiaW1wb3J0IHRvbWxfdG9fanMgZnJvbSBcIi4uL3RyYW5zZm9ybXMvdG9tbF90b19qcy5qc1wiO1xyXG5pbXBvcnQgcm9sbHVwIGZyb20gXCJyb2xsdXBcIjtcclxuXHJcbmltcG9ydCBnZXRfbGlzdCBmcm9tIFwiLi4vbGliL2dldF9saXN0LmpzXCI7XHJcbmltcG9ydCBmaWx0ZXJfbGlzdCBmcm9tIFwiLi4vbGliL2ZpbHRlcl9saXN0LmpzXCI7XHJcblxyXG5leHBvcnQgZGVmYXVsdCAoe1xyXG4gICAgY29tbWFuZDogYGJ1aWxkIFtjbGFzc2VzLi4uXWAsXHJcbiAgICBoZWxwOiBgYnVpbGQgYWxsIFtDTEFTU10gZmlsZXMuYCxcclxuICAgIGF1dG9jb21wbGV0ZTogZ2V0X2xpc3QoKSxcclxuICAgIGhpZGRlbjogdHJ1ZSxcclxuICAgIGhhbmRsZXI6ICh7IGNsYXNzZXMgPSBnZXRfbGlzdCgpIH0pID0+IFxyXG4gICAgICAgIGZpbHRlcl9saXN0KGNsYXNzZXMpKGFzeW5jICh0YXJnZXQpID0+IHtcclxuICAgICAgICAgICAgY29uc3QgeyBidWlsZF9pbmZvLCBuYW1lIH0gPSBhd2FpdCB0b21sX3RvX2pzKGAuL0NMQVNTLyR7dGFyZ2V0fS50b21sYCk7XHJcbiAgICAgICAgICAgIGNvbnN0IGJ1bmRsZSA9IGF3YWl0IHJvbGx1cC5yb2xsdXAoYnVpbGRfaW5mbyk7XHJcblxyXG4gICAgICAgICAgICAvKlxyXG4gICAgICAgICAgICAgKiBjb25zb2xlLmxvZyhgR2VuZXJhdGluZyBvdXRwdXQuLi5gKTtcclxuICAgICAgICAgICAgICogY29uc3QgeyBvdXRwdXQgfSA9IGF3YWl0IGJ1bmRsZS5nZW5lcmF0ZShidWlsZF9pbmZvLm91dHB1dCk7XHJcbiAgICAgICAgICAgICAqL1xyXG5cclxuICAgICAgICAgICAgLy8gY29uc29sZS5sb2cob3V0cHV0KTtcclxuICAgICAgICAgICAgYXdhaXQgYnVuZGxlLndyaXRlKGJ1aWxkX2luZm8ub3V0cHV0KTtcclxuICAgICAgICAgICAgY29uc29sZS5sb2coYFske25hbWV9XSBCdWlsZCBDb21wbGV0ZS5cXHJcXG5gKTtcclxuICAgICAgICB9KS5cclxuICAgICAgICAgICAgdGhlbigocHJvbWlzZXMpID0+IHtcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBCdWlsdCAke3Byb21pc2VzLmxlbmd0aH0gW0NMQVNTXSBmaWxlKHMpLmApO1xyXG4gICAgICAgICAgICB9KVxyXG59KTsiLCJpbXBvcnQgcG0yIGZyb20gXCIuL3BtMi5qc1wiO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgKHtcclxuICAgIGNvbW1hbmQ6IGBsb2dzIFt0YXJnZXRzLi4uXWAsXHJcbiAgICBoZWxwOiBgZm9sbG93IHRoZSBsb2dzYCxcclxuICAgIGhhbmRsZXI6ICgpID0+IFxyXG4gICAgICAgIG5ldyBQcm9taXNlKCgpID0+IFxyXG4gICAgICAgICAgICBwbTIuaGFuZGxlcih7XHJcbiAgICAgICAgICAgICAgICBjb21tYW5kczogWyBgbG9nc2AgXVxyXG4gICAgICAgICAgICB9KSlcclxufSk7IiwiaW1wb3J0IGdldF9saXN0IGZyb20gXCIuLi9saWIvZ2V0X2xpc3QuanNcIjtcclxuXHJcbmV4cG9ydCBkZWZhdWx0ICh7XHJcbiAgICBoZWxwOiBgU2hvdyBhdmFpbGFibGUgW0NMQVNTXSBmaWxlcyBmcm9tIHRoZSBbU0hPUF0uYCxcclxuICAgIGFsaWFzOiBbIGBsc2AgXSxcclxuICAgIGhhbmRsZXI6IChhcmdzLCBjYikgPT4ge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKGdldF9saXN0KCkuXHJcbiAgICAgICAgICAgIG1hcCgoaSkgPT4gXHJcbiAgICAgICAgICAgICAgICBgWyR7aX1dYCkuXHJcbiAgICAgICAgICAgIGpvaW4oYCAtIGApLCBgXFxyXFxuYCk7ICAgIFxyXG4gICAgICAgICAgICBcclxuICAgICAgICBjYigpO1xyXG4gICAgfVxyXG59KTsiLCJpbXBvcnQgcG0yIGZyb20gXCJwbTJcIjtcclxuXHJcbmltcG9ydCB0b21sX3RvX2pzIGZyb20gXCIuLi90cmFuc2Zvcm1zL3RvbWxfdG9fanMuanNcIjtcclxuaW1wb3J0IGdldF9saXN0IGZyb20gXCIuLi9saWIvZ2V0X2xpc3QuanNcIjtcclxuXHJcbmV4cG9ydCBkZWZhdWx0ICh7XHJcbiAgICBjb21tYW5kZXI6IGBzcGF3biBbQ0xBU1MuLi5dYCxcclxuICAgIGhlbHA6IGBzcGF3biBbQ0xBU1NdIGZpbGVzYCxcclxuICAgIGhpZGRlbjogdHJ1ZSxcclxuICAgIGhhbmRsZXI6ICh7XHJcbiAgICAgICAgQ0xBU1MgPSBnZXRfbGlzdCgpXHJcbiAgICB9KSA9PiB7XHJcbiAgICAgICAgQ0xBU1MuZm9yRWFjaCgobmFtZSkgPT4ge1xyXG4gICAgICAgICAgICBjb25zdCB7XHJcbiAgICAgICAgICAgICAgICBvdXRwdXQsXHJcbiAgICAgICAgICAgIH0gPSB0b21sX3RvX2pzKGAuL0NMQVNTLyR7bmFtZX0udG9tbGApO1xyXG4gICAgXHJcbiAgICAgICAgICAgIHBtMi5zdGFydCh7XHJcbiAgICAgICAgICAgICAgICBuYW1lLFxyXG4gICAgICAgICAgICAgICAgc2NyaXB0OiBvdXRwdXQsXHJcbiAgICAgICAgICAgICAgICB3YXRjaDogdHJ1ZSxcclxuICAgICAgICAgICAgICAgIG1heF9yZXN0YXJ0OiA1IFxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9KTtcclxuXHJcbiAgICB9XHJcbn0pO1xyXG4iLCJleHBvcnQgZGVmYXVsdCAoXHJcbiAgICBhY3Rpb25fbWFwLCBcclxuICAgIHJlZHVjZXIgPSAoaSkgPT4gXHJcbiAgICAgICAgaVxyXG4pID0+IFxyXG4gICAgKGlucHV0KSA9PiB7XHJcbiAgICAgICAgY29uc3Qga2V5ID0gcmVkdWNlcihpbnB1dCk7XHJcblxyXG4gICAgICAgIGlmKCFhY3Rpb25fbWFwW2tleV0pIHtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmV0dXJuIGFjdGlvbl9tYXBba2V5XShpbnB1dCk7XHJcbiAgICB9OyIsImltcG9ydCBjaG9raWRhciBmcm9tIFwiY2hva2lkYXJcIjtcclxuaW1wb3J0IHJvbGx1cCBmcm9tIFwicm9sbHVwXCI7XHJcbmltcG9ydCBjIGZyb20gXCJjaGFsa1wiO1xyXG5cclxuaW1wb3J0IHRvbWxfdG9fanMgZnJvbSBcIi4uL3RyYW5zZm9ybXMvdG9tbF90b19qcy5qc1wiO1xyXG5cclxuaW1wb3J0IGFjdGlvbiBmcm9tIFwiLi4vbGliL2FjdGlvbi5qc1wiO1xyXG5pbXBvcnQgZmlsdGVyX2xpc3QgZnJvbSBcIi4uL2xpYi9maWx0ZXJfbGlzdC5qc1wiO1xyXG5pbXBvcnQgZ2V0X2xpc3QgZnJvbSBcIi4uL2xpYi9nZXRfbGlzdC5qc1wiO1xyXG5cclxuY29uc3Qgd2F0Y2hfcHJvbXB0ID0gKCkgPT4gXHJcbiAgICBjb25zb2xlLmxvZyhgUFJFU1MgW0NUUkwrQ10gVE8gUVVJVCBZT1VSIFdBVENIYCk7XHJcblxyXG5leHBvcnQgZGVmYXVsdCAoe1xyXG4gICAgY29tbWFuZDogYHdhdGNoIFtjbGFzc2VzLi4uXWAsXHJcbiAgICBoZWxwOiBgd2F0Y2ggW0NMQVNTXSBmaWxlcyBmb3IgY2hhbmdlcyBhbmQgcmVidWlsZC5gLFxyXG4gICAgaGlkZGVuOiB0cnVlLFxyXG4gICAgY2FuY2VsICgpIHtcclxuICAgICAgICB0aGlzLndhdGNoZXJzLmZvckVhY2goKHdhdGNoZXIpID0+IFxyXG4gICAgICAgICAgICB3YXRjaGVyLmNsb3NlKCkpO1xyXG4gICAgICAgIGNvbnNvbGUubG9nKGBXQVRDSCBTVE9QUEVEYCk7XHJcbiAgICB9LFxyXG4gICAgaGFuZGxlcih7IGNsYXNzZXMgPSBnZXRfbGlzdCgpIH0sIGNiKSB7XHJcbiAgICAgICAgd2F0Y2hfcHJvbXB0KCk7XHJcblxyXG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xyXG4gICAgICAgICAgICB0aGlzLndhdGNoZXJzID0gW107XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBmaWx0ZXJfbGlzdChjbGFzc2VzKSgodGFyZ2V0KSA9PiB7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBmaWxlX3BhdGggPSBgLi9DTEFTUy8ke3RhcmdldH0udG9tbGA7XHJcblxyXG4gICAgICAgICAgICAgICAgY29uc3QgZGF0YSA9IHRvbWxfdG9fanMoZmlsZV9wYXRoKTtcclxuXHJcbiAgICAgICAgICAgICAgICBjb25zdCB7IGJ1aWxkX2luZm8gfSA9IGRhdGE7XHJcbiAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAvLyByZWJ1aWxkIG9uIGZpbGUgY2hhZ25lXHJcbiAgICAgICAgICAgICAgICBjb25zdCB3YXRjaGVyID0gY2hva2lkYXIud2F0Y2goZmlsZV9wYXRoKTtcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgd2F0Y2hlci5vbihgY2hhbmdlYCwgKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIHRvbWxfdG9fanMoZmlsZV9wYXRoKTtcclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICB0aGlzLndhdGNoZXJzLnB1c2god2F0Y2hlcik7XHJcblxyXG4gICAgICAgICAgICAgICAgY29uc3Qgcm9sbHVwX3dhdGNoZXIgPSByb2xsdXAud2F0Y2goe1xyXG4gICAgICAgICAgICAgICAgICAgIC4uLmJ1aWxkX2luZm8sXHJcbiAgICAgICAgICAgICAgICAgICAgd2F0Y2g6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY2xlYXJTY3JlZW46IHRydWVcclxuICAgICAgICAgICAgICAgICAgICB9ICAgXHJcbiAgICAgICAgICAgICAgICB9KS5cclxuICAgICAgICAgICAgICAgICAgICBvbihgZXZlbnRgLCBhY3Rpb24oe1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBCVU5ETEVfRU5EOiAoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB3YXRjaF9wcm9tcHQoKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgRkFUQUw6ICh7IGVycm9yIH0pID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoYy5yZWQuYm9sZChlcnJvcikpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgfSwgKHsgY29kZSB9KSA9PiBcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29kZSBcclxuICAgICAgICAgICAgICAgICAgICApKTtcclxuXHJcbiAgICAgICAgICAgICAgICB0aGlzLndhdGNoZXJzLnB1c2gocm9sbHVwX3dhdGNoZXIpO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9KTtcclxuICAgIH1cclxufSk7XHJcbiIsImltcG9ydCB3YXRjaCBmcm9tIFwiLi93YXRjaC5qc1wiO1xyXG5pbXBvcnQgc3Bhd24gZnJvbSBcIi4vc3Bhd24uanNcIjtcclxuaW1wb3J0IGV4ZWMgZnJvbSBcIi4vcG0yLmpzXCI7XHJcblxyXG5leHBvcnQgZGVmYXVsdCAoe1xyXG4gICAgY29tbWFuZDogYHN0YXJ0IFtDTEFTUy4uLl1gLFxyXG4gICAgaGVscDogYHN0YXJ0IGFuZCB3YXRjaCBbQ0xBU1NdIGZpbGVzYCwgXHJcbiAgICBoYW5kbGVyOiAoZGF0YSkgPT4geyBcclxuICAgICAgICB3YXRjaC5oYW5kbGVyKGRhdGEpO1xyXG4gICAgICAgIHNwYXduLmhhbmRsZXIoZGF0YSk7XHJcbiAgICAgICAgZXhlYy5oYW5kbGVyKHtcclxuICAgICAgICAgICAgY29tbWFuZHM6IFsgYGxvZ3NgIF1cclxuICAgICAgICB9KTtcclxuICAgIH0sXHJcbiAgICBjYW5jZWw6ICgpID0+IHtcclxuICAgICAgICB3YXRjaC5jYW5jZWwoKTtcclxuICAgIH1cclxufSk7XHJcblxyXG4iLCJjb25zdCByZXMgPSB7fTtcbmltcG9ydCBmMCBmcm9tIFwiL1VzZXJzL0dhbWVzL1Byb2plY3RzL0lTRUtBSS9zcmMvY29tbWFuZHMvYWN0aXZlLmpzXCI7XG5yZXNbXCJhY3RpdmVcIl0gPSBmMDtcbmltcG9ydCBmMSBmcm9tIFwiL1VzZXJzL0dhbWVzL1Byb2plY3RzL0lTRUtBSS9zcmMvY29tbWFuZHMvYnVpbGQuanNcIjtcbnJlc1tcImJ1aWxkXCJdID0gZjE7XG5pbXBvcnQgZjIgZnJvbSBcIi9Vc2Vycy9HYW1lcy9Qcm9qZWN0cy9JU0VLQUkvc3JjL2NvbW1hbmRzL2xvZ3MuanNcIjtcbnJlc1tcImxvZ3NcIl0gPSBmMjtcbmltcG9ydCBmMyBmcm9tIFwiL1VzZXJzL0dhbWVzL1Byb2plY3RzL0lTRUtBSS9zcmMvY29tbWFuZHMvcG0yLmpzXCI7XG5yZXNbXCJwbTJcIl0gPSBmMztcbmltcG9ydCBmNCBmcm9tIFwiL1VzZXJzL0dhbWVzL1Byb2plY3RzL0lTRUtBSS9zcmMvY29tbWFuZHMvc2hvcC5qc1wiO1xucmVzW1wic2hvcFwiXSA9IGY0O1xuaW1wb3J0IGY1IGZyb20gXCIvVXNlcnMvR2FtZXMvUHJvamVjdHMvSVNFS0FJL3NyYy9jb21tYW5kcy9zcGF3bi5qc1wiO1xucmVzW1wic3Bhd25cIl0gPSBmNTtcbmltcG9ydCBmNiBmcm9tIFwiL1VzZXJzL0dhbWVzL1Byb2plY3RzL0lTRUtBSS9zcmMvY29tbWFuZHMvc3RhcnQuanNcIjtcbnJlc1tcInN0YXJ0XCJdID0gZjY7XG5pbXBvcnQgZjcgZnJvbSBcIi9Vc2Vycy9HYW1lcy9Qcm9qZWN0cy9JU0VLQUkvc3JjL2NvbW1hbmRzL3dhdGNoLmpzXCI7XG5yZXNbXCJ3YXRjaFwiXSA9IGY3O1xuZXhwb3J0IGRlZmF1bHQgcmVzOyIsImltcG9ydCBjIGZyb20gXCJjaGFsa1wiO1xyXG5cclxuY29uc3QgeyBsb2cgfSA9IGNvbnNvbGU7XHJcblxyXG5jb25zb2xlLmxvZyA9ICguLi5hcmdzKSA9PiBcclxuICAgIGxvZyhcclxuICAgICAgICAuLi5hcmdzLm1hcChcclxuICAgICAgICAgICAgKGl0ZW0pID0+IFxyXG4gICAgICAgICAgICAgICAgdHlwZW9mIGl0ZW0gPT09IGBzdHJpbmdgXHJcbiAgICAgICAgICAgICAgICAgICAgPyBjLmdyZWVuKFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBpdGVtLnJlcGxhY2UoLyhcXFsuW15cXF1cXFtdKlxcXSkvdWcsIGMuYm9sZC53aGl0ZShgJDFgKSlcclxuICAgICAgICAgICAgICAgICAgICApXHJcbiAgICAgICAgICAgICAgICAgICAgOiBpdGVtXHJcbiAgICAgICAgKVxyXG4gICAgKTtcclxuIiwiIyEvdXNyL2Jpbi9lbnYgbm9kZVxyXG5cclxuaW1wb3J0IHZvcnBhbCBmcm9tIFwidm9ycGFsXCI7XHJcbmltcG9ydCBjb21tYW5kcyBmcm9tIFwiLi9jb21tYW5kcy8qLmpzXCI7XHJcbmltcG9ydCB7IHZlcnNpb24gfSBmcm9tIFwiLi4vcGFja2FnZS5qc29uXCI7XHJcblxyXG5pbXBvcnQgXCIuL2xpYi9mb3JtYXQuanNcIjtcclxuXHJcbmltcG9ydCBjaGFsayBmcm9tIFwiY2hhbGtcIjtcclxuXHJcbmNvbnN0IHYgPSB2b3JwYWwoKTtcclxucHJvY2Vzcy5zdGRvdXQud3JpdGUoYFxceDFCY2ApO1xyXG5cclxuY29uc29sZS5sb2coY2hhbGsuZ3JlZW4oYFxyXG7ilojilojilZfilojilojilojilojilojilojilojilZfilojilojilojilojilojilojilojilZfilojilojilZcgIOKWiOKWiOKVlyDilojilojilojilojilojilZcg4paI4paI4pWXICAgICAg4paI4paI4paI4paI4paI4paI4paI4pWX4paI4paI4paI4pWXICAg4paI4paI4pWXIOKWiOKWiOKWiOKWiOKWiOKWiOKVlyDilojilojilZfilojilojilojilZcgICDilojilojilZfilojilojilojilojilojilojilojilZcgICAgXHJcbuKWiOKWiOKVkeKWiOKWiOKVlOKVkOKVkOKVkOKVkOKVneKWiOKWiOKVlOKVkOKVkOKVkOKVkOKVneKWiOKWiOKVkSDilojilojilZTilZ3ilojilojilZTilZDilZDilojilojilZfilojilojilZHiloQg4paI4paI4pWX4paE4paI4paI4pWU4pWQ4pWQ4pWQ4pWQ4pWd4paI4paI4paI4paI4pWXICDilojilojilZHilojilojilZTilZDilZDilZDilZDilZ0g4paI4paI4pWR4paI4paI4paI4paI4pWXICDilojilojilZHilojilojilZTilZDilZDilZDilZDilZ0gICAgXHJcbuKWiOKWiOKVkeKWiOKWiOKWiOKWiOKWiOKWiOKWiOKVl+KWiOKWiOKWiOKWiOKWiOKVlyAg4paI4paI4paI4paI4paI4pWU4pWdIOKWiOKWiOKWiOKWiOKWiOKWiOKWiOKVkeKWiOKWiOKVkSDilojilojilojilojilZfilojilojilojilojilojilZcgIOKWiOKWiOKVlOKWiOKWiOKVlyDilojilojilZHilojilojilZEgIOKWiOKWiOKWiOKVl+KWiOKWiOKVkeKWiOKWiOKVlOKWiOKWiOKVlyDilojilojilZHilojilojilojilojilojilZcgICAgICBcclxu4paI4paI4pWR4pWa4pWQ4pWQ4pWQ4pWQ4paI4paI4pWR4paI4paI4pWU4pWQ4pWQ4pWdICDilojilojilZTilZDilojilojilZcg4paI4paI4pWU4pWQ4pWQ4paI4paI4pWR4paI4paI4pWR4paA4pWa4paI4paI4pWU4paA4paI4paI4pWU4pWQ4pWQ4pWdICDilojilojilZHilZrilojilojilZfilojilojilZHilojilojilZEgICDilojilojilZHilojilojilZHilojilojilZHilZrilojilojilZfilojilojilZHilojilojilZTilZDilZDilZ0gICAgICBcclxu4paI4paI4pWR4paI4paI4paI4paI4paI4paI4paI4pWR4paI4paI4paI4paI4paI4paI4paI4pWX4paI4paI4pWRICDilojilojilZfilojilojilZEgIOKWiOKWiOKVkeKWiOKWiOKVkSAg4pWa4pWQ4pWdIOKWiOKWiOKWiOKWiOKWiOKWiOKWiOKVl+KWiOKWiOKVkSDilZrilojilojilojilojilZHilZrilojilojilojilojilojilojilZTilZ3ilojilojilZHilojilojilZEg4pWa4paI4paI4paI4paI4pWR4paI4paI4paI4paI4paI4paI4paI4pWXICAgIFxyXG7ilZrilZDilZ3ilZrilZDilZDilZDilZDilZDilZDilZ3ilZrilZDilZDilZDilZDilZDilZDilZ3ilZrilZDilZ0gIOKVmuKVkOKVneKVmuKVkOKVnSAg4pWa4pWQ4pWd4pWa4pWQ4pWdICAgICAg4pWa4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWd4pWa4pWQ4pWdICDilZrilZDilZDilZDilZ0g4pWa4pWQ4pWQ4pWQ4pWQ4pWQ4pWdIOKVmuKVkOKVneKVmuKVkOKVnSAg4pWa4pWQ4pWQ4pWQ4pWd4pWa4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWdICAgIFxyXG5WRVJTSU9OOiAke3ZlcnNpb259ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcclxuYCkpO1xyXG5cclxuT2JqZWN0LmVudHJpZXMoY29tbWFuZHMpLlxyXG4gICAgZm9yRWFjaCgoW1xyXG4gICAgICAgIG5hbWUsIHtcclxuICAgICAgICAgICAgaGVscCxcclxuICAgICAgICAgICAgaGFuZGxlcixcclxuICAgICAgICAgICAgYXV0b2NvbXBsZXRlLFxyXG4gICAgICAgICAgICBoaWRkZW4sXHJcbiAgICAgICAgICAgIGFsaWFzID0gW10sXHJcbiAgICAgICAgICAgIGNhbmNlbCA9ICgpID0+IHt9XHJcbiAgICAgICAgfVxyXG4gICAgXSkgPT4geyBcclxuICAgICAgICBjb25zdCBjb21tYW5kID0gdi5jb21tYW5kKG5hbWUsIGhlbHApLlxyXG4gICAgICAgICAgICBhbGlhcyhhbGlhcykuXHJcbiAgICAgICAgICAgIGF1dG9jb21wbGV0ZShhdXRvY29tcGxldGUgfHwgW10pLlxyXG4gICAgICAgICAgICBjYW5jZWwoY2FuY2VsKS5cclxuICAgICAgICAgICAgYWN0aW9uKGhhbmRsZXIpO1xyXG5cclxuICAgICAgICBpZihoaWRkZW4pIHtcclxuICAgICAgICAgICAgY29tbWFuZC5oaWRkZW4oKTtcclxuICAgICAgICB9XHJcbiAgICB9KTtcclxuXHJcbnYuZGVsaW1pdGVyKGNoYWxrLmJvbGQuZ3JlZW4oYD5gKSkuXHJcbiAgICBzaG93KCk7Il0sIm5hbWVzIjpbInNwYXduIiwicG0yIiwiY3JlYXRlRmlsdGVyIiwiZ2xvYiIsInRvbWwiLCJ0ZXJzZXIiLCJ3YXRjaCIsImV4ZWMiLCJjaGFsayIsInZlcnNpb24iLCJjb21tYW5kcyJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQTtBQUNBO0FBRUEsU0FBZSxDQUFDO0lBQ1osT0FBTyxFQUFFLENBQUMsaUJBQWlCLENBQUM7SUFDNUIs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
