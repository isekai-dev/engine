import pm2 from "pm2";

import toml_to_js from "../transforms/toml_to_js.js";
import get_list from "../lib/get_list.js";
import filter_list from "../lib/filter_list.js";


export default ({
    commander: `spawn [CHARACTERS...]`,
    help: `spawn [CHARACTERS] files`,
    hidden: true,
    handler: ({
        CHARACTERS = get_list()
    }) => {
        filter_list(CHARACTERS)((name) => {
            const {
                output,
            } = toml_to_js(`./CHARACTERS/${name}.toml`);

            pm2.start({
                name,
                script: output,
                watch: `./${output}`,
                force: true,
                watch_options: {
                    // yup PM2 was setting a default ignore
                    ignored: ``,
                    usePolling: true
                },
                max_restart: 0
            });
        });

    }
});
