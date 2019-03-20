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
var watcher = _interopDefault(require('chokidar'));
var pm2 = _interopDefault(require('pm2'));
var child_process = require('child_process');

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
                `${output}\t${key},\r\n`, ``);

            write(`isekai.EQUIP({\r\n${keys}});`);

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

var f0 = ({
    command: `build [classes...]`,
    help: `build all [CLASS] files.`,
    autocomplete: get_list(),
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

var f5 = ({
    command: `watch [classes...]`,
    help: `watch [CLASS] files for changes and rebuild.`,
    handler: ({ classes = get_list() }) =>
        filter_list(classes)((target) => {
            const data = toml_to_js(`./CLASS/${target}.toml`);
            
            const { build_info } = data;
        
            // rebuild on file chagne
            watcher.watch(target).
                on(`change`, () => {
                    toml_to_js(target);
                });

            rollup.watch({
                ...build_info,
                watch: {
                    clearScreen: true
                }   
            }).
                on(`event`, action({
                    BUNDLE_END: () => {
                        console.log(`[BUILD DONE]`);
                    },
                    FATAL: ({ error }) => {
                        console.error(c.red.bold(error));
                    }
                }, ({ code }) => 
                    code 
                ));

            return data;
        })
});

var f4 = ({
    help: `spawn [CLASS]`,
    handler: (path) => {
        const {
            output,
            name
        } = toml_to_js(path);

        pm2.start({
            name,
            script: output,
            watch: true,
            max_restart: 5 
        });
    }
});

// pipe out to pm2

var f3 = ({
    help: `excute a pm2 command`,
    handler: (cmd) => 
        child_process.spawn(`node`, `${__dirname}/../node_modules/pm2/bin/pm2 ${cmd}`.split(` `), {
            env: process.env,
            stdio: `inherit`
        })
});

var f1 = ({
    help: `watch and spawn a [CLASS] then follow logs`, 
    handler: (target) => { 
        f5.handler(target);
        f4.handler(target);
        f3.handler(`logs`);
    }
});

var f2 = ({
    help: `list available classes`,
    handler: (args, cb) => {
        console.log(get_list().
            join(` - `), `\r\n`);    
            
        cb();
    }
});

const res = {};
res["build"] = f0;
res["dev"] = f1;
res["list"] = f2;
res["pm2"] = f3;
res["spawn"] = f4;
res["watch"] = f5;

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
            autocomplete
        }
    ]) => 
        v.command(name, help).
            autocomplete(autocomplete || []).
            action(handler));

