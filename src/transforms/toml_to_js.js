import fs from "fs";
import toml from "toml";
import path from "path";
import glob from "glob";
import c from "chalk";
import builders from "../rollup/builders.js";

// don't really support overrides
const glob_obj = (glob_path) => glob.sync(glob_path).
    reduce((obj, equip_path) => {
        const project_name = path.basename(path.resolve(equip_path, `..`, `..`));
        const skill_name = path.basename(equip_path);

        if(obj[skill_name]) {
            // prevents hijacking
            throw new Error(`${skill_name} from ${project_name} overlaps ${obj[skill_name]}`);
        }
        console.log(skill_name);
        
        return { 
            [skill_name]: `../node_modules/${project_name}`,
            ...obj 
        };
    }, {});

// Mix Config File in and run these in order
export default (configFile) => Object.values({
    gather_SKILLS: () => ({
        SKILLS: glob_obj(`./SKILLS/*/`),
        SHOP: glob_obj(`./node_modules/*/SKILLS/*/`)
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
        SHOP
    }) => {
        console.log(`SHOP`, SHOP);
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
                    console.log(`[${key}] was not UPPERCASE silly.`);
                }

                const has_skill = SKILLS[key];
                const in_shop = SHOP[key];
                const is_target = [ `BROWSER`, `NODE` ].indexOf(key) !== -1;

                if(!has_skill && !in_shop && !is_target) {
                    fails.push(key);
                }

                return is_upper && (has_skill || in_shop);
            }).
            map((key) => {
                const where = SHOP[key] 
                    ? `${SHOP[key]}`
                    : `..`;

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
