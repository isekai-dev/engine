import fs from "fs";
import toml from "toml";
import path from "path";
import glob from "glob";
import c from "chalk";
import builders from "../rollup/builders.js";

c.enabled = true;
c.level = 3;

const log_equip = (equip) => 
    c.yellow(equip);

export default (configFile) => 
    // Mix Config File in and run these in order
    Object.values({
        gather_equipment: () => 
            ({
                EQUIPMENT: glob.sync(`./SHOP/*/`).
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
