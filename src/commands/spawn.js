import pm2 from "pm2";

import toml_to_js from "../transforms/toml_to_js.js";
import get_list from "../lib/get_list.js";
import filter_list from "../lib/filter_list.js";

export default ({
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
