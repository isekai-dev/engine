import pm2 from "pm2";

import toml_to_js from "../transforms/toml_to_js.js";
import get_list from "../lib/get_list.js";
import filter_list from "../lib/filter_list.js";


export default ({
    commander: `spawn [AVATARS...]`,
    help: `spawn [AVATARS] files`,
    hidden: true,
    handler: ({
        AVATARS = get_list()
    }) => {
        filter_list(AVATARS)((name) => {
            const {
                output,
            } = toml_to_js(`./AVATARS/${name}.toml`);

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
