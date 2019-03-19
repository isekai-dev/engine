import fs from "fs";
import toml from "toml";
import path from "path";
import glob from "glob";

import builders from "./builders";

const Logger = (section) => 
    (...message) => 
        console.log(section, ` ⚙> `, ...message); 

export default (configFile) => 
    // Mix Config File in and run these in order
    Object.values({
        gather_equipment: () => 
            ({
                EQUIPMENT: glob.sync(`./EQUIP/*/`).
                    reduce((obj, equip_path) => 
                        ({ 
                            [path.basename(equip_path)]: true,
                            ...obj 
                        }), {})
            }),
        read_config: ({
            configFile
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
            EQUIPMENT
        }) => {
            const name = path.basename(configFile, `.toml`);

            const log = Logger(name);
            log(`BEGIN COMPOSITION`);
            log(`AVAILABLE EQUIPMENT`, Object.keys(EQUIPMENT).
                join(` - `));

            const package_path = path.dirname(path.resolve(configFile));
            const package_name = package_path.
                split(path.sep).
                pop();

            log(`Paths: \r\n`, Object.entries({
                package_name,
                project_dir_name: package_path,
                name
            }).
                map(([ key, value ]) => 
                    `${key}: ${value}`).
                join(`\r\n`));

            return {
                package_path,
                package_name,
                log,
                name,
            };
        },

        write_entry: ({
            config,
            log,
            name,
            EQUIPMENT
        }) => {
        // WRITE OUT FILE
            log(path.join(__dirname, `../src/**/*`));
    
            let entry = ``;
            
            const write = (data) => 
                entry += `${data}\r\n`;
        
            write(`import Isekai from "@isekai/engine";`);
            write(`Isekai.SET(${JSON.stringify(config)});`);
            write(``);
    
            const equiped = Object.keys(config).
                filter((key) => 
                    key === key.toUpperCase() && EQUIPMENT[key]).
                map((key) => {
                    write(`import ${key} from "../EQUIP/${key}/index.js";`);

                    return key;
                }).
                reduce((output, key) => 
                    `${output}\t${key},\r\n`, ``);

            write(`Isekai.EQUIP({\r\n${equiped}});`);

            const input = path.join(`BIN`, `${name}.entry.js`);
    
            log(`WRITING`, input);
    
            // write out their index.js
            fs.writeFileSync(input, entry, `utf-8`);
    
            return {
                input
            };
        },

        run_builders: ({
            input,
            log,
            name,
            config
        }) => {
            if(config.NODE && config.BROWSER) {
                throw new Error(`You cannot target both [NODE] and [BROWSER]`);
            }

            if(config.NODE) {
                log(`NODE BUILD`);
                
                return {
                    build_info: builders.node({
                        input,
                        output: `BIN/${name}.bundle.js`
                    })
                };
            }
        
            if(config.BROWSER) {
                log(`BROWSER BUILD`);

                return {
                    build_info: builders.browser({
                        input,
                        output: {
                            file: `BIN/${name}.bundle.js`,
                            format: `cjs`,
                        }
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