v.delimiter(c.bold.green(`>`)).
    show();
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2xpLmpzIiwic291cmNlcyI6WyIuLi9zcmMvcm9sbHVwL3BsdWdpbi1nbG9iLmpzIiwiLi4vc3JjL3JvbGx1cC92ZXJzaW9uLmpzIiwiLi4vc3JjL3JvbGx1cC9idWlsZGVycy5qcyIsIi4uL3NyYy90cmFuc2Zvcm1zL3RvbWxfdG9fanMuanMiLCIuLi9zcmMvbGliL2dldF9saXN0LmpzIiwiLi4vc3JjL2xpYi9maWx0ZXJfbGlzdC5qcyIsIi4uL3NyYy9jb21tYW5kcy9idWlsZC5qcyIsIi4uL3NyYy9saWIvYWN0aW9uLmpzIiwiLi4vc3JjL2NvbW1hbmRzL3dhdGNoLmpzIiwiLi4vc3JjL2NvbW1hbmRzL3NwYXduLmpzIiwiLi4vc3JjL2NvbW1hbmRzL3BtMi5qcyIsIi4uL3NyYy9jb21tYW5kcy9kZXYuanMiLCIuLi9zcmMvY29tbWFuZHMvbGlzdC5qcyIsIi4uL2ZlNzNiYmMwOTE1ODBiMjlkNGYzMjViZDE5NDVlM2YyIiwiLi4vc3JjL2xpYi9mb3JtYXQuanMiLCIuLi9zcmMvY2xpLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIlxyXG5pbXBvcnQgZnMgZnJvbSBcImZzXCI7XHJcbmltcG9ydCBvcyBmcm9tIFwib3NcIjtcclxuaW1wb3J0IGdsb2IgZnJvbSBcImdsb2JcIjtcclxuaW1wb3J0IHBhdGggZnJvbSBcInBhdGhcIjtcclxuaW1wb3J0IG1kNSBmcm9tIFwibWQ1XCI7XHJcblxyXG5pbXBvcnQgeyBjcmVhdGVGaWx0ZXIgfSBmcm9tIFwicm9sbHVwLXBsdWdpbnV0aWxzXCI7XHJcblxyXG5jb25zdCBnZXRGU1ByZWZpeCA9IChwcmVmaXggPSBwcm9jZXNzLmN3ZCgpKSA9PiB7XHJcbiAgICBjb25zdCBwYXJlbnQgPSBwYXRoLmpvaW4ocHJlZml4LCBgLi5gKTtcclxuICAgIGlmIChwYXJlbnQgPT09IHByZWZpeCkge1xyXG4gICAgICAgIHJldHVybiBwcmVmaXg7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIHJldHVybiBnZXRGU1ByZWZpeChwYXJlbnQpO1xyXG59O1xyXG5cclxuY29uc3QgZnNQcmVmaXggPSBnZXRGU1ByZWZpeCgpO1xyXG5jb25zdCByb290UGF0aCA9IHBhdGguam9pbihgL2ApO1xyXG5cclxuY29uc3QgdG9VUkxTdHJpbmcgPSAoZmlsZVBhdGgpID0+IHtcclxuICAgIGNvbnN0IHBhdGhGcmFnbWVudHMgPSBwYXRoLmpvaW4oZmlsZVBhdGgpLlxyXG4gICAgICAgIHJlcGxhY2UoZnNQcmVmaXgsIHJvb3RQYXRoKS5cclxuICAgICAgICBzcGxpdChwYXRoLnNlcCk7XHJcbiAgICBpZiAoIXBhdGguaXNBYnNvbHV0ZShmaWxlUGF0aCkpIHtcclxuICAgICAgICBwYXRoRnJhZ21lbnRzLnVuc2hpZnQoYC5gKTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgcmV0dXJuIHBhdGhGcmFnbWVudHMuam9pbihgL2ApO1xyXG59O1xyXG5cclxuY29uc3QgcmVzb2x2ZU5hbWUgPSAoZnJvbSkgPT4gXHJcbiAgICBmcm9tLnNwbGl0KGAvYCkuXHJcbiAgICAgICAgcG9wKCkuXHJcbiAgICAgICAgc3BsaXQoYC5gKS5cclxuICAgICAgICBzaGlmdCgpO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgKHsgXHJcbiAgICBpbmNsdWRlLCBcclxuICAgIGV4Y2x1ZGUgXHJcbn0gPSBmYWxzZSkgPT4ge1xyXG4gICAgY29uc3QgZmlsdGVyID0gY3JlYXRlRmlsdGVyKGluY2x1ZGUsIGV4Y2x1ZGUpO1xyXG4gICAgXHJcbiAgICByZXR1cm4ge1xyXG4gICAgICAgIG5hbWU6IGByb2xsdXAtZ2xvYmAsXHJcbiAgICAgICAgbG9hZDogKGlkKSA9PiB7XHJcbiAgICAgICAgICAgIGNvbnN0IHNyY0ZpbGUgPSBwYXRoLmpvaW4ob3MudG1wZGlyKCksIGlkKTtcclxuXHJcbiAgICAgICAgICAgIGxldCBvcHRpb25zO1xyXG4gICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgb3B0aW9ucyA9IEpTT04ucGFyc2UoZnMucmVhZEZpbGVTeW5jKHNyY0ZpbGUpKTtcclxuICAgICAgICAgICAgfSBjYXRjaChlcnIpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgY29uc3QgeyBpbXBvcnRlZSwgaW1wb3J0ZXIgfSA9IG9wdGlvbnM7XHJcblxyXG4gICAgICAgICAgICBjb25zdCBpbXBvcnRlZUlzQWJzb2x1dGUgPSBwYXRoLmlzQWJzb2x1dGUoaW1wb3J0ZWUpO1xyXG4gICAgICAgICAgICBjb25zdCBjd2QgPSBwYXRoLmRpcm5hbWUoaW1wb3J0ZXIpO1xyXG4gICAgICAgICAgICBjb25zdCBnbG9iUGF0dGVybiA9IGltcG9ydGVlO1xyXG5cclxuICAgICAgICAgICAgY29uc3QgZmlsZXMgPSBnbG9iLnN5bmMoZ2xvYlBhdHRlcm4sIHtcclxuICAgICAgICAgICAgICAgIGN3ZFxyXG4gICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgIGxldCBjb2RlID0gWyBgY29uc3QgcmVzID0ge307YCBdO1xyXG4gICAgICAgICAgICBsZXQgaW1wb3J0QXJyYXkgPSBbXTtcclxuXHJcbiAgICAgICAgICAgIGZpbGVzLmZvckVhY2goKGZpbGUsIGkpID0+IHtcclxuICAgICAgICAgICAgICAgIGxldCBmcm9tO1xyXG4gICAgICAgICAgICAgICAgaWYgKGltcG9ydGVlSXNBYnNvbHV0ZSkge1xyXG4gICAgICAgICAgICAgICAgICAgIGZyb20gPSB0b1VSTFN0cmluZyhmaWxlKTtcclxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgZnJvbSA9IHRvVVJMU3RyaW5nKHBhdGgucmVzb2x2ZShjd2QsIGZpbGUpKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGNvZGUucHVzaChgaW1wb3J0IGYke2l9IGZyb20gXCIke2Zyb219XCI7YCk7XHJcbiAgICAgICAgICAgICAgICBjb2RlLnB1c2goYHJlc1tcIiR7cmVzb2x2ZU5hbWUoZnJvbSl9XCJdID0gZiR7aX07YCk7XHJcbiAgICAgICAgICAgICAgICBpbXBvcnRBcnJheS5wdXNoKGZyb20pO1xyXG4gICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgIGNvZGUucHVzaChgZXhwb3J0IGRlZmF1bHQgcmVzO2ApO1xyXG5cclxuICAgICAgICAgICAgY29kZSA9IGNvZGUuam9pbihgXFxuYCk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgICAgIHJldHVybiBjb2RlO1xyXG5cclxuICAgICAgICB9LFxyXG4gICAgICAgIHJlc29sdmVJZDogKGltcG9ydGVlLCBpbXBvcnRlcikgPT4ge1xyXG4gICAgICAgICAgICBpZiAoIWZpbHRlcihpbXBvcnRlZSkgfHwgIWltcG9ydGVlLmluY2x1ZGVzKGAqYCkpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgY29uc3QgaGFzaCA9IG1kNShpbXBvcnRlZSArIGltcG9ydGVyKTtcclxuXHJcbiAgICAgICAgICAgIGZzLndyaXRlRmlsZVN5bmMocGF0aC5qb2luKG9zLnRtcGRpcigpLCBoYXNoKSwgSlNPTi5zdHJpbmdpZnkoe1xyXG4gICAgICAgICAgICAgICAgaW1wb3J0ZWUsXHJcbiAgICAgICAgICAgICAgICBpbXBvcnRlclxyXG4gICAgICAgICAgICB9KSk7XHJcblxyXG4gICAgICAgICAgICByZXR1cm4gaGFzaDtcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG59OyIsImltcG9ydCBmcyBmcm9tIFwiZnNcIjtcclxuXHJcbmV4cG9ydCBkZWZhdWx0ICh7XHJcbiAgICBwYXRoLFxyXG4gICAgdmVyc2lvblxyXG59KSA9PiBcclxuICAgICh7XHJcbiAgICAgICAgbmFtZTogYHJvbGx1cC13cml0ZWAsXHJcbiAgICAgICAgYnVpbGRTdGFydDogKCkgPT4ge1xyXG4gICAgICAgICAgICBmcy53cml0ZUZpbGVTeW5jKHBhdGgsIHZlcnNpb24oKSk7XHJcbiAgICAgICAgfVxyXG4gICAgfSk7IiwiaW1wb3J0IHRvbWwgZnJvbSBcInJvbGx1cC1wbHVnaW4tdG9tbFwiO1xyXG5cclxuXHJcbmltcG9ydCBzdmVsdGUgZnJvbSBcInJvbGx1cC1wbHVnaW4tc3ZlbHRlXCI7XHJcbmltcG9ydCByZXNvbHZlIGZyb20gXCJyb2xsdXAtcGx1Z2luLW5vZGUtcmVzb2x2ZVwiO1xyXG5pbXBvcnQgY29weSBmcm9tIFwicm9sbHVwLXBsdWdpbi1jb3B5LWdsb2JcIjtcclxuaW1wb3J0IHJlcGxhY2UgZnJvbSBcInJvbGx1cC1wbHVnaW4tcmVwbGFjZVwiO1xyXG5cclxuaW1wb3J0IGpzb24gZnJvbSBcInJvbGx1cC1wbHVnaW4tanNvblwiO1xyXG5pbXBvcnQgbWQgZnJvbSBcInJvbGx1cC1wbHVnaW4tY29tbW9ubWFya1wiO1xyXG5pbXBvcnQgY2pzIGZyb20gXCJyb2xsdXAtcGx1Z2luLWNvbW1vbmpzXCI7XHJcblxyXG5pbXBvcnQgeyB0ZXJzZXIgfSBmcm9tIFwicm9sbHVwLXBsdWdpbi10ZXJzZXJcIjtcclxuaW1wb3J0IHV1aWQgZnJvbSBcInV1aWQvdjFcIjtcclxuXHJcbi8qXHJcbiAqIGltcG9ydCBzcHJpdGVzbWl0aCBmcm9tIFwicm9sbHVwLXBsdWdpbi1zcHJpdGVcIjtcclxuICogaW1wb3J0IHRleHR1cmVQYWNrZXIgZnJvbSBcInNwcml0ZXNtaXRoLXRleHR1cmVwYWNrZXJcIjtcclxuICovXHJcblxyXG5pbXBvcnQgZ2xvYiBmcm9tIFwiLi9wbHVnaW4tZ2xvYi5qc1wiO1xyXG5pbXBvcnQgdmVyc2lvbiBmcm9tIFwiLi92ZXJzaW9uLmpzXCI7XHJcblxyXG5jb25zdCBDT0RFX1ZFUlNJT04gPSB1dWlkKCk7XHJcbmNvbnN0IHByb2R1Y3Rpb24gPSAhcHJvY2Vzcy5lbnYuUk9MTFVQX1dBVENIO1xyXG5cclxuY29uc3QgZG9fY29weSA9IChjb3B5T2JqZWN0KSA9PiBcclxuICAgIGNvcHkoT2JqZWN0LmtleXMoY29weU9iamVjdCkuXHJcbiAgICAgICAgbWFwKFxyXG4gICAgICAgICAgICAoa2V5KSA9PiBcclxuICAgICAgICAgICAgICAgICh7XHJcbiAgICAgICAgICAgICAgICAgICAgZmlsZXM6IGtleSxcclxuICAgICAgICAgICAgICAgICAgICBkZXN0OiBjb3B5T2JqZWN0W2tleV1cclxuICAgICAgICAgICAgICAgIH0pXHJcbiAgICAgICAgKSk7XHJcblxyXG5sZXQgQ0xJRU5UX1ZFUlNJT04gPSB1dWlkKCk7XHJcblxyXG5jb25zdCBleHRlcm5hbCA9IFtcclxuICAgIGBleHByZXNzYCxcclxuICAgIGBpc2VrYWlgLFxyXG4gICAgYGZzYCxcclxuICAgIGBodHRwYCxcclxuICAgIGBodHRwc2BcclxuXTtcclxuXHJcbmNvbnN0IG5vZGUgPSAoe1xyXG4gICAgaW5wdXQsXHJcbiAgICBvdXRwdXQsXHJcbiAgICBjb3B5OiBjb3B5T2JqZWN0ID0ge31cclxufSkgPT4gXHJcbiAgICAoe1xyXG4gICAgICAgIGlucHV0LFxyXG4gICAgICAgIG91dHB1dDoge1xyXG4gICAgICAgICAgICBzb3VyY2VtYXA6IGBpbmxpbmVgLFxyXG4gICAgICAgICAgICBmaWxlOiBvdXRwdXQsXHJcbiAgICAgICAgICAgIGZvcm1hdDogYGNqc2AsXHJcbiAgICAgICAgfSxcclxuICAgICAgICBleHRlcm5hbCxcclxuICAgICAgICBwbHVnaW5zOiBbXHJcbiAgICAgICAgICAgIGdsb2IoKSxcclxuICAgICAgICAgICAgcmVwbGFjZSh7XHJcbiAgICAgICAgICAgICAgICBDT0RFX1ZFUlNJT04sXHJcbiAgICAgICAgICAgIH0pLFxyXG4gICAgICAgICAgICBtZCgpLFxyXG4gICAgICAgICAgICBkb19jb3B5KGNvcHlPYmplY3QpLFxyXG4gICAgICAgICAgICB0b21sXHJcbiAgICAgICAgXSxcclxuICAgIH0pO1xyXG5cclxuY29uc3QgYnJvd3NlciA9ICh7XHJcbiAgICBpbnB1dCxcclxuICAgIG91dHB1dCxcclxuICAgIGNzczogY3NzUGF0aCxcclxuICAgIGNvcHk6IGNvcHlPYmplY3QsXHJcbn0pID0+IFxyXG4gICAgKHtcclxuICAgICAgICBpbnB1dCxcclxuICAgICAgICBvdXRwdXQ6IHtcclxuICAgICAgICAgICAgZmlsZTogb3V0cHV0LFxyXG4gICAgICAgICAgICBmb3JtYXQ6IGBpaWZlYCxcclxuICAgICAgICB9LFxyXG4gICAgICAgIGV4dGVybmFsOiBbIGB1dWlkYCwgYHV1aWQvdjFgLCBgcGl4aS5qc2AgXSxcclxuICAgICAgICBwbHVnaW5zOiBbXHJcbiAgICAgICAgLy8gLy8gbWFrZSB0aGlzIGEgcmVhY3RpdmUgcGx1Z2luIHRvIFwiLnRpbGVtYXAuanNvblwiXHJcbiAgICAgICAgLy8gICAgIHNwcml0ZXNtaXRoKHtcclxuICAgICAgICAvLyAgICAgICAgIHNyYzoge1xyXG4gICAgICAgIC8vICAgICAgICAgICAgIGN3ZDogXCIuL2dvYmxpbi5saWZlL0JST1dTRVIuUElYSS9cclxuICAgICAgICAvLyAgICAgICAgICAgICBnbG9iOiBcIioqLyoucG5nXCJcclxuICAgICAgICAvLyAgICAgICAgIH0sXHJcbiAgICAgICAgLy8gICAgICAgICB0YXJnZXQ6IHtcclxuICAgICAgICAvLyAgICAgICAgICAgICBpbWFnZTogXCIuL2Jpbi9wdWJsaWMvaW1hZ2VzL3Nwcml0ZS5wbmdcIixcclxuICAgICAgICAvLyAgICAgICAgICAgICBjc3M6IFwiLi9iaW4vcHVibGljL2FydC9kZWZhdWx0Lmpzb25cIlxyXG4gICAgICAgIC8vICAgICAgICAgfSxcclxuICAgICAgICAvLyAgICAgICAgIG91dHB1dDoge1xyXG4gICAgICAgIC8vICAgICAgICAgICAgIGltYWdlOiBcIi4vYmluL3B1YmxpYy9pbWFnZXMvc3ByaXRlLnBuZ1wiXHJcbiAgICAgICAgLy8gICAgICAgICB9LFxyXG4gICAgICAgIC8vICAgICAgICAgc3ByaXRlc21pdGhPcHRpb25zOiB7XHJcbiAgICAgICAgLy8gICAgICAgICAgICAgcGFkZGluZzogMFxyXG4gICAgICAgIC8vICAgICAgICAgfSxcclxuICAgICAgICAvLyAgICAgICAgIGN1c3RvbVRlbXBsYXRlOiB0ZXh0dXJlUGFja2VyXHJcbiAgICAgICAgLy8gICAgIH0pLFxyXG4gICAgICAgICAgICBnbG9iKCksXHJcbiAgICAgICAgICAgIGNqcyh7XHJcbiAgICAgICAgICAgICAgICBpbmNsdWRlOiBgbm9kZV9tb2R1bGVzLyoqYCwgXHJcbiAgICAgICAgICAgIH0pLFxyXG4gICAgICAgICAgICBqc29uKCksXHJcbiAgICAgICAgICAgIHJlcGxhY2Uoe1xyXG4gICAgICAgICAgICAgICAgQ09ERV9WRVJTSU9OLFxyXG4gICAgICAgICAgICAgICAgQ0xJRU5UX1ZFUlNJT046ICgpID0+IFxyXG4gICAgICAgICAgICAgICAgICAgIENMSUVOVF9WRVJTSU9OXHJcbiAgICAgICAgICAgIH0pLFxyXG4gICAgICAgICAgICB0b21sLFxyXG4gICAgICAgICAgICBtZCgpLFxyXG4gICAgICAgICAgICBzdmVsdGUoe1xyXG4gICAgICAgICAgICAgICAgY3NzOiAoY3NzKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgY3NzLndyaXRlKGNzc1BhdGgpO1xyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgfSksXHJcbiAgICAgICAgICAgIHJlc29sdmUoKSxcclxuICAgICAgICAgICAgcHJvZHVjdGlvbiAmJiB0ZXJzZXIoKSxcclxuICAgICAgICAgICAgZG9fY29weShjb3B5T2JqZWN0KSxcclxuICAgICAgICAgICAgdmVyc2lvbih7XHJcbiAgICAgICAgICAgICAgICBwYXRoOiBgLi8uTUFHSUMvY2xpZW50LnZlcnNpb25gLFxyXG4gICAgICAgICAgICAgICAgdmVyc2lvbjogKCkgPT4gXHJcbiAgICAgICAgICAgICAgICAgICAgQ0xJRU5UX1ZFUlNJT05cclxuICAgICAgICAgICAgfSlcclxuICAgICAgICBdXHJcbiAgICB9KTtcclxuXHJcbmV4cG9ydCBkZWZhdWx0IHtcclxuICAgIG5vZGUsXHJcbiAgICBicm93c2VyXHJcbn07IiwiaW1wb3J0IGZzIGZyb20gXCJmc1wiO1xyXG5pbXBvcnQgdG9tbCBmcm9tIFwidG9tbFwiO1xyXG5pbXBvcnQgcGF0aCBmcm9tIFwicGF0aFwiO1xyXG5pbXBvcnQgZ2xvYiBmcm9tIFwiZ2xvYlwiO1xyXG5pbXBvcnQgYyBmcm9tIFwiY2hhbGtcIjtcclxuaW1wb3J0IGJ1aWxkZXJzIGZyb20gXCIuLi9yb2xsdXAvYnVpbGRlcnMuanNcIjtcclxuXHJcbmMuZW5hYmxlZCA9IHRydWU7XHJcbmMubGV2ZWwgPSAzO1xyXG5cclxuY29uc3QgbG9nX2VxdWlwID0gKGVxdWlwKSA9PiBcclxuICAgIGMueWVsbG93KGVxdWlwKTtcclxuXHJcbmV4cG9ydCBkZWZhdWx0IChjb25maWdGaWxlKSA9PiBcclxuICAgIC8vIE1peCBDb25maWcgRmlsZSBpbiBhbmQgcnVuIHRoZXNlIGluIG9yZGVyXHJcbiAgICBPYmplY3QudmFsdWVzKHtcclxuICAgICAgICBnYXRoZXJfZXF1aXBtZW50OiAoKSA9PiBcclxuICAgICAgICAgICAgKHtcclxuICAgICAgICAgICAgICAgIEVRVUlQTUVOVDogZ2xvYi5zeW5jKGAuL1NIT1AvKi9gKS5cclxuICAgICAgICAgICAgICAgICAgICByZWR1Y2UoKG9iaiwgZXF1aXBfcGF0aCkgPT4gXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICh7IFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgW3BhdGguYmFzZW5hbWUoZXF1aXBfcGF0aCldOiB0cnVlLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLi4ub2JqIFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB9KSwge30pXHJcbiAgICAgICAgICAgIH0pLFxyXG4gICAgICAgIHJlYWRfY29uZmlnOiAoe1xyXG4gICAgICAgICAgICBjb25maWdGaWxlLFxyXG4gICAgICAgIH0pID0+IHtcclxuICAgICAgICAvLyB2ZXJpZnkgdG9tbCBleGlzdHNcclxuICAgICAgICAgICAgbGV0IHJhdztcclxuXHJcbiAgICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgICAgICByYXcgPSBmcy5yZWFkRmlsZVN5bmMoY29uZmlnRmlsZSwgYHV0Zi04YCk7XHJcbiAgICAgICAgICAgIH0gY2F0Y2ggKGV4Y2VwdGlvbikge1xyXG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBDb3VsZG4ndCByZWFkICR7Y29uZmlnRmlsZX0uIEFyZSB5b3Ugc3VyZSB0aGlzIHBhdGggaXMgY29ycmVjdD9gKTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgY29uc3QgY29uZmlnID0gdG9tbC5wYXJzZShyYXcpO1xyXG5cclxuICAgICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgICAgIGNvbmZpZyxcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICB9LFxyXG5cclxuICAgICAgICBzZXRfbmFtZXM6ICh7XHJcbiAgICAgICAgICAgIGNvbmZpZ0ZpbGUsXHJcbiAgICAgICAgICAgIGNvbmZpZ1xyXG4gICAgICAgIH0pID0+IHtcclxuICAgICAgICAgICAgY29uc3QgbmFtZSA9IHBhdGguYmFzZW5hbWUoY29uZmlnRmlsZSwgYC50b21sYCk7XHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbJHtuYW1lfV0gJHtjb25maWcuTk9ERSA/IGBOT0RFYCA6IGBCUk9XU0VSYH0gYnVpbGQgc3RhcnRlZC5gKTtcclxuXHJcbiAgICAgICAgICAgIGNvbnN0IHBhY2thZ2VfcGF0aCA9IHBhdGguZGlybmFtZShwYXRoLnJlc29sdmUoY29uZmlnRmlsZSkpO1xyXG4gICAgICAgICAgICBjb25zdCBwYWNrYWdlX25hbWUgPSBwYWNrYWdlX3BhdGguXHJcbiAgICAgICAgICAgICAgICBzcGxpdChwYXRoLnNlcCkuXHJcbiAgICAgICAgICAgICAgICBwb3AoKTtcclxuXHJcbiAgICAgICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgICAgICBwYWNrYWdlX3BhdGgsXHJcbiAgICAgICAgICAgICAgICBwYWNrYWdlX25hbWUsXHJcbiAgICAgICAgICAgICAgICBuYW1lLFxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgIH0sXHJcblxyXG4gICAgICAgIHdyaXRlX2VudHJ5OiAoe1xyXG4gICAgICAgICAgICBjb25maWcsXHJcbiAgICAgICAgICAgIG5hbWUsXHJcbiAgICAgICAgICAgIEVRVUlQTUVOVCxcclxuICAgICAgICB9KSA9PiB7XHJcbiAgICAgICAgLy8gV1JJVEUgT1VUIEZJTEVcclxuICAgICAgICAgICAgbGV0IGVudHJ5ID0gYGA7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBjb25zdCB3cml0ZSA9IChkYXRhKSA9PiBcclxuICAgICAgICAgICAgICAgIGVudHJ5ICs9IGAke2RhdGF9XFxyXFxuYDtcclxuICAgICAgICBcclxuICAgICAgICAgICAgd3JpdGUoYGltcG9ydCBpc2VrYWkgZnJvbSBcImlzZWthaVwiO2ApO1xyXG4gICAgICAgICAgICB3cml0ZShgaXNla2FpLlNFVCgke0pTT04uc3RyaW5naWZ5KGNvbmZpZyl9KTtgKTtcclxuICAgICAgICAgICAgd3JpdGUoYGApO1xyXG4gICAgXHJcbiAgICAgICAgICAgIGNvbnN0IGVxdWlwZWQgPSBPYmplY3Qua2V5cyhjb25maWcpLlxyXG4gICAgICAgICAgICAgICAgZmlsdGVyKChrZXkpID0+IFxyXG4gICAgICAgICAgICAgICAgICAgIGtleSA9PT0ga2V5LnRvVXBwZXJDYXNlKCkgJiYgRVFVSVBNRU5UW2tleV0pLlxyXG4gICAgICAgICAgICAgICAgbWFwKChrZXkpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICB3cml0ZShgaW1wb3J0ICR7a2V5fSBmcm9tIFwiLi4vU0hPUC8ke2tleX0vaW5kZXguanNcIjtgKTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGtleTtcclxuICAgICAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgY29uc3Qga2V5cyA9IGVxdWlwZWQucmVkdWNlKChvdXRwdXQsIGtleSkgPT4gXHJcbiAgICAgICAgICAgICAgICBgJHtvdXRwdXR9XFx0JHtrZXl9LFxcclxcbmAsIGBgKTtcclxuXHJcbiAgICAgICAgICAgIHdyaXRlKGBpc2VrYWkuRVFVSVAoe1xcclxcbiR7a2V5c319KTtgKTtcclxuXHJcbiAgICAgICAgICAgIGNvbnN0IGlucHV0ID0gcGF0aC5qb2luKGAuTUFHSUNgLCBgJHtuYW1lfS5lbnRyeS5qc2ApO1xyXG5cclxuICAgICAgICAgICAgLy8gd3JpdGUgb3V0IHRoZWlyIGluZGV4LmpzXHJcbiAgICAgICAgICAgIGZzLndyaXRlRmlsZVN5bmMoaW5wdXQsIGVudHJ5LCBgdXRmLThgKTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGBcclxuWyR7bmFtZX1dXHJcblNIT1A6XHJcbiR7T2JqZWN0LmtleXMoRVFVSVBNRU5UKS5cclxuICAgICAgICBtYXAobG9nX2VxdWlwKS5cclxuICAgICAgICBqb2luKGAgLSBgKX1cclxuXHJcbkVRVUlQUEVEOlxyXG4ke2MucmVkKGVxdWlwZWQuam9pbihgIC0gYCkpfVxyXG5gKTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgICAgICBpbnB1dFxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgIH0sXHJcblxyXG4gICAgICAgIHJ1bl9idWlsZGVyczogKHtcclxuICAgICAgICAgICAgaW5wdXQsXHJcbiAgICAgICAgICAgIG5hbWUsXHJcbiAgICAgICAgICAgIGNvbmZpZyxcclxuICAgICAgICB9KSA9PiB7XHJcbiAgICAgICAgICAgIGNvbnN0IHRhcmdldCA9IGNvbmZpZy5OT0RFIFxyXG4gICAgICAgICAgICAgICAgPyBgTk9ERWAgXHJcbiAgICAgICAgICAgICAgICA6IGBCUk9XU0VSYDtcclxuXHJcbiAgICAgICAgICAgIGNvbnN0IG91dHB1dCA9IGAuTUFHSUMvJHtuYW1lfS4ke3RhcmdldH0uanNgO1xyXG5cclxuICAgICAgICAgICAgaWYoY29uZmlnLk5PREUgJiYgY29uZmlnLkJST1dTRVIpIHtcclxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgWW91IGNhbm5vdCB0YXJnZXQgYm90aCBbTk9ERV0gYW5kIFtCUk9XU0VSXWApO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBpZihjb25maWcuTk9ERSkgeyAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgICAgICAgICBvdXRwdXQsXHJcbiAgICAgICAgICAgICAgICAgICAgYnVpbGRfaW5mbzogYnVpbGRlcnMubm9kZSh7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlucHV0LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBvdXRwdXRcclxuICAgICAgICAgICAgICAgICAgICB9KVxyXG4gICAgICAgICAgICAgICAgfTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgICAgICBpZihjb25maWcuQlJPV1NFUikge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgICAgICAgICBvdXRwdXQsXHJcbiAgICAgICAgICAgICAgICAgICAgYnVpbGRfaW5mbzogYnVpbGRlcnMuYnJvd3Nlcih7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlucHV0LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBvdXRwdXRcclxuICAgICAgICAgICAgICAgICAgICB9KVxyXG4gICAgICAgICAgICAgICAgfTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBZb3UgbXVzdCBzcGVjaWZ5IGVpdGhlciBbTk9ERV0gb3IgW0JST1dTRVJdIGZvciB5b3VyIHRhcmdldGApO1xyXG4gICAgICAgIH1cclxuICAgIH0pLlxyXG4gICAgICAgIHJlZHVjZSgoc3RhdGUsIGZuKSA9PiBcclxuICAgICAgICAgICAgKHtcclxuICAgICAgICAgICAgICAgIC4uLnN0YXRlLFxyXG4gICAgICAgICAgICAgICAgLi4uZm4oc3RhdGUpXHJcbiAgICAgICAgICAgIH0pLCB7IGNvbmZpZ0ZpbGUgfSk7XHJcbiIsImltcG9ydCBnbG9iIGZyb20gXCJnbG9iXCI7XHJcbmltcG9ydCBwYXRoIGZyb20gXCJwYXRoXCI7XHJcblxyXG5leHBvcnQgZGVmYXVsdCAoKSA9PiBcclxuICAgIGdsb2Iuc3luYyhgLi9DTEFTUy8qLnRvbWxgKS5cclxuICAgICAgICBtYXAoKGNsYXNzX3BhdGgpID0+IFxyXG4gICAgICAgICAgICBwYXRoLmJhc2VuYW1lKGNsYXNzX3BhdGgsIGAudG9tbGApKTsiLCJpbXBvcnQgZ2V0X2xpc3QgZnJvbSBcIi4vZ2V0X2xpc3QuanNcIjtcclxuXHJcbmV4cG9ydCBkZWZhdWx0IChjbGFzc2VzKSA9PiBcclxuICAgIChmbikgPT4gXHJcbiAgICAgICAgUHJvbWlzZS5hbGwoY2xhc3Nlcy5maWx0ZXIoKHRhcmdldCkgPT4ge1xyXG4gICAgICAgICAgICBjb25zdCBpc19va2F5ID0gZ2V0X2xpc3QoKS5cclxuICAgICAgICAgICAgICAgIGluZGV4T2YodGFyZ2V0KSAhPT0gLTE7XHJcblxyXG4gICAgICAgICAgICBpZighaXNfb2theSkge1xyXG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coYCR7dGFyZ2V0fSBpcyBub3QgYW4gYXZhaWxhYmxlIFtDTEFTU11gKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgICAgICByZXR1cm4gaXNfb2theTtcclxuICAgICAgICB9KS5cclxuICAgICAgICAgICAgbWFwKGZuKSk7XHJcbiIsImltcG9ydCB0b21sX3RvX2pzIGZyb20gXCIuLi90cmFuc2Zvcm1zL3RvbWxfdG9fanMuanNcIjtcclxuaW1wb3J0IHJvbGx1cCBmcm9tIFwicm9sbHVwXCI7XHJcblxyXG5pbXBvcnQgZ2V0X2xpc3QgZnJvbSBcIi4uL2xpYi9nZXRfbGlzdC5qc1wiO1xyXG5pbXBvcnQgZmlsdGVyX2xpc3QgZnJvbSBcIi4uL2xpYi9maWx0ZXJfbGlzdC5qc1wiO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgKHtcclxuICAgIGNvbW1hbmQ6IGBidWlsZCBbY2xhc3Nlcy4uLl1gLFxyXG4gICAgaGVscDogYGJ1aWxkIGFsbCBbQ0xBU1NdIGZpbGVzLmAsXHJcbiAgICBhdXRvY29tcGxldGU6IGdldF9saXN0KCksXHJcbiAgICBoYW5kbGVyOiAoeyBjbGFzc2VzID0gZ2V0X2xpc3QoKSB9KSA9PiBcclxuICAgICAgICBmaWx0ZXJfbGlzdChjbGFzc2VzKShhc3luYyAodGFyZ2V0KSA9PiB7XHJcbiAgICAgICAgICAgIGNvbnN0IHsgYnVpbGRfaW5mbywgbmFtZSB9ID0gYXdhaXQgdG9tbF90b19qcyhgLi9DTEFTUy8ke3RhcmdldH0udG9tbGApO1xyXG4gICAgICAgICAgICBjb25zdCBidW5kbGUgPSBhd2FpdCByb2xsdXAucm9sbHVwKGJ1aWxkX2luZm8pO1xyXG5cclxuICAgICAgICAgICAgLypcclxuICAgICAgICAgICAgICogY29uc29sZS5sb2coYEdlbmVyYXRpbmcgb3V0cHV0Li4uYCk7XHJcbiAgICAgICAgICAgICAqIGNvbnN0IHsgb3V0cHV0IH0gPSBhd2FpdCBidW5kbGUuZ2VuZXJhdGUoYnVpbGRfaW5mby5vdXRwdXQpO1xyXG4gICAgICAgICAgICAgKi9cclxuXHJcbiAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKG91dHB1dCk7XHJcbiAgICAgICAgICAgIGF3YWl0IGJ1bmRsZS53cml0ZShidWlsZF9pbmZvLm91dHB1dCk7XHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbJHtuYW1lfV0gQnVpbGQgQ29tcGxldGUuXFxyXFxuYCk7XHJcbiAgICAgICAgfSkuXHJcbiAgICAgICAgICAgIHRoZW4oKHByb21pc2VzKSA9PiB7XHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgQnVpbHQgJHtwcm9taXNlcy5sZW5ndGh9IFtDTEFTU10gZmlsZShzKS5gKTtcclxuICAgICAgICAgICAgfSlcclxufSk7IiwiZXhwb3J0IGRlZmF1bHQgKFxyXG4gICAgYWN0aW9uX21hcCwgXHJcbiAgICByZWR1Y2VyID0gKGkpID0+IFxyXG4gICAgICAgIGlcclxuKSA9PiBcclxuICAgIChpbnB1dCkgPT4ge1xyXG4gICAgICAgIGNvbnN0IGtleSA9IHJlZHVjZXIoaW5wdXQpO1xyXG5cclxuICAgICAgICBpZighYWN0aW9uX21hcFtrZXldKSB7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJldHVybiBhY3Rpb25fbWFwW2tleV0oaW5wdXQpO1xyXG4gICAgfTsiLCJpbXBvcnQgd2F0Y2hlciBmcm9tIFwiY2hva2lkYXJcIjtcclxuaW1wb3J0IHJvbGx1cCBmcm9tIFwicm9sbHVwXCI7XHJcbmltcG9ydCBjIGZyb20gXCJjaGFsa1wiO1xyXG5cclxuaW1wb3J0IHRvbWxfdG9fanMgZnJvbSBcIi4uL3RyYW5zZm9ybXMvdG9tbF90b19qcy5qc1wiO1xyXG5cclxuaW1wb3J0IGFjdGlvbiBmcm9tIFwiLi4vbGliL2FjdGlvbi5qc1wiO1xyXG5pbXBvcnQgZmlsdGVyX2xpc3QgZnJvbSBcIi4uL2xpYi9maWx0ZXJfbGlzdC5qc1wiO1xyXG5pbXBvcnQgZ2V0X2xpc3QgZnJvbSBcIi4uL2xpYi9nZXRfbGlzdC5qc1wiO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgKHtcclxuICAgIGNvbW1hbmQ6IGB3YXRjaCBbY2xhc3Nlcy4uLl1gLFxyXG4gICAgaGVscDogYHdhdGNoIFtDTEFTU10gZmlsZXMgZm9yIGNoYW5nZXMgYW5kIHJlYnVpbGQuYCxcclxuICAgIGhhbmRsZXI6ICh7IGNsYXNzZXMgPSBnZXRfbGlzdCgpIH0pID0+XHJcbiAgICAgICAgZmlsdGVyX2xpc3QoY2xhc3NlcykoKHRhcmdldCkgPT4ge1xyXG4gICAgICAgICAgICBjb25zdCBkYXRhID0gdG9tbF90b19qcyhgLi9DTEFTUy8ke3RhcmdldH0udG9tbGApO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgY29uc3QgeyBidWlsZF9pbmZvIH0gPSBkYXRhO1xyXG4gICAgICAgIFxyXG4gICAgICAgICAgICAvLyByZWJ1aWxkIG9uIGZpbGUgY2hhZ25lXHJcbiAgICAgICAgICAgIHdhdGNoZXIud2F0Y2godGFyZ2V0KS5cclxuICAgICAgICAgICAgICAgIG9uKGBjaGFuZ2VgLCAoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgdG9tbF90b19qcyh0YXJnZXQpO1xyXG4gICAgICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICByb2xsdXAud2F0Y2goe1xyXG4gICAgICAgICAgICAgICAgLi4uYnVpbGRfaW5mbyxcclxuICAgICAgICAgICAgICAgIHdhdGNoOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgY2xlYXJTY3JlZW46IHRydWVcclxuICAgICAgICAgICAgICAgIH0gICBcclxuICAgICAgICAgICAgfSkuXHJcbiAgICAgICAgICAgICAgICBvbihgZXZlbnRgLCBhY3Rpb24oe1xyXG4gICAgICAgICAgICAgICAgICAgIEJVTkRMRV9FTkQ6ICgpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coYFtCVUlMRCBET05FXWApO1xyXG4gICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgRkFUQUw6ICh7IGVycm9yIH0pID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihjLnJlZC5ib2xkKGVycm9yKSk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfSwgKHsgY29kZSB9KSA9PiBcclxuICAgICAgICAgICAgICAgICAgICBjb2RlIFxyXG4gICAgICAgICAgICAgICAgKSk7XHJcblxyXG4gICAgICAgICAgICByZXR1cm4gZGF0YTtcclxuICAgICAgICB9KVxyXG59KTtcclxuIiwiaW1wb3J0IHBtMiBmcm9tIFwicG0yXCI7XHJcblxyXG5pbXBvcnQgdG9tbF90b19qcyBmcm9tIFwiLi4vdHJhbnNmb3Jtcy90b21sX3RvX2pzLmpzXCI7XHJcblxyXG5leHBvcnQgZGVmYXVsdCAoe1xyXG4gICAgaGVscDogYHNwYXduIFtDTEFTU11gLFxyXG4gICAgaGFuZGxlcjogKHBhdGgpID0+IHtcclxuICAgICAgICBjb25zdCB7XHJcbiAgICAgICAgICAgIG91dHB1dCxcclxuICAgICAgICAgICAgbmFtZVxyXG4gICAgICAgIH0gPSB0b21sX3RvX2pzKHBhdGgpO1xyXG5cclxuICAgICAgICBwbTIuc3RhcnQoe1xyXG4gICAgICAgICAgICBuYW1lLFxyXG4gICAgICAgICAgICBzY3JpcHQ6IG91dHB1dCxcclxuICAgICAgICAgICAgd2F0Y2g6IHRydWUsXHJcbiAgICAgICAgICAgIG1heF9yZXN0YXJ0OiA1IFxyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG59KTtcclxuIiwiLy8gcGlwZSBvdXQgdG8gcG0yXHJcbmltcG9ydCB7IHNwYXduIH0gZnJvbSBcImNoaWxkX3Byb2Nlc3NcIjtcclxuXHJcbmV4cG9ydCBkZWZhdWx0ICh7XHJcbiAgICBoZWxwOiBgZXhjdXRlIGEgcG0yIGNvbW1hbmRgLFxyXG4gICAgaGFuZGxlcjogKGNtZCkgPT4gXHJcbiAgICAgICAgc3Bhd24oYG5vZGVgLCBgJHtfX2Rpcm5hbWV9Ly4uL25vZGVfbW9kdWxlcy9wbTIvYmluL3BtMiAke2NtZH1gLnNwbGl0KGAgYCksIHtcclxuICAgICAgICAgICAgZW52OiBwcm9jZXNzLmVudixcclxuICAgICAgICAgICAgc3RkaW86IGBpbmhlcml0YFxyXG4gICAgICAgIH0pXHJcbn0pOyIsImltcG9ydCB3YXRjaCBmcm9tIFwiLi93YXRjaC5qc1wiO1xyXG5pbXBvcnQgc3Bhd24gZnJvbSBcIi4vc3Bhd24uanNcIjtcclxuaW1wb3J0IGV4ZWMgZnJvbSBcIi4vcG0yLmpzXCI7XHJcblxyXG5leHBvcnQgZGVmYXVsdCAoe1xyXG4gICAgaGVscDogYHdhdGNoIGFuZCBzcGF3biBhIFtDTEFTU10gdGhlbiBmb2xsb3cgbG9nc2AsIFxyXG4gICAgaGFuZGxlcjogKHRhcmdldCkgPT4geyBcclxuICAgICAgICB3YXRjaC5oYW5kbGVyKHRhcmdldCk7XHJcbiAgICAgICAgc3Bhd24uaGFuZGxlcih0YXJnZXQpO1xyXG4gICAgICAgIGV4ZWMuaGFuZGxlcihgbG9nc2ApO1xyXG4gICAgfVxyXG59KTtcclxuXHJcbiIsImltcG9ydCBnZXRfbGlzdCBmcm9tIFwiLi4vbGliL2dldF9saXN0LmpzXCI7XHJcblxyXG5leHBvcnQgZGVmYXVsdCAoe1xyXG4gICAgaGVscDogYGxpc3QgYXZhaWxhYmxlIGNsYXNzZXNgLFxyXG4gICAgaGFuZGxlcjogKGFyZ3MsIGNiKSA9PiB7XHJcbiAgICAgICAgY29uc29sZS5sb2coZ2V0X2xpc3QoKS5cclxuICAgICAgICAgICAgam9pbihgIC0gYCksIGBcXHJcXG5gKTsgICAgXHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgIGNiKCk7XHJcbiAgICB9XHJcbn0pOyIsImNvbnN0IHJlcyA9IHt9O1xuaW1wb3J0IGYwIGZyb20gXCIvVXNlcnMvR2FtZXMvUHJvamVjdHMvSVNFS0FJL3NyYy9jb21tYW5kcy9idWlsZC5qc1wiO1xucmVzW1wiYnVpbGRcIl0gPSBmMDtcbmltcG9ydCBmMSBmcm9tIFwiL1VzZXJzL0dhbWVzL1Byb2plY3RzL0lTRUtBSS9zcmMvY29tbWFuZHMvZGV2LmpzXCI7XG5yZXNbXCJkZXZcIl0gPSBmMTtcbmltcG9ydCBmMiBmcm9tIFwiL1VzZXJzL0dhbWVzL1Byb2plY3RzL0lTRUtBSS9zcmMvY29tbWFuZHMvbGlzdC5qc1wiO1xucmVzW1wibGlzdFwiXSA9IGYyO1xuaW1wb3J0IGYzIGZyb20gXCIvVXNlcnMvR2FtZXMvUHJvamVjdHMvSVNFS0FJL3NyYy9jb21tYW5kcy9wbTIuanNcIjtcbnJlc1tcInBtMlwiXSA9IGYzO1xuaW1wb3J0IGY0IGZyb20gXCIvVXNlcnMvR2FtZXMvUHJvamVjdHMvSVNFS0FJL3NyYy9jb21tYW5kcy9zcGF3bi5qc1wiO1xucmVzW1wic3Bhd25cIl0gPSBmNDtcbmltcG9ydCBmNSBmcm9tIFwiL1VzZXJzL0dhbWVzL1Byb2plY3RzL0lTRUtBSS9zcmMvY29tbWFuZHMvd2F0Y2guanNcIjtcbnJlc1tcIndhdGNoXCJdID0gZjU7XG5leHBvcnQgZGVmYXVsdCByZXM7IiwiaW1wb3J0IGMgZnJvbSBcImNoYWxrXCI7XHJcblxyXG5jb25zdCB7IGxvZyB9ID0gY29uc29sZTtcclxuXHJcbmNvbnNvbGUubG9nID0gKC4uLmFyZ3MpID0+IFxyXG4gICAgbG9nKFxyXG4gICAgICAgIC4uLmFyZ3MubWFwKFxyXG4gICAgICAgICAgICAoaXRlbSkgPT4gXHJcbiAgICAgICAgICAgICAgICB0eXBlb2YgaXRlbSA9PT0gYHN0cmluZ2BcclxuICAgICAgICAgICAgICAgICAgICA/IGMuZ3JlZW4oXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGl0ZW0ucmVwbGFjZSgvKFxcWy5bXlxcXVxcW10qXFxdKS91ZywgYy5ib2xkLndoaXRlKGAkMWApKVxyXG4gICAgICAgICAgICAgICAgICAgIClcclxuICAgICAgICAgICAgICAgICAgICA6IGl0ZW1cclxuICAgICAgICApXHJcbiAgICApO1xyXG4iLCIjIS91c3IvYmluL2VudiBub2RlXHJcblxyXG5pbXBvcnQgdm9ycGFsIGZyb20gXCJ2b3JwYWxcIjtcclxuaW1wb3J0IGNvbW1hbmRzIGZyb20gXCIuL2NvbW1hbmRzLyouanNcIjtcclxuaW1wb3J0IHsgdmVyc2lvbiB9IGZyb20gXCIuLi9wYWNrYWdlLmpzb25cIjtcclxuXHJcbmltcG9ydCBcIi4vbGliL2Zvcm1hdC5qc1wiO1xyXG5cclxuaW1wb3J0IGNoYWxrIGZyb20gXCJjaGFsa1wiO1xyXG5cclxuY29uc3QgdiA9IHZvcnBhbCgpO1xyXG5wcm9jZXNzLnN0ZG91dC53cml0ZShgXFx4MUJjYCk7XHJcblxyXG5jb25zb2xlLmxvZyhjaGFsay5ncmVlbihgXHJcbuKWiOKWiOKVl+KWiOKWiOKWiOKWiOKWiOKWiOKWiOKVl+KWiOKWiOKWiOKWiOKWiOKWiOKWiOKVl+KWiOKWiOKVlyAg4paI4paI4pWXIOKWiOKWiOKWiOKWiOKWiOKVlyDilojilojilZcgICAgICDilojilojilojilojilojilojilojilZfilojilojilojilZcgICDilojilojilZcg4paI4paI4paI4paI4paI4paI4pWXIOKWiOKWiOKVl+KWiOKWiOKWiOKVlyAgIOKWiOKWiOKVl+KWiOKWiOKWiOKWiOKWiOKWiOKWiOKVlyAgICBcclxu4paI4paI4pWR4paI4paI4pWU4pWQ4pWQ4pWQ4pWQ4pWd4paI4paI4pWU4pWQ4pWQ4pWQ4pWQ4pWd4paI4paI4pWRIOKWiOKWiOKVlOKVneKWiOKWiOKVlOKVkOKVkOKWiOKWiOKVl+KWiOKWiOKVkeKWhCDilojilojilZfiloTilojilojilZTilZDilZDilZDilZDilZ3ilojilojilojilojilZcgIOKWiOKWiOKVkeKWiOKWiOKVlOKVkOKVkOKVkOKVkOKVnSDilojilojilZHilojilojilojilojilZcgIOKWiOKWiOKVkeKWiOKWiOKVlOKVkOKVkOKVkOKVkOKVnSAgICBcclxu4paI4paI4pWR4paI4paI4paI4paI4paI4paI4paI4pWX4paI4paI4paI4paI4paI4pWXICDilojilojilojilojilojilZTilZ0g4paI4paI4paI4paI4paI4paI4paI4pWR4paI4paI4pWRIOKWiOKWiOKWiOKWiOKVl+KWiOKWiOKWiOKWiOKWiOKVlyAg4paI4paI4pWU4paI4paI4pWXIOKWiOKWiOKVkeKWiOKWiOKVkSAg4paI4paI4paI4pWX4paI4paI4pWR4paI4paI4pWU4paI4paI4pWXIOKWiOKWiOKVkeKWiOKWiOKWiOKWiOKWiOKVlyAgICAgIFxyXG7ilojilojilZHilZrilZDilZDilZDilZDilojilojilZHilojilojilZTilZDilZDilZ0gIOKWiOKWiOKVlOKVkOKWiOKWiOKVlyDilojilojilZTilZDilZDilojilojilZHilojilojilZHiloDilZrilojilojilZTiloDilojilojilZTilZDilZDilZ0gIOKWiOKWiOKVkeKVmuKWiOKWiOKVl+KWiOKWiOKVkeKWiOKWiOKVkSAgIOKWiOKWiOKVkeKWiOKWiOKVkeKWiOKWiOKVkeKVmuKWiOKWiOKVl+KWiOKWiOKVkeKWiOKWiOKVlOKVkOKVkOKVnSAgICAgIFxyXG7ilojilojilZHilojilojilojilojilojilojilojilZHilojilojilojilojilojilojilojilZfilojilojilZEgIOKWiOKWiOKVl+KWiOKWiOKVkSAg4paI4paI4pWR4paI4paI4pWRICDilZrilZDilZ0g4paI4paI4paI4paI4paI4paI4paI4pWX4paI4paI4pWRIOKVmuKWiOKWiOKWiOKWiOKVkeKVmuKWiOKWiOKWiOKWiOKWiOKWiOKVlOKVneKWiOKWiOKVkeKWiOKWiOKVkSDilZrilojilojilojilojilZHilojilojilojilojilojilojilojilZcgICAgXHJcbuKVmuKVkOKVneKVmuKVkOKVkOKVkOKVkOKVkOKVkOKVneKVmuKVkOKVkOKVkOKVkOKVkOKVkOKVneKVmuKVkOKVnSAg4pWa4pWQ4pWd4pWa4pWQ4pWdICDilZrilZDilZ3ilZrilZDilZ0gICAgICDilZrilZDilZDilZDilZDilZDilZDilZ3ilZrilZDilZ0gIOKVmuKVkOKVkOKVkOKVnSDilZrilZDilZDilZDilZDilZDilZ0g4pWa4pWQ4pWd4pWa4pWQ4pWdICDilZrilZDilZDilZDilZ3ilZrilZDilZDilZDilZDilZDilZDilZ0gICAgXHJcblZFUlNJT046ICR7dmVyc2lvbn0gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxyXG5gKSk7XHJcblxyXG5PYmplY3QuZW50cmllcyhjb21tYW5kcykuXHJcbiAgICBmb3JFYWNoKChbXHJcbiAgICAgICAgbmFtZSwge1xyXG4gICAgICAgICAgICBoZWxwLFxyXG4gICAgICAgICAgICBoYW5kbGVyLFxyXG4gICAgICAgICAgICBhdXRvY29tcGxldGVcclxuICAgICAgICB9XHJcbiAgICBdKSA9PiBcclxuICAgICAgICB2LmNvbW1hbmQobmFtZSwgaGVscCkuXHJcbiAgICAgICAgICAgIGF1dG9jb21wbGV0ZShhdXRvY29tcGxldGUgfHwgW10pLlxyXG4gICAgICAgICAgICBhY3Rpb24oaGFuZGxlcikpO1xyXG5cclxudi5kZWxpbWl0ZXIoY2hhbGsuYm9sZC5ncmVlbihgPmApKS5cclxuICAgIHNob3coKTsiXSwibmFtZXMiOlsiY3JlYXRlRmlsdGVyIiwiZ2xvYiIsInRvbWwiLCJ0ZXJzZXIiLCJzcGF3biIsIndhdGNoIiwiZXhlYyIsImNoYWxrIiwidmVyc2lvbiIsImNvbW1hbmRzIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQVNBLE1BQU0sV0FBVyxHQUFHLENBQUMsTUFBTSxHQUFHLE9BQU8sQ0FBQyxHQUFHLEVBQUUsS0FBSztJQUM1QyxNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFDdkMsSUFBSSxNQUFNLEtBQUssTUFBTSxFQUFFO1FBQ25CLE9BQU8sTUFBTSxDQUFDO0tBQ2pCOztJQUVELE9BQU8sV0FBVyxDQUFDLE1BQU0sQ0FBQyxDQUFDO0NBQzlCLENBQUM7O0FBRUYsTUFBTSxRQUFRLEdBQUcsV0FBVyxFQUFFLENBQUM7QUFDL0IsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7O0FBRWhDLE1BQU0sV0FBVyxHQUFHLENBQUMsUUFBUSxLQUFLO0lBQzlCLE1BQU0sYUFBYSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDO1FBQ3JDLE9BQU8sQ0FBQyxRQUFRLEVBQUUsUUFBUSxDQUFDO1FBQzNCLEtBQUssQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDcEIsSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsUUFBUSxDQUFDLEVBQUU7UUFDNUIsYUFBYSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7S0FDOUI7O0lBRUQsT0FBTyxhQUFhLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztDQUNsQyxDQUFDOztBQUVGLE1BQU0sV0FBVyxHQUFHLENBQUMsSUFBSTtJQUNyQixJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDWCxHQUFHLEVBQUU7UUFDTCxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNWLEtBQUssRUFBRSxDQUFDOztBQUVoQixXQUFlLENBQUM7SUFDWixPQUFPO0lBQ1AsT0FBTztDQUNWLEdBQUcsS0FBSyxLQUFLO0lBQ1YsTUFBTSxNQUFNLEdBQUdBLDhCQUFZLENBQUMsT0FBTyxFQUFFLE9BQU8sQ0FBQyxDQUFDOztJQUU5QyxPQUFPO1FBQ0gsSUFBSSxFQUFFLENBQUMsV0FBVyxDQUFDO1FBQ25CLElBQUksRUFBRSxDQUFDLEVBQUUsS0FBSztZQUNWLE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLE1BQU0sRUFBRSxFQUFFLEVBQUUsQ0FBQyxDQUFDOztZQUUzQyxJQUFJLE9BQU8sQ0FBQztZQUNaLElBQUk7Z0JBQ0EsT0FBTyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLFlBQVksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO2FBQ2xELENBQUMsTUFBTSxHQUFHLEVBQUU7Z0JBQ1QsT0FBTzthQUNWOztZQUVELE1BQU0sRUFBRSxRQUFRLEVBQUUsUUFBUSxFQUFFLEdBQUcsT0FBTyxDQUFDOztZQUV2QyxNQUFNLGtCQUFrQixHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsUUFBUSxDQUFDLENBQUM7WUFDckQsTUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQztZQUNuQyxNQUFNLFdBQVcsR0FBRyxRQUFRLENBQUM7O1lBRTdCLE1BQU0sS0FBSyxHQUFHQyxNQUFJLENBQUMsSUFBSSxDQUFDLFdBQVcsRUFBRTtnQkFDakMsR0FBRzthQUNOLENBQUMsQ0FBQzs7WUFFSCxJQUFJLElBQUksR0FBRyxFQUFFLENBQUMsZUFBZSxDQUFDLEVBQUUsQ0FBQztBQUM3QztZQUVZLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxLQUFLO2dCQUN2QixJQUFJLElBQUksQ0FBQztnQkFDVCxJQUFJLGtCQUFrQixFQUFFO29CQUNwQixJQUFJLEdBQUcsV0FBVyxDQUFDLElBQUksQ0FBQyxDQUFDO2lCQUM1QixNQUFNO29CQUNILElBQUksR0FBRyxXQUFXLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQztpQkFDL0M7Z0JBQ0QsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUMsT0FBTyxFQUFFLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO2dCQUMxQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsS0FBSyxFQUFFLFdBQVcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDbEUsYUFDYSxDQUFDLENBQUM7O1lBRUgsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLG1CQUFtQixDQUFDLENBQUMsQ0FBQzs7WUFFakMsSUFBSSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDOztZQUV2QixPQUFPLElBQUksQ0FBQzs7U0FFZjtRQUNELFNBQVMsRUFBRSxDQUFDLFFBQVEsRUFBRSxRQUFRLEtBQUs7WUFDL0IsSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFO2dCQUM5QyxPQUFPO2FBQ1Y7O1lBRUQsTUFBTSxJQUFJLEdBQUcsR0FBRyxDQUFDLFFBQVEsR0FBRyxRQUFRLENBQUMsQ0FBQzs7WUFFdEMsRUFBRSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxNQUFNLEVBQUUsRUFBRSxJQUFJLENBQUMsRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDO2dCQUMxRCxRQUFRO2dCQUNSLFFBQVE7YUFDWCxDQUFDLENBQUMsQ0FBQzs7WUFFSixPQUFPLElBQUksQ0FBQztTQUNmO0tBQ0osQ0FBQztDQUNMOztBQ3JHRCxjQUFlLENBQUM7SUFDWixJQUFJO0lBQ0osT0FBTztDQUNWO0tBQ0k7UUFDRyxJQUFJLEVBQUUsQ0FBQyxZQUFZLENBQUM7UUFDcEIsVUFBVSxFQUFFLE1BQU07WUFDZCxFQUFFLENBQUMsYUFBYSxDQUFDLElBQUksRUFBRSxPQUFPLEVBQUUsQ0FBQyxDQUFDO1NBQ3JDO0tBQ0osQ0FBQzs7QUNZTixNQUFNLFlBQVksR0FBRyxJQUFJLEVBQUUsQ0FBQztBQUM1QixNQUFNLFVBQVUsR0FBRyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsWUFBWSxDQUFDOztBQUU3QyxNQUFNLE9BQU8sR0FBRyxDQUFDLFVBQVU7SUFDdkIsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDO1FBQ3hCLEdBQUc7WUFDQyxDQUFDLEdBQUc7aUJBQ0M7b0JBQ0csS0FBSyxFQUFFLEdBQUc7b0JBQ1YsSUFBSSxFQUFFLFVBQVUsQ0FBQyxHQUFHLENBQUM7aUJBQ3hCLENBQUM7U0FDVCxDQUFDLENBQUM7O0FBRVgsSUFBSSxjQUFjLEdBQUcsSUFBSSxFQUFFLENBQUM7O0FBRTVCLE1BQU0sUUFBUSxHQUFHO0lBQ2IsQ0FBQyxPQUFPLENBQUM7SUFDVCxDQUFDLE1BQU0sQ0FBQztJQUNSLENBQUMsRUFBRSxDQUFDO0lBQ0osQ0FBQyxJQUFJLENBQUM7SUFDTixDQUFDLEtBQUssQ0FBQztDQUNWLENBQUM7O0FBRUYsTUFBTSxJQUFJLEdBQUcsQ0FBQztJQUNWLEtBQUs7SUFDTCxNQUFNO0lBQ04sSUFBSSxFQUFFLFVBQVUsR0FBRyxFQUFFO0NBQ3hCO0tBQ0k7UUFDRyxLQUFLO1FBQ0wsTUFBTSxFQUFFO1lBQ0osU0FBUyxFQUFFLENBQUMsTUFBTSxDQUFDO1lBQ25CLElBQUksRUFBRSxNQUFNO1lBQ1osTUFBTSxFQUFFLENBQUMsR0FBRyxDQUFDO1NBQ2hCO1FBQ0QsUUFBUTtRQUNSLE9BQU8sRUFBRTtZQUNMLElBQUksRUFBRTtZQUNOLE9BQU8sQ0FBQztnQkFDSixZQUFZO2FBQ2YsQ0FBQztZQUNGLEVBQUUsRUFBRTtZQUNKLE9BQU8sQ0FBQyxVQUFVLENBQUM7WUFDbkJDLE1BQUk7U0FDUDtLQUNKLENBQUMsQ0FBQzs7QUFFUCxNQUFNLE9BQU8sR0FBRyxDQUFDO0lBQ2IsS0FBSztJQUNMLE1BQU07SUFDTixHQUFHLEVBQUUsT0FBTztJQUNaLElBQUksRUFBRSxVQUFVO0NBQ25CO0tBQ0k7UUFDRyxLQUFLO1FBQ0wsTUFBTSxFQUFFO1lBQ0osSUFBSSxFQUFFLE1BQU07WUFDWixNQUFNLEVBQUUsQ0FBQyxJQUFJLENBQUM7U0FDakI7UUFDRCxRQUFRLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxPQUFPLENBQUMsRUFBRTtRQUMxQyxPQUFPLEVBQUU7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7WUFtQkwsSUFBSSxFQUFFO1lBQ04sR0FBRyxDQUFDO2dCQUNBLE9BQU8sRUFBRSxDQUFDLGVBQWUsQ0FBQzthQUM3QixDQUFDO1lBQ0YsSUFBSSxFQUFFO1lBQ04sT0FBTyxDQUFDO2dCQUNKLFlBQVk7Z0JBQ1osY0FBYyxFQUFFO29CQUNaLGNBQWM7YUFDckIsQ0FBQztZQUNGQSxNQUFJO1lBQ0osRUFBRSxFQUFFO1lBQ0osTUFBTSxDQUFDO2dCQUNILEdBQUcsRUFBRSxDQUFDLEdBQUcsS0FBSztvQkFDVixHQUFHLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDO2lCQUN0QjthQUNKLENBQUM7WUFDRixPQUFPLEVBQUU7WUFDVCxVQUFVLElBQUlDLHlCQUFNLEVBQUU7WUFDdEIsT0FBTyxDQUFDLFVBQVUsQ0FBQztZQUNuQixPQUFPLENBQUM7Z0JBQ0osSUFBSSxFQUFFLENBQUMsdUJBQXVCLENBQUM7Z0JBQy9CLE9BQU8sRUFBRTtvQkFDTCxjQUFjO2FBQ3JCLENBQUM7U0FDTDtLQUNKLENBQUMsQ0FBQzs7QUFFUCxlQUFlO0lBQ1gsSUFBSTtJQUNKLE9BQU87Q0FDVjs7QUM5SEQsQ0FBQyxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUM7QUFDakIsQ0FBQyxDQUFDLEtBQUssR0FBRyxDQUFDLENBQUM7O0FBRVosTUFBTSxTQUFTLEdBQUcsQ0FBQyxLQUFLO0lBQ3BCLENBQUMsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUM7O0FBRXBCLGlCQUFlLENBQUMsVUFBVTs7SUFFdEIsTUFBTSxDQUFDLE1BQU0sQ0FBQztRQUNWLGdCQUFnQixFQUFFO2FBQ2I7Z0JBQ0csU0FBUyxFQUFFRixNQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUM7b0JBQzdCLE1BQU0sQ0FBQyxDQUFDLEdBQUcsRUFBRSxVQUFVO3lCQUNsQjs0QkFDRyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDLEdBQUcsSUFBSTs0QkFDakMsR0FBRyxHQUFHO3lCQUNULENBQUMsRUFBRSxFQUFFLENBQUM7YUFDbEIsQ0FBQztRQUNOLFdBQVcsRUFBRSxDQUFDO1lBQ1YsVUFBVTtTQUNiLEtBQUs7O1lBRUYsSUFBSSxHQUFHLENBQUM7O1lBRVIsSUFBSTtnQkFDQSxHQUFHLEdBQUcsRUFBRSxDQUFDLFlBQVksQ0FBQyxVQUFVLEVBQUUsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO2FBQzlDLENBQUMsT0FBTyxTQUFTLEVBQUU7Z0JBQ2hCLE1BQU0sSUFBSSxLQUFLLENBQUMsQ0FBQyxjQUFjLEVBQUUsVUFBVSxDQUFDLG9DQUFvQyxDQUFDLENBQUMsQ0FBQzthQUN0Rjs7WUFFRCxNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDOztZQUUvQixPQUFPO2dCQUNILE1BQU07YUFDVCxDQUFDO1NBQ0w7O1FBRUQsU0FBUyxFQUFFLENBQUM7WUFDUixVQUFVO1lBQ1YsTUFBTTtTQUNULEtBQUs7WUFDRixNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLFVBQVUsRUFBRSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7WUFDaEQsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsRUFBRSxFQUFFLE1BQU0sQ0FBQyxJQUFJLEdBQUcsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxDQUFDLGVBQWUsQ0FBQyxDQUFDLENBQUM7O1lBRTVFLE1BQU0sWUFBWSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDO1lBQzVELE1BQU0sWUFBWSxHQUFHLFlBQVk7Z0JBQzdCLEtBQUssQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDO2dCQUNmLEdBQUcsRUFBRSxDQUFDOztZQUVWLE9BQU87Z0JBQ0gsWUFBWTtnQkFDWixZQUFZO2dCQUNaLElBQUk7YUFDUCxDQUFDO1NBQ0w7O1FBRUQsV0FBVyxFQUFFLENBQUM7WUFDVixNQUFNO1lBQ04sSUFBSTtZQUNKLFNBQVM7U0FDWixLQUFLOztZQUVGLElBQUksS0FBSyxHQUFHLENBQUMsQ0FBQyxDQUFDOztZQUVmLE1BQU0sS0FBSyxHQUFHLENBQUMsSUFBSTtnQkFDZixLQUFLLElBQUksQ0FBQyxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQzs7WUFFM0IsS0FBSyxDQUFDLENBQUMsNEJBQTRCLENBQUMsQ0FBQyxDQUFDO1lBQ3RDLEtBQUssQ0FBQyxDQUFDLFdBQVcsRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7WUFDaEQsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7O1lBRVYsTUFBTSxPQUFPLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUM7Z0JBQy9CLE1BQU0sQ0FBQyxDQUFDLEdBQUc7b0JBQ1AsR0FBRyxLQUFLLEdBQUcsQ0FBQyxXQUFXLEVBQUUsSUFBSSxTQUFTLENBQUMsR0FBRyxDQUFDLENBQUM7Z0JBQ2hELEdBQUcsQ0FBQyxDQUFDLEdBQUcsS0FBSztvQkFDVCxLQUFLLENBQUMsQ0FBQyxPQUFPLEVBQUUsR0FBRyxDQUFDLGVBQWUsRUFBRSxHQUFHLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQzs7b0JBRXZELE9BQU8sR0FBRyxDQUFDO2lCQUNkLENBQUMsQ0FBQzs7WUFFUCxNQUFNLElBQUksR0FBRyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUMsTUFBTSxFQUFFLEdBQUc7Z0JBQ3BDLENBQUMsRUFBRSxNQUFNLENBQUMsRUFBRSxFQUFFLEdBQUcsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDOztZQUVsQyxLQUFLLENBQUMsQ0FBQyxrQkFBa0IsRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQzs7WUFFdEMsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQzs7O1lBR3RELEVBQUUsQ0FBQyxhQUFhLENBQUMsS0FBSyxFQUFFLEtBQUssRUFBRSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7O1lBRXhDLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQztDQUN4QixFQUFFLElBQUksQ0FBQzs7QUFFUixFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDO1FBQ2hCLEdBQUcsQ0FBQyxTQUFTLENBQUM7UUFDZCxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDOzs7QUFHcEIsRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDN0IsQ0FBQyxDQUFDLENBQUM7O1lBRVMsT0FBTztnQkFDSCxLQUFLO2FBQ1IsQ0FBQztTQUNMOztRQUVELFlBQVksRUFBRSxDQUFDO1lBQ1gsS0FBSztZQUNMLElBQUk7WUFDSixNQUFNO1NBQ1QsS0FBSztZQUNGLE1BQU0sTUFBTSxHQUFHLE1BQU0sQ0FBQyxJQUFJO2tCQUNwQixDQUFDLElBQUksQ0FBQztrQkFDTixDQUFDLE9BQU8sQ0FBQyxDQUFDOztZQUVoQixNQUFNLE1BQU0sR0FBRyxDQUFDLE9BQU8sRUFBRSxJQUFJLENBQUMsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQzs7WUFFN0MsR0FBRyxNQUFNLENBQUMsSUFBSSxJQUFJLE1BQU0sQ0FBQyxPQUFPLEVBQUU7Z0JBQzlCLE1BQU0sSUFBSSxLQUFLLENBQUMsQ0FBQywyQ0FBMkMsQ0FBQyxDQUFDLENBQUM7YUFDbEU7O1lBRUQsR0FBRyxNQUFNLENBQUMsSUFBSSxFQUFFO2dCQUNaLE9BQU87b0JBQ0gsTUFBTTtvQkFDTixVQUFVLEVBQUUsUUFBUSxDQUFDLElBQUksQ0FBQzt3QkFDdEIsS0FBSzt3QkFDTCxNQUFNO3FCQUNULENBQUM7aUJBQ0wsQ0FBQzthQUNMOztZQUVELEdBQUcsTUFBTSxDQUFDLE9BQU8sRUFBRTtnQkFDZixPQUFPO29CQUNILE1BQU07b0JBQ04sVUFBVSxFQUFFLFFBQVEsQ0FBQyxPQUFPLENBQUM7d0JBQ3pCLEtBQUs7d0JBQ0wsTUFBTTtxQkFDVCxDQUFDO2lCQUNMLENBQUM7YUFDTDs7WUFFRCxNQUFNLElBQUksS0FBSyxDQUFDLENBQUMsMkRBQTJELENBQUMsQ0FBQyxDQUFDO1NBQ2xGO0tBQ0osQ0FBQztRQUNFLE1BQU0sQ0FBQyxDQUFDLEtBQUssRUFBRSxFQUFFO2FBQ1o7Z0JBQ0csR0FBRyxLQUFLO2dCQUNSLEdBQUcsRUFBRSxDQUFDLEtBQUssQ0FBQzthQUNmLENBQUMsRUFBRSxFQUFFLFVBQVUsRUFBRSxDQUFDLENBQUM7O0FDeEpoQyxlQUFlO0lBQ1hBLE1BQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxjQUFjLENBQUMsQ0FBQztRQUN2QixHQUFHLENBQUMsQ0FBQyxVQUFVO1lBQ1gsSUFBSSxDQUFDLFFBQVEsQ0FBQyxVQUFVLEVBQUUsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDOztrQkNKaEMsQ0FBQyxPQUFPO0lBQ25CLENBQUMsRUFBRTtRQUNDLE9BQU8sQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDLE1BQU0sS0FBSztZQUNuQyxNQUFNLE9BQU8sR0FBRyxRQUFRLEVBQUU7Z0JBQ3RCLE9BQU8sQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQzs7WUFFM0IsR0FBRyxDQUFDLE9BQU8sRUFBRTtnQkFDVCxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxNQUFNLENBQUMsNEJBQTRCLENBQUMsQ0FBQyxDQUFDO2FBQ3hEOztZQUVELE9BQU8sT0FBTyxDQUFDO1NBQ2xCLENBQUM7WUFDRSxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQzs7QUNSckIsU0FBZSxDQUFDO0lBQ1osT0FBTyxFQUFFLENBQUMsa0JBQWtCLENBQUM7SUFDN0IsSUFBSSxFQUFFLENBQUMsd0JBQXdCLENBQUM7SUFDaEMsWUFBWSxFQUFFLFFBQVEsRUFBRTtJQUN4QixPQUFPLEVBQUUsQ0FBQyxFQUFFLE9BQU8sR0FBRyxRQUFRLEVBQUUsRUFBRTtRQUM5QixXQUFXLENBQUMsT0FBTyxDQUFDLENBQUMsT0FBTyxNQUFNLEtBQUs7WUFDbkMsTUFBTSxFQUFFLFVBQVUsRUFBRSxJQUFJLEVBQUUsR0FBRyxNQUFNLFVBQVUsQ0FBQyxDQUFDLFFBQVEsRUFBRSxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztZQUN4RSxNQUFNLE1BQU0sR0FBRyxNQUFNLE1BQU0sQ0FBQyxNQUFNLENBQUMsVUFBVSxDQUFDLENBQUM7Ozs7Ozs7O1lBUS9DLE1BQU0sTUFBTSxDQUFDLEtBQUssQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUM7WUFDdEMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMscUJBQXFCLENBQUMsQ0FBQyxDQUFDO1NBQ2hELENBQUM7WUFDRSxJQUFJLENBQUMsQ0FBQyxRQUFRLEtBQUs7Z0JBQ2YsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQU0sRUFBRSxRQUFRLENBQUMsTUFBTSxDQUFDLGlCQUFpQixDQUFDLENBQUMsQ0FBQzthQUM1RCxDQUFDO0NBQ2I7O0FDM0JELGFBQWU7SUFDWCxVQUFVO0lBQ1YsT0FBTyxHQUFHLENBQUMsQ0FBQztRQUNSLENBQUM7O0lBRUwsQ0FBQyxLQUFLLEtBQUs7UUFDUCxNQUFNLEdBQUcsR0FBRyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUM7O1FBRTNCLEdBQUcsQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLEVBQUU7WUFDakIsT0FBTztTQUNWOztRQUVELE9BQU8sVUFBVSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDO0tBQ2pDOztBQ0hMLFNBQWUsQ0FBQztJQUNaLE9BQU8sRUFBRSxDQUFDLGtCQUFrQixDQUFDO0lBQzdCLElBQUksRUFBRSxDQUFDLDRDQUE0QyxDQUFDO0lBQ3BELE9BQU8sRUFBRSxDQUFDLEVBQUUsT0FBTyxHQUFHLFFBQVEsRUFBRSxFQUFFO1FBQzlCLFdBQVcsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLE1BQU0sS0FBSztZQUM3QixNQUFNLElBQUksR0FBRyxVQUFVLENBQUMsQ0FBQyxRQUFRLEVBQUUsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7O1lBRWxELE1BQU0sRUFBRSxVQUFVLEVBQUUsR0FBRyxJQUFJLENBQUM7OztZQUc1QixPQUFPLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQztnQkFDakIsRUFBRSxDQUFDLENBQUMsTUFBTSxDQUFDLEVBQUUsTUFBTTtvQkFDZixVQUFVLENBQUMsTUFBTSxDQUFDLENBQUM7aUJBQ3RCLENBQUMsQ0FBQzs7WUFFUCxNQUFNLENBQUMsS0FBSyxDQUFDO2dCQUNULEdBQUcsVUFBVTtnQkFDYixLQUFLLEVBQUU7b0JBQ0gsV0FBVyxFQUFFLElBQUk7aUJBQ3BCO2FBQ0osQ0FBQztnQkFDRSxFQUFFLENBQUMsQ0FBQyxLQUFLLENBQUMsRUFBRSxNQUFNLENBQUM7b0JBQ2YsVUFBVSxFQUFFLE1BQU07d0JBQ2QsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUM7cUJBQy9CO29CQUNELEtBQUssRUFBRSxDQUFDLEVBQUUsS0FBSyxFQUFFLEtBQUs7d0JBQ2xCLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztxQkFDcEM7aUJBQ0osRUFBRSxDQUFDLEVBQUUsSUFBSSxFQUFFO29CQUNSLElBQUk7aUJBQ1AsQ0FBQyxDQUFDOztZQUVQLE9BQU8sSUFBSSxDQUFDO1NBQ2YsQ0FBQztDQUNULEVBQUU7O0FDeENILFNBQWUsQ0FBQztJQUNaLElBQUksRUFBRSxDQUFDLGFBQWEsQ0FBQztJQUNyQixPQUFPLEVBQUUsQ0FBQyxJQUFJLEtBQUs7UUFDZixNQUFNO1lBQ0YsTUFBTTtZQUNOLElBQUk7U0FDUCxHQUFHLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQzs7UUFFckIsR0FBRyxDQUFDLEtBQUssQ0FBQztZQUNOLElBQUk7WUFDSixNQUFNLEVBQUUsTUFBTTtZQUNkLEtBQUssRUFBRSxJQUFJO1lBQ1gsV0FBVyxFQUFFLENBQUM7U0FDakIsQ0FBQyxDQUFDO0tBQ047Q0FDSixFQUFFOztBQ25CSDtBQUNBO0FBRUEsU0FBZSxDQUFDO0lBQ1osSUFBSSxFQUFFLENBQUMsb0JBQW9CLENBQUM7SUFDNUIsT0FBTyxFQUFFLENBQUMsR0FBRztRQUNURyxtQkFBSyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxFQUFFLFNBQVMsQ0FBQyw2QkFBNkIsRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUU7WUFDeEUsR0FBRyxFQUFFLE9BQU8sQ0FBQyxHQUFHO1lBQ2hCLEtBQUssRUFBRSxDQUFDLE9BQU8sQ0FBQztTQUNuQixDQUFDO0NBQ1Q7O0FDTkQsU0FBZSxDQUFDO0lBQ1osSUFBSSxFQUFFLENBQUMsMENBQTBDLENBQUM7SUFDbEQsT0FBTyxFQUFFLENBQUMsTUFBTSxLQUFLO1FBQ2pCQyxFQUFLLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQ3RCRCxFQUFLLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQ3RCRSxFQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztLQUN4QjtDQUNKLEVBQUU7O0FDVEgsU0FBZSxDQUFDO0lBQ1osSUFBSSxFQUFFLENBQUMsc0JBQXNCLENBQUM7SUFDOUIsT0FBTyxFQUFFLENBQUMsSUFBSSxFQUFFLEVBQUUsS0FBSztRQUNuQixPQUFPLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFBRTtZQUNsQixJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQzs7UUFFekIsRUFBRSxFQUFFLENBQUM7S0FDUjtDQUNKOztBQ1ZELE1BQU0sR0FBRyxHQUFHLEVBQUUsQ0FBQztBQUVmLEdBQUcsQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFLENBQUM7QUFFbEIsR0FBRyxDQUFDLEtBQUssQ0FBQyxHQUFHLEVBQUUsQ0FBQztBQUVoQixHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsRUFBRSxDQUFDO0FBRWpCLEdBQUcsQ0FBQyxLQUFLLENBQUMsR0FBRyxFQUFFLENBQUM7QUFFaEIsR0FBRyxDQUFDLE9BQU8sQ0FBQyxHQUFHLEVBQUUsQ0FBQztBQUVsQixHQUFHLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRSxDQUFDOzs7O0FDVmxCLE1BQU0sRUFBRSxHQUFHLEVBQUUsR0FBRyxPQUFPLENBQUM7O0FBRXhCLE9BQU8sQ0FBQyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUk7SUFDbEIsR0FBRztRQUNDLEdBQUcsSUFBSSxDQUFDLEdBQUc7WUFDUCxDQUFDLElBQUk7Z0JBQ0QsT0FBTyxJQUFJLEtBQUssQ0FBQyxNQUFNLENBQUM7c0JBQ2xCLENBQUMsQ0FBQyxLQUFLO3dCQUNMLElBQUksQ0FBQyxPQUFPLENBQUMsbUJBQW1CLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO3FCQUN4RDtzQkFDQyxJQUFJO1NBQ2pCO0tBQ0osQ0FBQzs7QUNKTixNQUFNLENBQUMsR0FBRyxNQUFNLEVBQUUsQ0FBQztBQUNuQixPQUFPLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7O0FBRTlCLE9BQU8sQ0FBQyxHQUFHLENBQUNDLENBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQzs7Ozs7OztTQU9oQixFQUFFQyxTQUFPLENBQUM7QUFDbkIsQ0FBQyxDQUFDLENBQUMsQ0FBQzs7QUFFSixNQUFNLENBQUMsT0FBTyxDQUFDQyxHQUFRLENBQUM7SUFDcEIsT0FBTyxDQUFDLENBQUM7UUFDTCxJQUFJLEVBQUU7WUFDRixJQUFJO1lBQ0osT0FBTztZQUNQLFlBQVk7U0FDZjtLQUNKO1FBQ0csQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDO1lBQ2pCLFlBQVksQ0FBQyxZQUFZLElBQUksRUFBRSxDQUFDO1lBQ2hDLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDOztBQUU3QixDQUFDLENBQUMsU0FBUyxDQUFDRixDQUFLLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDOUIsSUFBSSxFQUFFIn0=
