import pm2 from "pm2";

import toml_to_js from "../transforms/toml_to_js.js";

export default ({
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
