import pm2 from "pm2";

import toml_to_js from "../transforms/toml_to_js.js";
import get_list from "../lib/get_list.js";

export default ({
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
