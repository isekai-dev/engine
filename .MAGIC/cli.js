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

const log_equip = (equip) => 
    c.yellow(equip);

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
SHOP:
${Object.keys(SKILLS).
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

var f0 = ({
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
    command: `logs [CLASS...]`,
    help: `follow the logs`,
    handler: ({ CLASS = [] }) => 
        new Promise(() => 
            f2.handler({
                commands: [ `logs`, ...CLASS ]
            }))
});

var f3 = ({
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

var f4 = ({
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

var f7 = ({
    command: `stop [CLASS...]`,
    help: `stop active CLASS] files. `, 

    handler: ({ CLASS = [ `all` ] }) => 
        f2.handler({
            commands: [ `delete`, ...CLASS ]
        })
});

var f5 = ({
    command: `start [CLASS...]`,
    help: `start and watch [CLASS] files`, 
    handler(data) { 
        this.data = data.CLASS 
            ? data
            : { CLASS: get_list() };

        f8.handler(this.data);
        f4.handler(this.data);

        f2.handler({
            commands: [ `logs` ]
        });
    },
    cancel() {
        f8.cancel();
        console.log(`STOPPING ${this.data.CLASS.map((i) => 
            `[${i}]`).
            join(` - `)}`);
        
        return f7.handler(this.data);
    }
});

var f6 = ({
    command: `status`,
    help: `[STATUS] of active [CLASS] files.`,
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2xpLmpzIiwic291cmNlcyI6WyIuLi9zcmMvcm9sbHVwL3BsdWdpbi1nbG9iLmpzIiwiLi4vc3JjL3JvbGx1cC92ZXJzaW9uLmpzIiwiLi4vc3JjL3JvbGx1cC9idWlsZGVycy5qcyIsIi4uL3NyYy90cmFuc2Zvcm1zL3RvbWxfdG9fanMuanMiLCIuLi9zcmMvbGliL2dldF9saXN0LmpzIiwiLi4vc3JjL2xpYi9maWx0ZXJfbGlzdC5qcyIsIi4uL3NyYy9jb21tYW5kcy9idWlsZC5qcyIsIi4uL3NyYy9jb21tYW5kcy9wbTIuanMiLCIuLi9zcmMvY29tbWFuZHMvbG9ncy5qcyIsIi4uL3NyYy9jb21tYW5kcy9zaG9wLmpzIiwiLi4vc3JjL2NvbW1hbmRzL3NwYXduLmpzIiwiLi4vc3JjL2xpYi9hY3Rpb24uanMiLCIuLi9zcmMvY29tbWFuZHMvd2F0Y2guanMiLCIuLi9zcmMvY29tbWFuZHMvc3RvcC5qcyIsIi4uL3NyYy9jb21tYW5kcy9zdGFydC5qcyIsIi4uL3NyYy9jb21tYW5kcy9zdGF0dXMuanMiLCIuLi80ZWU0OTVmYjE4MGUyYjRhNjVhN2MxNTI2MDk4YmIwZCIsIi4uL3NyYy9saWIvZm9ybWF0LmpzIiwiLi4vc3JjL2NsaS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJcclxuaW1wb3J0IGZzIGZyb20gXCJmc1wiO1xyXG5pbXBvcnQgb3MgZnJvbSBcIm9zXCI7XHJcbmltcG9ydCBnbG9iIGZyb20gXCJnbG9iXCI7XHJcbmltcG9ydCBwYXRoIGZyb20gXCJwYXRoXCI7XHJcbmltcG9ydCBtZDUgZnJvbSBcIm1kNVwiO1xyXG5cclxuaW1wb3J0IHsgY3JlYXRlRmlsdGVyIH0gZnJvbSBcInJvbGx1cC1wbHVnaW51dGlsc1wiO1xyXG5cclxuY29uc3QgZ2V0RlNQcmVmaXggPSAocHJlZml4ID0gcHJvY2Vzcy5jd2QoKSkgPT4ge1xyXG4gICAgY29uc3QgcGFyZW50ID0gcGF0aC5qb2luKHByZWZpeCwgYC4uYCk7XHJcbiAgICBpZiAocGFyZW50ID09PSBwcmVmaXgpIHtcclxuICAgICAgICByZXR1cm4gcHJlZml4O1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICByZXR1cm4gZ2V0RlNQcmVmaXgocGFyZW50KTtcclxufTtcclxuXHJcbmNvbnN0IGZzUHJlZml4ID0gZ2V0RlNQcmVmaXgoKTtcclxuY29uc3Qgcm9vdFBhdGggPSBwYXRoLmpvaW4oYC9gKTtcclxuXHJcbmNvbnN0IHRvVVJMU3RyaW5nID0gKGZpbGVQYXRoKSA9PiB7XHJcbiAgICBjb25zdCBwYXRoRnJhZ21lbnRzID0gcGF0aC5qb2luKGZpbGVQYXRoKS5cclxuICAgICAgICByZXBsYWNlKGZzUHJlZml4LCByb290UGF0aCkuXHJcbiAgICAgICAgc3BsaXQocGF0aC5zZXApO1xyXG4gICAgaWYgKCFwYXRoLmlzQWJzb2x1dGUoZmlsZVBhdGgpKSB7XHJcbiAgICAgICAgcGF0aEZyYWdtZW50cy51bnNoaWZ0KGAuYCk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIHJldHVybiBwYXRoRnJhZ21lbnRzLmpvaW4oYC9gKTtcclxufTtcclxuXHJcbmNvbnN0IHJlc29sdmVOYW1lID0gKGZyb20pID0+IFxyXG4gICAgZnJvbS5zcGxpdChgL2ApLlxyXG4gICAgICAgIHBvcCgpLlxyXG4gICAgICAgIHNwbGl0KGAuYCkuXHJcbiAgICAgICAgc2hpZnQoKTtcclxuXHJcbmV4cG9ydCBkZWZhdWx0ICh7IFxyXG4gICAgaW5jbHVkZSwgXHJcbiAgICBleGNsdWRlIFxyXG59ID0gZmFsc2UpID0+IHtcclxuICAgIGNvbnN0IGZpbHRlciA9IGNyZWF0ZUZpbHRlcihpbmNsdWRlLCBleGNsdWRlKTtcclxuICAgIFxyXG4gICAgcmV0dXJuIHtcclxuICAgICAgICBuYW1lOiBgcm9sbHVwLWdsb2JgLFxyXG4gICAgICAgIGxvYWQ6IChpZCkgPT4ge1xyXG4gICAgICAgICAgICBjb25zdCBzcmNGaWxlID0gcGF0aC5qb2luKG9zLnRtcGRpcigpLCBpZCk7XHJcblxyXG4gICAgICAgICAgICBsZXQgb3B0aW9ucztcclxuICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICAgIG9wdGlvbnMgPSBKU09OLnBhcnNlKGZzLnJlYWRGaWxlU3luYyhzcmNGaWxlKSk7XHJcbiAgICAgICAgICAgIH0gY2F0Y2goZXJyKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGNvbnN0IHsgaW1wb3J0ZWUsIGltcG9ydGVyIH0gPSBvcHRpb25zO1xyXG5cclxuICAgICAgICAgICAgY29uc3QgaW1wb3J0ZWVJc0Fic29sdXRlID0gcGF0aC5pc0Fic29sdXRlKGltcG9ydGVlKTtcclxuICAgICAgICAgICAgY29uc3QgY3dkID0gcGF0aC5kaXJuYW1lKGltcG9ydGVyKTtcclxuICAgICAgICAgICAgY29uc3QgZ2xvYlBhdHRlcm4gPSBpbXBvcnRlZTtcclxuXHJcbiAgICAgICAgICAgIGNvbnN0IGZpbGVzID0gZ2xvYi5zeW5jKGdsb2JQYXR0ZXJuLCB7XHJcbiAgICAgICAgICAgICAgICBjd2RcclxuICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICBsZXQgY29kZSA9IFsgYGNvbnN0IHJlcyA9IHt9O2AgXTtcclxuICAgICAgICAgICAgbGV0IGltcG9ydEFycmF5ID0gW107XHJcblxyXG4gICAgICAgICAgICBmaWxlcy5mb3JFYWNoKChmaWxlLCBpKSA9PiB7XHJcbiAgICAgICAgICAgICAgICBsZXQgZnJvbTtcclxuICAgICAgICAgICAgICAgIGlmIChpbXBvcnRlZUlzQWJzb2x1dGUpIHtcclxuICAgICAgICAgICAgICAgICAgICBmcm9tID0gdG9VUkxTdHJpbmcoZmlsZSk7XHJcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgIGZyb20gPSB0b1VSTFN0cmluZyhwYXRoLnJlc29sdmUoY3dkLCBmaWxlKSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBjb2RlLnB1c2goYGltcG9ydCBmJHtpfSBmcm9tIFwiJHtmcm9tfVwiO2ApO1xyXG4gICAgICAgICAgICAgICAgY29kZS5wdXNoKGByZXNbXCIke3Jlc29sdmVOYW1lKGZyb20pfVwiXSA9IGYke2l9O2ApO1xyXG4gICAgICAgICAgICAgICAgaW1wb3J0QXJyYXkucHVzaChmcm9tKTtcclxuICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICBjb2RlLnB1c2goYGV4cG9ydCBkZWZhdWx0IHJlcztgKTtcclxuXHJcbiAgICAgICAgICAgIGNvZGUgPSBjb2RlLmpvaW4oYFxcbmApO1xyXG4gICAgICAgIFxyXG4gICAgICAgICAgICByZXR1cm4gY29kZTtcclxuXHJcbiAgICAgICAgfSxcclxuICAgICAgICByZXNvbHZlSWQ6IChpbXBvcnRlZSwgaW1wb3J0ZXIpID0+IHtcclxuICAgICAgICAgICAgaWYgKCFmaWx0ZXIoaW1wb3J0ZWUpIHx8ICFpbXBvcnRlZS5pbmNsdWRlcyhgKmApKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGNvbnN0IGhhc2ggPSBtZDUoaW1wb3J0ZWUgKyBpbXBvcnRlcik7XHJcblxyXG4gICAgICAgICAgICBmcy53cml0ZUZpbGVTeW5jKHBhdGguam9pbihvcy50bXBkaXIoKSwgaGFzaCksIEpTT04uc3RyaW5naWZ5KHtcclxuICAgICAgICAgICAgICAgIGltcG9ydGVlLFxyXG4gICAgICAgICAgICAgICAgaW1wb3J0ZXJcclxuICAgICAgICAgICAgfSkpO1xyXG5cclxuICAgICAgICAgICAgcmV0dXJuIGhhc2g7XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxufTsiLCJpbXBvcnQgZnMgZnJvbSBcImZzXCI7XHJcblxyXG5leHBvcnQgZGVmYXVsdCAoe1xyXG4gICAgcGF0aCxcclxuICAgIHZlcnNpb25cclxufSkgPT4gXHJcbiAgICAoe1xyXG4gICAgICAgIG5hbWU6IGByb2xsdXAtd3JpdGVgLFxyXG4gICAgICAgIGJ1aWxkU3RhcnQ6ICgpID0+IHtcclxuICAgICAgICAgICAgZnMud3JpdGVGaWxlU3luYyhwYXRoLCB2ZXJzaW9uKCkpO1xyXG4gICAgICAgIH1cclxuICAgIH0pOyIsImltcG9ydCB0b21sIGZyb20gXCJyb2xsdXAtcGx1Z2luLXRvbWxcIjtcclxuXHJcblxyXG5pbXBvcnQgc3ZlbHRlIGZyb20gXCJyb2xsdXAtcGx1Z2luLXN2ZWx0ZVwiO1xyXG5pbXBvcnQgcmVzb2x2ZSBmcm9tIFwicm9sbHVwLXBsdWdpbi1ub2RlLXJlc29sdmVcIjtcclxuaW1wb3J0IGNvcHkgZnJvbSBcInJvbGx1cC1wbHVnaW4tY29weS1nbG9iXCI7XHJcbmltcG9ydCByZXBsYWNlIGZyb20gXCJyb2xsdXAtcGx1Z2luLXJlcGxhY2VcIjtcclxuXHJcbmltcG9ydCBqc29uIGZyb20gXCJyb2xsdXAtcGx1Z2luLWpzb25cIjtcclxuaW1wb3J0IG1kIGZyb20gXCJyb2xsdXAtcGx1Z2luLWNvbW1vbm1hcmtcIjtcclxuaW1wb3J0IGNqcyBmcm9tIFwicm9sbHVwLXBsdWdpbi1jb21tb25qc1wiO1xyXG5cclxuaW1wb3J0IHsgdGVyc2VyIH0gZnJvbSBcInJvbGx1cC1wbHVnaW4tdGVyc2VyXCI7XHJcbmltcG9ydCB1dWlkIGZyb20gXCJ1dWlkL3YxXCI7XHJcblxyXG4vKlxyXG4gKiBpbXBvcnQgc3ByaXRlc21pdGggZnJvbSBcInJvbGx1cC1wbHVnaW4tc3ByaXRlXCI7XHJcbiAqIGltcG9ydCB0ZXh0dXJlUGFja2VyIGZyb20gXCJzcHJpdGVzbWl0aC10ZXh0dXJlcGFja2VyXCI7XHJcbiAqL1xyXG5cclxuaW1wb3J0IGdsb2IgZnJvbSBcIi4vcGx1Z2luLWdsb2IuanNcIjtcclxuaW1wb3J0IHZlcnNpb24gZnJvbSBcIi4vdmVyc2lvbi5qc1wiO1xyXG5cclxuY29uc3QgQ09ERV9WRVJTSU9OID0gdXVpZCgpO1xyXG5jb25zdCBwcm9kdWN0aW9uID0gIXByb2Nlc3MuZW52LlJPTExVUF9XQVRDSDtcclxuXHJcbmNvbnN0IGRvX2NvcHkgPSAoY29weU9iamVjdCkgPT4gXHJcbiAgICBjb3B5KE9iamVjdC5rZXlzKGNvcHlPYmplY3QpLlxyXG4gICAgICAgIG1hcChcclxuICAgICAgICAgICAgKGtleSkgPT4gXHJcbiAgICAgICAgICAgICAgICAoe1xyXG4gICAgICAgICAgICAgICAgICAgIGZpbGVzOiBrZXksXHJcbiAgICAgICAgICAgICAgICAgICAgZGVzdDogY29weU9iamVjdFtrZXldXHJcbiAgICAgICAgICAgICAgICB9KVxyXG4gICAgICAgICkpO1xyXG5cclxubGV0IENMSUVOVF9WRVJTSU9OID0gdXVpZCgpO1xyXG5cclxuY29uc3QgZXh0ZXJuYWwgPSBbXHJcbiAgICBgZXhwcmVzc2AsXHJcbiAgICBgaXNla2FpYCxcclxuICAgIGBmc2AsXHJcbiAgICBgaHR0cGAsXHJcbiAgICBgaHR0cHNgXHJcbl07XHJcblxyXG5jb25zdCBub2RlID0gKHtcclxuICAgIGlucHV0LFxyXG4gICAgb3V0cHV0LFxyXG4gICAgY29weTogY29weU9iamVjdCA9IHt9XHJcbn0pID0+IFxyXG4gICAgKHtcclxuICAgICAgICBpbnB1dCxcclxuICAgICAgICBvdXRwdXQ6IHtcclxuICAgICAgICAgICAgc291cmNlbWFwOiBgaW5saW5lYCxcclxuICAgICAgICAgICAgZmlsZTogb3V0cHV0LFxyXG4gICAgICAgICAgICBmb3JtYXQ6IGBjanNgLFxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgZXh0ZXJuYWwsXHJcbiAgICAgICAgcGx1Z2luczogW1xyXG4gICAgICAgICAgICBnbG9iKCksXHJcbiAgICAgICAgICAgIHJlcGxhY2Uoe1xyXG4gICAgICAgICAgICAgICAgQ09ERV9WRVJTSU9OLFxyXG4gICAgICAgICAgICB9KSxcclxuICAgICAgICAgICAgbWQoKSxcclxuICAgICAgICAgICAgZG9fY29weShjb3B5T2JqZWN0KSxcclxuICAgICAgICAgICAgdG9tbFxyXG4gICAgICAgIF0sXHJcbiAgICB9KTtcclxuXHJcbmNvbnN0IGJyb3dzZXIgPSAoe1xyXG4gICAgaW5wdXQsXHJcbiAgICBvdXRwdXQsXHJcbiAgICBjc3M6IGNzc1BhdGgsXHJcbiAgICBjb3B5OiBjb3B5T2JqZWN0LFxyXG59KSA9PiBcclxuICAgICh7XHJcbiAgICAgICAgaW5wdXQsXHJcbiAgICAgICAgb3V0cHV0OiB7XHJcbiAgICAgICAgICAgIGZpbGU6IG91dHB1dCxcclxuICAgICAgICAgICAgZm9ybWF0OiBgaWlmZWAsXHJcbiAgICAgICAgfSxcclxuICAgICAgICBleHRlcm5hbDogWyBgdXVpZGAsIGB1dWlkL3YxYCwgYHBpeGkuanNgIF0sXHJcbiAgICAgICAgcGx1Z2luczogW1xyXG4gICAgICAgIC8vIC8vIG1ha2UgdGhpcyBhIHJlYWN0aXZlIHBsdWdpbiB0byBcIi50aWxlbWFwLmpzb25cIlxyXG4gICAgICAgIC8vICAgICBzcHJpdGVzbWl0aCh7XHJcbiAgICAgICAgLy8gICAgICAgICBzcmM6IHtcclxuICAgICAgICAvLyAgICAgICAgICAgICBjd2Q6IFwiLi9nb2JsaW4ubGlmZS9CUk9XU0VSLlBJWEkvXHJcbiAgICAgICAgLy8gICAgICAgICAgICAgZ2xvYjogXCIqKi8qLnBuZ1wiXHJcbiAgICAgICAgLy8gICAgICAgICB9LFxyXG4gICAgICAgIC8vICAgICAgICAgdGFyZ2V0OiB7XHJcbiAgICAgICAgLy8gICAgICAgICAgICAgaW1hZ2U6IFwiLi9iaW4vcHVibGljL2ltYWdlcy9zcHJpdGUucG5nXCIsXHJcbiAgICAgICAgLy8gICAgICAgICAgICAgY3NzOiBcIi4vYmluL3B1YmxpYy9hcnQvZGVmYXVsdC5qc29uXCJcclxuICAgICAgICAvLyAgICAgICAgIH0sXHJcbiAgICAgICAgLy8gICAgICAgICBvdXRwdXQ6IHtcclxuICAgICAgICAvLyAgICAgICAgICAgICBpbWFnZTogXCIuL2Jpbi9wdWJsaWMvaW1hZ2VzL3Nwcml0ZS5wbmdcIlxyXG4gICAgICAgIC8vICAgICAgICAgfSxcclxuICAgICAgICAvLyAgICAgICAgIHNwcml0ZXNtaXRoT3B0aW9uczoge1xyXG4gICAgICAgIC8vICAgICAgICAgICAgIHBhZGRpbmc6IDBcclxuICAgICAgICAvLyAgICAgICAgIH0sXHJcbiAgICAgICAgLy8gICAgICAgICBjdXN0b21UZW1wbGF0ZTogdGV4dHVyZVBhY2tlclxyXG4gICAgICAgIC8vICAgICB9KSxcclxuICAgICAgICAgICAgZ2xvYigpLFxyXG4gICAgICAgICAgICBjanMoe1xyXG4gICAgICAgICAgICAgICAgaW5jbHVkZTogYG5vZGVfbW9kdWxlcy8qKmAsIFxyXG4gICAgICAgICAgICB9KSxcclxuICAgICAgICAgICAganNvbigpLFxyXG4gICAgICAgICAgICByZXBsYWNlKHtcclxuICAgICAgICAgICAgICAgIENPREVfVkVSU0lPTixcclxuICAgICAgICAgICAgICAgIENMSUVOVF9WRVJTSU9OOiAoKSA9PiBcclxuICAgICAgICAgICAgICAgICAgICBDTElFTlRfVkVSU0lPTlxyXG4gICAgICAgICAgICB9KSxcclxuICAgICAgICAgICAgdG9tbCxcclxuICAgICAgICAgICAgbWQoKSxcclxuICAgICAgICAgICAgc3ZlbHRlKHtcclxuICAgICAgICAgICAgICAgIGNzczogKGNzcykgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIGNzcy53cml0ZShjc3NQYXRoKTtcclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIH0pLFxyXG4gICAgICAgICAgICByZXNvbHZlKCksXHJcbiAgICAgICAgICAgIHByb2R1Y3Rpb24gJiYgdGVyc2VyKCksXHJcbiAgICAgICAgICAgIGRvX2NvcHkoY29weU9iamVjdCksXHJcbiAgICAgICAgICAgIHZlcnNpb24oe1xyXG4gICAgICAgICAgICAgICAgcGF0aDogYC4vLk1BR0lDL2NsaWVudC52ZXJzaW9uYCxcclxuICAgICAgICAgICAgICAgIHZlcnNpb246ICgpID0+IFxyXG4gICAgICAgICAgICAgICAgICAgIENMSUVOVF9WRVJTSU9OXHJcbiAgICAgICAgICAgIH0pXHJcbiAgICAgICAgXVxyXG4gICAgfSk7XHJcblxyXG5leHBvcnQgZGVmYXVsdCB7XHJcbiAgICBub2RlLFxyXG4gICAgYnJvd3NlclxyXG59OyIsImltcG9ydCBmcyBmcm9tIFwiZnNcIjtcclxuaW1wb3J0IHRvbWwgZnJvbSBcInRvbWxcIjtcclxuaW1wb3J0IHBhdGggZnJvbSBcInBhdGhcIjtcclxuaW1wb3J0IGdsb2IgZnJvbSBcImdsb2JcIjtcclxuaW1wb3J0IGMgZnJvbSBcImNoYWxrXCI7XHJcbmltcG9ydCBidWlsZGVycyBmcm9tIFwiLi4vcm9sbHVwL2J1aWxkZXJzLmpzXCI7XHJcblxyXG5jLmVuYWJsZWQgPSB0cnVlO1xyXG5jLmxldmVsID0gMztcclxuXHJcbmNvbnN0IGxvZ19lcXVpcCA9IChlcXVpcCkgPT4gXHJcbiAgICBjLnllbGxvdyhlcXVpcCk7XHJcblxyXG5leHBvcnQgZGVmYXVsdCAoY29uZmlnRmlsZSkgPT4gXHJcbiAgICAvLyBNaXggQ29uZmlnIEZpbGUgaW4gYW5kIHJ1biB0aGVzZSBpbiBvcmRlclxyXG4gICAgT2JqZWN0LnZhbHVlcyh7XHJcbiAgICAgICAgZ2F0aGVyX1NLSUxMUzogKCkgPT4gXHJcbiAgICAgICAgICAgICh7XHJcbiAgICAgICAgICAgICAgICBTS0lMTFM6IGdsb2Iuc3luYyhgLi9TS0lMTFMvKi9gKS5cclxuICAgICAgICAgICAgICAgICAgICByZWR1Y2UoKG9iaiwgZXF1aXBfcGF0aCkgPT4gXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICh7IFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgW3BhdGguYmFzZW5hbWUoZXF1aXBfcGF0aCldOiB0cnVlLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLi4ub2JqIFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB9KSwge30pXHJcbiAgICAgICAgICAgIH0pLFxyXG5cclxuICAgICAgICByZWFkX2NvbmZpZzogKHtcclxuICAgICAgICAgICAgY29uZmlnRmlsZSxcclxuICAgICAgICB9KSA9PiB7XHJcbiAgICAgICAgLy8gdmVyaWZ5IHRvbWwgZXhpc3RzXHJcbiAgICAgICAgICAgIGxldCByYXc7XHJcblxyXG4gICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgcmF3ID0gZnMucmVhZEZpbGVTeW5jKGNvbmZpZ0ZpbGUsIGB1dGYtOGApO1xyXG4gICAgICAgICAgICB9IGNhdGNoIChleGNlcHRpb24pIHtcclxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgQ291bGRuJ3QgcmVhZCAke2NvbmZpZ0ZpbGV9LiBBcmUgeW91IHN1cmUgdGhpcyBwYXRoIGlzIGNvcnJlY3Q/YCk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGNvbnN0IGNvbmZpZyA9IHRvbWwucGFyc2UocmF3KTtcclxuXHJcbiAgICAgICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgICAgICBjb25maWcsXHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgfSxcclxuXHJcbiAgICAgICAgc2V0X25hbWVzOiAoe1xyXG4gICAgICAgICAgICBjb25maWdGaWxlLFxyXG4gICAgICAgICAgICBjb25maWdcclxuICAgICAgICB9KSA9PiB7XHJcbiAgICAgICAgICAgIGNvbnN0IG5hbWUgPSBwYXRoLmJhc2VuYW1lKGNvbmZpZ0ZpbGUsIGAudG9tbGApO1xyXG5cclxuICAgICAgICAgICAgY29uc3QgcGFja2FnZV9wYXRoID0gcGF0aC5kaXJuYW1lKHBhdGgucmVzb2x2ZShjb25maWdGaWxlKSk7XHJcbiAgICAgICAgICAgIGNvbnN0IHBhY2thZ2VfbmFtZSA9IHBhY2thZ2VfcGF0aC5cclxuICAgICAgICAgICAgICAgIHNwbGl0KHBhdGguc2VwKS5cclxuICAgICAgICAgICAgICAgIHBvcCgpO1xyXG5cclxuICAgICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgICAgIHBhY2thZ2VfcGF0aCxcclxuICAgICAgICAgICAgICAgIHBhY2thZ2VfbmFtZSxcclxuICAgICAgICAgICAgICAgIG5hbWUsXHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgfSxcclxuXHJcbiAgICAgICAgd3JpdGVfZW50cnk6ICh7XHJcbiAgICAgICAgICAgIGNvbmZpZyxcclxuICAgICAgICAgICAgbmFtZSxcclxuICAgICAgICAgICAgU0tJTExTLFxyXG4gICAgICAgIH0pID0+IHtcclxuICAgICAgICAvLyBXUklURSBPVVQgRklMRVxyXG4gICAgICAgICAgICBsZXQgZW50cnkgPSBgYDtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGNvbnN0IHdyaXRlID0gKGRhdGEpID0+IFxyXG4gICAgICAgICAgICAgICAgZW50cnkgKz0gYCR7ZGF0YX1cXHJcXG5gO1xyXG4gICAgICAgIFxyXG4gICAgICAgICAgICB3cml0ZShgaW1wb3J0IGlzZWthaSBmcm9tIFwiaXNla2FpXCI7YCk7XHJcbiAgICAgICAgICAgIHdyaXRlKGBpc2VrYWkuU0VUKCR7SlNPTi5zdHJpbmdpZnkoY29uZmlnKX0pO2ApO1xyXG4gICAgICAgICAgICB3cml0ZShgYCk7XHJcbiAgICBcclxuICAgICAgICAgICAgY29uc3QgZXF1aXBlZCA9IE9iamVjdC5rZXlzKGNvbmZpZykuXHJcbiAgICAgICAgICAgICAgICBmaWx0ZXIoKGtleSkgPT4gXHJcbiAgICAgICAgICAgICAgICAgICAga2V5ID09PSBrZXkudG9VcHBlckNhc2UoKSAmJiBTS0lMTFNba2V5XSkuXHJcbiAgICAgICAgICAgICAgICBtYXAoKGtleSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIHdyaXRlKGBpbXBvcnQgJHtrZXl9IGZyb20gXCIuLi9TS0lMTFMvJHtrZXl9L2luZGV4LmpzXCI7YCk7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBrZXk7XHJcbiAgICAgICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgIGNvbnN0IGtleXMgPSBlcXVpcGVkLnJlZHVjZSgob3V0cHV0LCBrZXkpID0+IFxyXG4gICAgICAgICAgICAgICAgYCR7b3V0cHV0fSAgICAke2tleX0sXFxyXFxuYCwgYGApO1xyXG5cclxuICAgICAgICAgICAgd3JpdGUoYFxyXG5pc2VrYWkuRVFVSVAoe1xcclxcbiR7a2V5c319KTtgKTtcclxuXHJcbiAgICAgICAgICAgIGNvbnN0IGlucHV0ID0gcGF0aC5qb2luKGAuTUFHSUNgLCBgJHtuYW1lfS5lbnRyeS5qc2ApO1xyXG5cclxuICAgICAgICAgICAgLy8gd3JpdGUgb3V0IHRoZWlyIGluZGV4LmpzXHJcbiAgICAgICAgICAgIGZzLndyaXRlRmlsZVN5bmMoaW5wdXQsIGVudHJ5LCBgdXRmLThgKTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGBcclxuWyR7bmFtZX1dWyR7Y29uZmlnLk5PREUgPyBgTk9ERWAgOiBgQlJPV1NFUmB9XVxyXG5TSE9QOlxyXG4ke09iamVjdC5rZXlzKFNLSUxMUykuXHJcbiAgICAgICAgbWFwKGxvZ19lcXVpcCkuXHJcbiAgICAgICAgam9pbihgIC0gYCl9XHJcblxyXG5FUVVJUFBFRDpcclxuJHtjLnJlZChlcXVpcGVkLmpvaW4oYCAtIGApKX1cclxuYCk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICAgICAgaW5wdXRcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICB9LFxyXG5cclxuICAgICAgICBydW5fYnVpbGRlcnM6ICh7XHJcbiAgICAgICAgICAgIGlucHV0LFxyXG4gICAgICAgICAgICBuYW1lLFxyXG4gICAgICAgICAgICBjb25maWcsXHJcbiAgICAgICAgfSkgPT4ge1xyXG4gICAgICAgICAgICBjb25zdCB0YXJnZXQgPSBjb25maWcuTk9ERSBcclxuICAgICAgICAgICAgICAgID8gYE5PREVgIFxyXG4gICAgICAgICAgICAgICAgOiBgQlJPV1NFUmA7XHJcblxyXG4gICAgICAgICAgICBjb25zdCBvdXRwdXQgPSBgLk1BR0lDLyR7bmFtZX0uJHt0YXJnZXR9LmpzYDtcclxuXHJcbiAgICAgICAgICAgIGlmKGNvbmZpZy5OT0RFICYmIGNvbmZpZy5CUk9XU0VSKSB7XHJcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFlvdSBjYW5ub3QgdGFyZ2V0IGJvdGggW05PREVdIGFuZCBbQlJPV1NFUl1gKTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgaWYoY29uZmlnLk5PREUpIHsgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgICAgICAgICAgb3V0cHV0LFxyXG4gICAgICAgICAgICAgICAgICAgIGJ1aWxkX2luZm86IGJ1aWxkZXJzLm5vZGUoe1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpbnB1dCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgb3V0cHV0XHJcbiAgICAgICAgICAgICAgICAgICAgfSlcclxuICAgICAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICAgICAgaWYoY29uZmlnLkJST1dTRVIpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgICAgICAgICAgb3V0cHV0LFxyXG4gICAgICAgICAgICAgICAgICAgIGJ1aWxkX2luZm86IGJ1aWxkZXJzLmJyb3dzZXIoe1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpbnB1dCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgb3V0cHV0XHJcbiAgICAgICAgICAgICAgICAgICAgfSlcclxuICAgICAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgWW91IG11c3Qgc3BlY2lmeSBlaXRoZXIgW05PREVdIG9yIFtCUk9XU0VSXSBmb3IgeW91ciB0YXJnZXRgKTtcclxuICAgICAgICB9XHJcbiAgICB9KS5cclxuICAgICAgICByZWR1Y2UoKHN0YXRlLCBmbikgPT4gXHJcbiAgICAgICAgICAgICh7XHJcbiAgICAgICAgICAgICAgICAuLi5zdGF0ZSxcclxuICAgICAgICAgICAgICAgIC4uLmZuKHN0YXRlKVxyXG4gICAgICAgICAgICB9KSwgeyBjb25maWdGaWxlIH0pO1xyXG4iLCJpbXBvcnQgZ2xvYiBmcm9tIFwiZ2xvYlwiO1xyXG5pbXBvcnQgcGF0aCBmcm9tIFwicGF0aFwiO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgKCkgPT4gXHJcbiAgICBnbG9iLnN5bmMoYC4vQ0xBU1MvKi50b21sYCkuXHJcbiAgICAgICAgbWFwKChjbGFzc19wYXRoKSA9PiBcclxuICAgICAgICAgICAgcGF0aC5iYXNlbmFtZShjbGFzc19wYXRoLCBgLnRvbWxgKSk7IiwiaW1wb3J0IGdldF9saXN0IGZyb20gXCIuL2dldF9saXN0LmpzXCI7XHJcblxyXG5leHBvcnQgZGVmYXVsdCAoY2xhc3NlcykgPT4gXHJcbiAgICAoZm4pID0+IFxyXG4gICAgICAgIFByb21pc2UuYWxsKGNsYXNzZXMuZmlsdGVyKCh0YXJnZXQpID0+IHtcclxuICAgICAgICAgICAgY29uc3QgaXNfb2theSA9IGdldF9saXN0KCkuXHJcbiAgICAgICAgICAgICAgICBpbmRleE9mKHRhcmdldCkgIT09IC0xO1xyXG5cclxuICAgICAgICAgICAgaWYoIWlzX29rYXkpIHtcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGAke3RhcmdldH0gaXMgbm90IGFuIGF2YWlsYWJsZSBbQ0xBU1NdYCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICAgICAgcmV0dXJuIGlzX29rYXk7XHJcbiAgICAgICAgfSkuXHJcbiAgICAgICAgICAgIG1hcChmbikpO1xyXG4iLCJpbXBvcnQgdG9tbF90b19qcyBmcm9tIFwiLi4vdHJhbnNmb3Jtcy90b21sX3RvX2pzLmpzXCI7XHJcbmltcG9ydCByb2xsdXAgZnJvbSBcInJvbGx1cFwiO1xyXG5cclxuaW1wb3J0IGdldF9saXN0IGZyb20gXCIuLi9saWIvZ2V0X2xpc3QuanNcIjtcclxuaW1wb3J0IGZpbHRlcl9saXN0IGZyb20gXCIuLi9saWIvZmlsdGVyX2xpc3QuanNcIjtcclxuXHJcbmV4cG9ydCBkZWZhdWx0ICh7XHJcbiAgICBjb21tYW5kOiBgYnVpbGQgW0NMQVNTLi4uXWAsXHJcbiAgICBoZWxwOiBgYnVpbGQgYWxsIFtDTEFTU10gZmlsZXMuYCxcclxuICAgIGF1dG9jb21wbGV0ZTogZ2V0X2xpc3QoKSxcclxuICAgIGhpZGRlbjogdHJ1ZSxcclxuICAgIGhhbmRsZXI6ICh7IENMQVNTID0gZ2V0X2xpc3QoKSB9KSA9PiBcclxuICAgICAgICBmaWx0ZXJfbGlzdChDTEFTUykoYXN5bmMgKHRhcmdldCkgPT4ge1xyXG4gICAgICAgICAgICBjb25zdCB7IGJ1aWxkX2luZm8sIG5hbWUgfSA9IGF3YWl0IHRvbWxfdG9fanMoYC4vQ0xBU1MvJHt0YXJnZXR9LnRvbWxgKTtcclxuICAgICAgICAgICAgY29uc3QgYnVuZGxlID0gYXdhaXQgcm9sbHVwLnJvbGx1cChidWlsZF9pbmZvKTtcclxuXHJcbiAgICAgICAgICAgIC8qXHJcbiAgICAgICAgICAgICAqIGNvbnNvbGUubG9nKGBHZW5lcmF0aW5nIG91dHB1dC4uLmApO1xyXG4gICAgICAgICAgICAgKiBjb25zdCB7IG91dHB1dCB9ID0gYXdhaXQgYnVuZGxlLmdlbmVyYXRlKGJ1aWxkX2luZm8ub3V0cHV0KTtcclxuICAgICAgICAgICAgICovXHJcblxyXG4gICAgICAgICAgICAvLyBjb25zb2xlLmxvZyhvdXRwdXQpO1xyXG4gICAgICAgICAgICBhd2FpdCBidW5kbGUud3JpdGUoYnVpbGRfaW5mby5vdXRwdXQpO1xyXG4gICAgICAgICAgICBjb25zb2xlLmxvZyhgWyR7bmFtZX1dIEJ1aWxkIENvbXBsZXRlLlxcclxcbmApO1xyXG4gICAgICAgIH0pLlxyXG4gICAgICAgICAgICB0aGVuKChwcm9taXNlcykgPT4ge1xyXG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coYEJ1aWx0ICR7cHJvbWlzZXMubGVuZ3RofSBbQ0xBU1NdIGZpbGUocykuYCk7XHJcbiAgICAgICAgICAgIH0pXHJcbn0pOyIsIi8vIHBpcGUgb3V0IHRvIHBtMlxyXG5pbXBvcnQgeyBzcGF3biB9IGZyb20gXCJjaGlsZF9wcm9jZXNzXCI7XHJcblxyXG5leHBvcnQgZGVmYXVsdCAoe1xyXG4gICAgY29tbWFuZDogYHBtMiBbY29tbWFuZHMuLi5dYCxcclxuXHJcbiAgICBoZWxwOiBgZXhlY3V0ZSBhIHBtMiBjb21tYW5kYCxcclxuICAgIGhpZGRlbjogdHJ1ZSxcclxuXHJcbiAgICBjYW5jZWwoKSB7XHJcbiAgICAgICAgaWYoIXRoaXMubm9kZSkge1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB0aGlzLm5vZGUua2lsbCgpO1xyXG4gICAgfSxcclxuXHJcbiAgICBoYW5kbGVyKHsgY29tbWFuZHMgfSwgY2IpIHtcclxuICAgICAgICBpZighY29tbWFuZHMpIHtcclxuICAgICAgICAgICAgY29uc29sZS5sb2coYFlvdSBtdXN0IHByb3ZpZGUgY29tbWFuZHMgZm9yIHBtMlxcclxcbmApO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgcmV0dXJuIGNiKCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xyXG4gICAgICAgICAgICB0aGlzLm5vZGUgPSBzcGF3bihgbm9kZWAsIGAke19fZGlybmFtZX0vLi4vbm9kZV9tb2R1bGVzL3BtMi9iaW4vcG0yICR7Y29tbWFuZHMuam9pbihgIGApfWAuc3BsaXQoYCBgKSwge1xyXG4gICAgICAgICAgICAgICAgZW52OiBwcm9jZXNzLmVudixcclxuICAgICAgICAgICAgICAgIHN0ZGlvOiBgaW5oZXJpdGBcclxuICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICB0aGlzLm5vZGUub24oYGNsb3NlYCwgKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgcmVzb2x2ZSgpO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9KTtcclxuICAgIH1cclxufSk7IiwiaW1wb3J0IHBtMiBmcm9tIFwiLi9wbTIuanNcIjtcclxuXHJcbmV4cG9ydCBkZWZhdWx0ICh7XHJcbiAgICBjb21tYW5kOiBgbG9ncyBbQ0xBU1MuLi5dYCxcclxuICAgIGhlbHA6IGBmb2xsb3cgdGhlIGxvZ3NgLFxyXG4gICAgaGFuZGxlcjogKHsgQ0xBU1MgPSBbXSB9KSA9PiBcclxuICAgICAgICBuZXcgUHJvbWlzZSgoKSA9PiBcclxuICAgICAgICAgICAgcG0yLmhhbmRsZXIoe1xyXG4gICAgICAgICAgICAgICAgY29tbWFuZHM6IFsgYGxvZ3NgLCAuLi5DTEFTUyBdXHJcbiAgICAgICAgICAgIH0pKVxyXG59KTsiLCJpbXBvcnQgZ2V0X2xpc3QgZnJvbSBcIi4uL2xpYi9nZXRfbGlzdC5qc1wiO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgKHtcclxuICAgIGhlbHA6IGBTaG93IGF2YWlsYWJsZSBbQ0xBU1NdIGZpbGVzIGZyb20gdGhlIFtTSE9QXS5gLFxyXG4gICAgYWxpYXM6IFsgYGxzYCBdLFxyXG4gICAgaGFuZGxlcjogKGFyZ3MsIGNiKSA9PiB7XHJcbiAgICAgICAgY29uc29sZS5sb2coZ2V0X2xpc3QoKS5cclxuICAgICAgICAgICAgbWFwKChpKSA9PiBcclxuICAgICAgICAgICAgICAgIGBbJHtpfV1gKS5cclxuICAgICAgICAgICAgam9pbihgIC0gYCksIGBcXHJcXG5gKTsgICAgXHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgIGNiKCk7XHJcbiAgICB9XHJcbn0pOyIsImltcG9ydCBwbTIgZnJvbSBcInBtMlwiO1xyXG5cclxuaW1wb3J0IHRvbWxfdG9fanMgZnJvbSBcIi4uL3RyYW5zZm9ybXMvdG9tbF90b19qcy5qc1wiO1xyXG5pbXBvcnQgZ2V0X2xpc3QgZnJvbSBcIi4uL2xpYi9nZXRfbGlzdC5qc1wiO1xyXG5pbXBvcnQgZmlsdGVyX2xpc3QgZnJvbSBcIi4uL2xpYi9maWx0ZXJfbGlzdC5qc1wiO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgKHtcclxuICAgIGNvbW1hbmRlcjogYHNwYXduIFtDTEFTUy4uLl1gLFxyXG4gICAgaGVscDogYHNwYXduIFtDTEFTU10gZmlsZXNgLFxyXG4gICAgaGlkZGVuOiB0cnVlLFxyXG4gICAgaGFuZGxlcjogKHtcclxuICAgICAgICBDTEFTUyA9IGdldF9saXN0KClcclxuICAgIH0pID0+IHtcclxuICAgICAgICBmaWx0ZXJfbGlzdChDTEFTUykoKG5hbWUpID0+IHtcclxuICAgICAgICAgICAgY29uc3Qge1xyXG4gICAgICAgICAgICAgICAgb3V0cHV0LFxyXG4gICAgICAgICAgICB9ID0gdG9tbF90b19qcyhgLi9DTEFTUy8ke25hbWV9LnRvbWxgKTtcclxuICAgICAgICAgICAgY29uc29sZS5sb2coYHdhdGNoaW5nYCwgb3V0cHV0KTtcclxuXHJcbiAgICAgICAgICAgIHBtMi5zdGFydCh7XHJcbiAgICAgICAgICAgICAgICBuYW1lLFxyXG4gICAgICAgICAgICAgICAgc2NyaXB0OiBvdXRwdXQsXHJcbiAgICAgICAgICAgICAgICB3YXRjaDogdHJ1ZSxcclxuICAgICAgICAgICAgICAgIHdhdGNoX29wdGlvbnM6IHtcclxuICAgICAgICAgICAgICAgICAgICB1c2VQb2xsaW5nOiB0cnVlXHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgbWF4X3Jlc3RhcnQ6IDUgXHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0pO1xyXG5cclxuICAgIH1cclxufSk7XHJcbiIsImV4cG9ydCBkZWZhdWx0IChcclxuICAgIGFjdGlvbl9tYXAsIFxyXG4gICAgcmVkdWNlciA9IChpKSA9PiBcclxuICAgICAgICBpXHJcbikgPT4gXHJcbiAgICAoaW5wdXQpID0+IHtcclxuICAgICAgICBjb25zdCBrZXkgPSByZWR1Y2VyKGlucHV0KTtcclxuXHJcbiAgICAgICAgaWYoIWFjdGlvbl9tYXBba2V5XSkge1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByZXR1cm4gYWN0aW9uX21hcFtrZXldKGlucHV0KTtcclxuICAgIH07IiwiaW1wb3J0IGNob2tpZGFyIGZyb20gXCJjaG9raWRhclwiO1xyXG5pbXBvcnQgcm9sbHVwIGZyb20gXCJyb2xsdXBcIjtcclxuaW1wb3J0IGMgZnJvbSBcImNoYWxrXCI7XHJcblxyXG5pbXBvcnQgdG9tbF90b19qcyBmcm9tIFwiLi4vdHJhbnNmb3Jtcy90b21sX3RvX2pzLmpzXCI7XHJcblxyXG5pbXBvcnQgYWN0aW9uIGZyb20gXCIuLi9saWIvYWN0aW9uLmpzXCI7XHJcbmltcG9ydCBmaWx0ZXJfbGlzdCBmcm9tIFwiLi4vbGliL2ZpbHRlcl9saXN0LmpzXCI7XHJcbmltcG9ydCBnZXRfbGlzdCBmcm9tIFwiLi4vbGliL2dldF9saXN0LmpzXCI7XHJcblxyXG5jb25zdCB3YXRjaF9wcm9tcHQgPSAoKSA9PiBcclxuICAgIGNvbnNvbGUubG9nKGBbQlVJTFRdIFBSRVNTIFtDVFJMK0NdIFRPIFFVSVQgWU9VUiBXQVRDSGApO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgKHtcclxuICAgIGNvbW1hbmQ6IGB3YXRjaCBbQ0xBU1MuLi5dYCxcclxuICAgIGhlbHA6IGB3YXRjaCBbQ0xBU1NdIGZpbGVzIGZvciBjaGFuZ2VzIGFuZCByZWJ1aWxkLmAsXHJcbiAgICBoaWRkZW46IHRydWUsXHJcbiAgICBjYW5jZWwgKCkge1xyXG4gICAgICAgIHRoaXMud2F0Y2hlcnMuZm9yRWFjaCgod2F0Y2hlcikgPT4gXHJcbiAgICAgICAgICAgIHdhdGNoZXIuY2xvc2UoKSk7XHJcbiAgICAgICAgY29uc29sZS5sb2coYFlPVVIgV0FUQ0ggSEFTIEVOREVEYCk7XHJcbiAgICB9LFxyXG4gICAgaGFuZGxlcih7IENMQVNTID0gZ2V0X2xpc3QoKSB9LCBjYikge1xyXG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xyXG4gICAgICAgICAgICB0aGlzLndhdGNoZXJzID0gW107XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBmaWx0ZXJfbGlzdChDTEFTUykoKHRhcmdldCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgY29uc3QgZmlsZV9wYXRoID0gYC4vQ0xBU1MvJHt0YXJnZXR9LnRvbWxgO1xyXG5cclxuICAgICAgICAgICAgICAgIGNvbnN0IGRhdGEgPSB0b21sX3RvX2pzKGZpbGVfcGF0aCk7XHJcblxyXG4gICAgICAgICAgICAgICAgY29uc3QgeyBidWlsZF9pbmZvIH0gPSBkYXRhO1xyXG4gICAgICAgIFxyXG4gICAgICAgICAgICAgICAgLy8gcmVidWlsZCBvbiBmaWxlIGNoYWduZVxyXG4gICAgICAgICAgICAgICAgY29uc3Qgd2F0Y2hlciA9IGNob2tpZGFyLndhdGNoKGZpbGVfcGF0aCk7XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIHdhdGNoZXIub24oYGNoYW5nZWAsICgpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICB0b21sX3RvX2pzKGZpbGVfcGF0aCk7XHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgdGhpcy53YXRjaGVycy5wdXNoKHdhdGNoZXIpO1xyXG5cclxuICAgICAgICAgICAgICAgIGNvbnN0IHJvbGx1cF93YXRjaGVyID0gcm9sbHVwLndhdGNoKHtcclxuICAgICAgICAgICAgICAgICAgICAuLi5idWlsZF9pbmZvLFxyXG4gICAgICAgICAgICAgICAgICAgIHdhdGNoOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNsZWFyU2NyZWVuOiB0cnVlXHJcbiAgICAgICAgICAgICAgICAgICAgfSAgIFxyXG4gICAgICAgICAgICAgICAgfSkuXHJcbiAgICAgICAgICAgICAgICAgICAgb24oYGV2ZW50YCwgYWN0aW9uKHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgQlVORExFX0VORDogKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgd2F0Y2hfcHJvbXB0KCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIEZBVEFMOiAoeyBlcnJvciB9KSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKGMucmVkLmJvbGQoZXJyb3IpKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIH0sICh7IGNvZGUgfSkgPT4gXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvZGUgXHJcbiAgICAgICAgICAgICAgICAgICAgKSk7XHJcblxyXG4gICAgICAgICAgICAgICAgdGhpcy53YXRjaGVycy5wdXNoKHJvbGx1cF93YXRjaGVyKTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcbn0pO1xyXG4iLCJpbXBvcnQgcG0yIGZyb20gXCIuL3BtMi5qc1wiO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgKHtcclxuICAgIGNvbW1hbmQ6IGBzdG9wIFtDTEFTUy4uLl1gLFxyXG4gICAgaGVscDogYHN0b3AgYWN0aXZlIENMQVNTXSBmaWxlcy4gYCwgXHJcblxyXG4gICAgaGFuZGxlcjogKHsgQ0xBU1MgPSBbIGBhbGxgIF0gfSkgPT4gXHJcbiAgICAgICAgcG0yLmhhbmRsZXIoe1xyXG4gICAgICAgICAgICBjb21tYW5kczogWyBgZGVsZXRlYCwgLi4uQ0xBU1MgXVxyXG4gICAgICAgIH0pXHJcbn0pO1xyXG5cclxuIiwiaW1wb3J0IHdhdGNoIGZyb20gXCIuL3dhdGNoLmpzXCI7XHJcbmltcG9ydCBzcGF3biBmcm9tIFwiLi9zcGF3bi5qc1wiO1xyXG5pbXBvcnQgZXhlYyBmcm9tIFwiLi9wbTIuanNcIjtcclxuaW1wb3J0IHN0b3AgZnJvbSBcIi4vc3RvcC5qc1wiO1xyXG5pbXBvcnQgZ2V0X2xpc3QgZnJvbSBcIi4uL2xpYi9nZXRfbGlzdC5qc1wiO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgKHtcclxuICAgIGNvbW1hbmQ6IGBzdGFydCBbQ0xBU1MuLi5dYCxcclxuICAgIGhlbHA6IGBzdGFydCBhbmQgd2F0Y2ggW0NMQVNTXSBmaWxlc2AsIFxyXG4gICAgaGFuZGxlcihkYXRhKSB7IFxyXG4gICAgICAgIHRoaXMuZGF0YSA9IGRhdGEuQ0xBU1MgXHJcbiAgICAgICAgICAgID8gZGF0YVxyXG4gICAgICAgICAgICA6IHsgQ0xBU1M6IGdldF9saXN0KCkgfTtcclxuXHJcbiAgICAgICAgd2F0Y2guaGFuZGxlcih0aGlzLmRhdGEpO1xyXG4gICAgICAgIHNwYXduLmhhbmRsZXIodGhpcy5kYXRhKTtcclxuXHJcbiAgICAgICAgZXhlYy5oYW5kbGVyKHtcclxuICAgICAgICAgICAgY29tbWFuZHM6IFsgYGxvZ3NgIF1cclxuICAgICAgICB9KTtcclxuICAgIH0sXHJcbiAgICBjYW5jZWwoKSB7XHJcbiAgICAgICAgd2F0Y2guY2FuY2VsKCk7XHJcbiAgICAgICAgY29uc29sZS5sb2coYFNUT1BQSU5HICR7dGhpcy5kYXRhLkNMQVNTLm1hcCgoaSkgPT4gXHJcbiAgICAgICAgICAgIGBbJHtpfV1gKS5cclxuICAgICAgICAgICAgam9pbihgIC0gYCl9YCk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgcmV0dXJuIHN0b3AuaGFuZGxlcih0aGlzLmRhdGEpO1xyXG4gICAgfVxyXG59KTtcclxuXHJcbiIsImltcG9ydCBwbTIgZnJvbSBcIi4vcG0yLmpzXCI7XHJcblxyXG5leHBvcnQgZGVmYXVsdCh7XHJcbiAgICBjb21tYW5kOiBgc3RhdHVzYCxcclxuICAgIGhlbHA6IGBbU1RBVFVTXSBvZiBhY3RpdmUgW0NMQVNTXSBmaWxlcy5gLFxyXG4gICAgYWxpYXM6IFsgYHBzYCwgYGFjdGl2ZWAgXSxcclxuICAgIGhhbmRsZXI6ICgpID0+IFxyXG4gICAgICAgIHBtMi5oYW5kbGVyKHtcclxuICAgICAgICAgICAgY29tbWFuZHM6IFsgYHBzYCBdXHJcbiAgICAgICAgfSlcclxufSk7IiwiY29uc3QgcmVzID0ge307XG5pbXBvcnQgZjAgZnJvbSBcIi9Vc2Vycy9HYW1lcy9Qcm9qZWN0cy9JU0VLQUkvc3JjL2NvbW1hbmRzL2J1aWxkLmpzXCI7XG5yZXNbXCJidWlsZFwiXSA9IGYwO1xuaW1wb3J0IGYxIGZyb20gXCIvVXNlcnMvR2FtZXMvUHJvamVjdHMvSVNFS0FJL3NyYy9jb21tYW5kcy9sb2dzLmpzXCI7XG5yZXNbXCJsb2dzXCJdID0gZjE7XG5pbXBvcnQgZjIgZnJvbSBcIi9Vc2Vycy9HYW1lcy9Qcm9qZWN0cy9JU0VLQUkvc3JjL2NvbW1hbmRzL3BtMi5qc1wiO1xucmVzW1wicG0yXCJdID0gZjI7XG5pbXBvcnQgZjMgZnJvbSBcIi9Vc2Vycy9HYW1lcy9Qcm9qZWN0cy9JU0VLQUkvc3JjL2NvbW1hbmRzL3Nob3AuanNcIjtcbnJlc1tcInNob3BcIl0gPSBmMztcbmltcG9ydCBmNCBmcm9tIFwiL1VzZXJzL0dhbWVzL1Byb2plY3RzL0lTRUtBSS9zcmMvY29tbWFuZHMvc3Bhd24uanNcIjtcbnJlc1tcInNwYXduXCJdID0gZjQ7XG5pbXBvcnQgZjUgZnJvbSBcIi9Vc2Vycy9HYW1lcy9Qcm9qZWN0cy9JU0VLQUkvc3JjL2NvbW1hbmRzL3N0YXJ0LmpzXCI7XG5yZXNbXCJzdGFydFwiXSA9IGY1O1xuaW1wb3J0IGY2IGZyb20gXCIvVXNlcnMvR2FtZXMvUHJvamVjdHMvSVNFS0FJL3NyYy9jb21tYW5kcy9zdGF0dXMuanNcIjtcbnJlc1tcInN0YXR1c1wiXSA9IGY2O1xuaW1wb3J0IGY3IGZyb20gXCIvVXNlcnMvR2FtZXMvUHJvamVjdHMvSVNFS0FJL3NyYy9jb21tYW5kcy9zdG9wLmpzXCI7XG5yZXNbXCJzdG9wXCJdID0gZjc7XG5pbXBvcnQgZjggZnJvbSBcIi9Vc2Vycy9HYW1lcy9Qcm9qZWN0cy9JU0VLQUkvc3JjL2NvbW1hbmRzL3dhdGNoLmpzXCI7XG5yZXNbXCJ3YXRjaFwiXSA9IGY4O1xuZXhwb3J0IGRlZmF1bHQgcmVzOyIsImltcG9ydCBjIGZyb20gXCJjaGFsa1wiO1xyXG5cclxuY29uc3QgeyBsb2cgfSA9IGNvbnNvbGU7XHJcblxyXG5jb25zb2xlLmxvZyA9ICguLi5hcmdzKSA9PiBcclxuICAgIGxvZyhcclxuICAgICAgICAuLi5hcmdzLm1hcChcclxuICAgICAgICAgICAgKGl0ZW0pID0+IFxyXG4gICAgICAgICAgICAgICAgdHlwZW9mIGl0ZW0gPT09IGBzdHJpbmdgXHJcbiAgICAgICAgICAgICAgICAgICAgPyBjLmdyZWVuKFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBpdGVtLnJlcGxhY2UoLyhcXFsuW15cXF1cXFtdKlxcXSkvdWcsIGMuYm9sZC53aGl0ZShgJDFgKSlcclxuICAgICAgICAgICAgICAgICAgICApXHJcbiAgICAgICAgICAgICAgICAgICAgOiBpdGVtXHJcbiAgICAgICAgKVxyXG4gICAgKTtcclxuIiwiIyEvdXNyL2Jpbi9lbnYgbm9kZVxyXG5cclxuaW1wb3J0IHZvcnBhbCBmcm9tIFwidm9ycGFsXCI7XHJcbmltcG9ydCBjb21tYW5kcyBmcm9tIFwiLi9jb21tYW5kcy8qLmpzXCI7XHJcbmltcG9ydCB7IHZlcnNpb24gfSBmcm9tIFwiLi4vcGFja2FnZS5qc29uXCI7XHJcblxyXG5pbXBvcnQgXCIuL2xpYi9mb3JtYXQuanNcIjtcclxuXHJcbmltcG9ydCBjaGFsayBmcm9tIFwiY2hhbGtcIjtcclxuXHJcbmNvbnN0IHYgPSB2b3JwYWwoKTtcclxucHJvY2Vzcy5zdGRvdXQud3JpdGUoYFxceDFCY2ApO1xyXG5cclxuY29uc29sZS5sb2coY2hhbGsuZ3JlZW4oYFxyXG7ilojilojilZfilojilojilojilojilojilojilojilZfilojilojilojilojilojilojilojilZfilojilojilZcgIOKWiOKWiOKVlyDilojilojilojilojilojilZcg4paI4paI4pWXICAgICAg4paI4paI4paI4paI4paI4paI4paI4pWX4paI4paI4paI4pWXICAg4paI4paI4pWXIOKWiOKWiOKWiOKWiOKWiOKWiOKVlyDilojilojilZfilojilojilojilZcgICDilojilojilZfilojilojilojilojilojilojilojilZcgICAgXHJcbuKWiOKWiOKVkeKWiOKWiOKVlOKVkOKVkOKVkOKVkOKVneKWiOKWiOKVlOKVkOKVkOKVkOKVkOKVneKWiOKWiOKVkSDilojilojilZTilZ3ilojilojilZTilZDilZDilojilojilZfilojilojilZHiloQg4paI4paI4pWX4paE4paI4paI4pWU4pWQ4pWQ4pWQ4pWQ4pWd4paI4paI4paI4paI4pWXICDilojilojilZHilojilojilZTilZDilZDilZDilZDilZ0g4paI4paI4pWR4paI4paI4paI4paI4pWXICDilojilojilZHilojilojilZTilZDilZDilZDilZDilZ0gICAgXHJcbuKWiOKWiOKVkeKWiOKWiOKWiOKWiOKWiOKWiOKWiOKVl+KWiOKWiOKWiOKWiOKWiOKVlyAg4paI4paI4paI4paI4paI4pWU4pWdIOKWiOKWiOKWiOKWiOKWiOKWiOKWiOKVkeKWiOKWiOKVkSDilojilojilojilojilZfilojilojilojilojilojilZcgIOKWiOKWiOKVlOKWiOKWiOKVlyDilojilojilZHilojilojilZEgIOKWiOKWiOKWiOKVl+KWiOKWiOKVkeKWiOKWiOKVlOKWiOKWiOKVlyDilojilojilZHilojilojilojilojilojilZcgICAgICBcclxu4paI4paI4pWR4pWa4pWQ4pWQ4pWQ4pWQ4paI4paI4pWR4paI4paI4pWU4pWQ4pWQ4pWdICDilojilojilZTilZDilojilojilZcg4paI4paI4pWU4pWQ4pWQ4paI4paI4pWR4paI4paI4pWR4paA4pWa4paI4paI4pWU4paA4paI4paI4pWU4pWQ4pWQ4pWdICDilojilojilZHilZrilojilojilZfilojilojilZHilojilojilZEgICDilojilojilZHilojilojilZHilojilojilZHilZrilojilojilZfilojilojilZHilojilojilZTilZDilZDilZ0gICAgICBcclxu4paI4paI4pWR4paI4paI4paI4paI4paI4paI4paI4pWR4paI4paI4paI4paI4paI4paI4paI4pWX4paI4paI4pWRICDilojilojilZfilojilojilZEgIOKWiOKWiOKVkeKWiOKWiOKVkSAg4pWa4pWQ4pWdIOKWiOKWiOKWiOKWiOKWiOKWiOKWiOKVl+KWiOKWiOKVkSDilZrilojilojilojilojilZHilZrilojilojilojilojilojilojilZTilZ3ilojilojilZHilojilojilZEg4pWa4paI4paI4paI4paI4pWR4paI4paI4paI4paI4paI4paI4paI4pWXICAgIFxyXG7ilZrilZDilZ3ilZrilZDilZDilZDilZDilZDilZDilZ3ilZrilZDilZDilZDilZDilZDilZDilZ3ilZrilZDilZ0gIOKVmuKVkOKVneKVmuKVkOKVnSAg4pWa4pWQ4pWd4pWa4pWQ4pWdICAgICAg4pWa4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWd4pWa4pWQ4pWdICDilZrilZDilZDilZDilZ0g4pWa4pWQ4pWQ4pWQ4pWQ4pWQ4pWdIOKVmuKVkOKVneKVmuKVkOKVnSAg4pWa4pWQ4pWQ4pWQ4pWd4pWa4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWdICAgIFxyXG5WRVJTSU9OOiAke3ZlcnNpb259ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcclxuYCkpO1xyXG5cclxuXHJcbk9iamVjdC5lbnRyaWVzKGNvbW1hbmRzKS5cclxuICAgIGZvckVhY2goKFtcclxuICAgICAgICBuYW1lLCB7XHJcbiAgICAgICAgICAgIGhlbHAsXHJcbiAgICAgICAgICAgIGhhbmRsZXIsXHJcbiAgICAgICAgICAgIGF1dG9jb21wbGV0ZSxcclxuICAgICAgICAgICAgaGlkZGVuLFxyXG4gICAgICAgICAgICBjb21tYW5kLFxyXG4gICAgICAgICAgICBhbGlhcyA9IFtdLFxyXG4gICAgICAgICAgICBjYW5jZWwgPSAoKSA9PiB7fVxyXG4gICAgICAgIH1cclxuICAgIF0pID0+IHsgXHJcbiAgICAgICAgY29uc3QgaXN0ID0gdi5jb21tYW5kKGNvbW1hbmQgfHwgbmFtZSwgaGVscCkuXHJcbiAgICAgICAgICAgIGFsaWFzKGFsaWFzKS5cclxuICAgICAgICAgICAgYXV0b2NvbXBsZXRlKGF1dG9jb21wbGV0ZSB8fCBbXSkuXHJcbiAgICAgICAgICAgIGNhbmNlbChjYW5jZWwpLlxyXG4gICAgICAgICAgICBhY3Rpb24oaGFuZGxlcik7XHJcblxyXG4gICAgICAgIGlmKGhpZGRlbikge1xyXG4gICAgICAgICAgICBpc3QuaGlkZGVuKCk7XHJcbiAgICAgICAgfVxyXG4gICAgfSk7XHJcblxyXG5cclxuY29uc3Qgc3RhcnR1cF9jb21tYW5kcyA9IHByb2Nlc3MuYXJndi5zbGljZSgyKTtcclxuXHJcbi8vIFRPRE86IGlzZWthaSBjcmVhdGUgZm9vIGluc3RlYWQgb2YgaXNla2FpIFwiY3JlYXRlIGZvb1wiXHJcbnN0YXJ0dXBfY29tbWFuZHMucmVkdWNlKChwcmV2LCBjdXIpID0+IFxyXG4gICAgcHJldi50aGVuKCgpID0+IFxyXG4gICAgICAgIHYuZXhlYyhjdXIpKSwgUHJvbWlzZS5yZXNvbHZlKClcclxuKS5cclxuICAgIHRoZW4oKCkgPT4ge1xyXG4gICAgICAgIGlmKHN0YXJ0dXBfY29tbWFuZHMubGVuZ3RoID4gMCkge1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB2LmRlbGltaXRlcihjaGFsay5ib2xkLmdyZWVuKGA+YCkpLlxyXG4gICAgICAgICAgICBzaG93KCk7XHJcbiAgICB9KTtcclxuXHJcbiJdLCJuYW1lcyI6WyJjcmVhdGVGaWx0ZXIiLCJnbG9iIiwidG9tbCIsInRlcnNlciIsInNwYXduIiwicG0yIiwid2F0Y2giLCJleGVjIiwic3RvcCIsImNoYWxrIiwidmVyc2lvbiIsImNvbW1hbmRzIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQVNBLE1BQU0sV0FBVyxH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
