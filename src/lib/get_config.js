import toml from "toml";
import fs from "fs";

const get_config = (configFile) => {
    // verify toml exists
    let raw;

    try {
        raw = fs.readFileSync(configFile, `utf-8`);
    } catch (exception) {
        throw new Error(`Couldn't read ${configFile}. Are you sure this path is correct?`);
    }

    const config = toml.parse(raw);

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

export default get_config;