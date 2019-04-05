import pm2 from "pm2";

import toml_to_js from "../transforms/toml_to_js.js";

import prompt_daemons from "../lib/prompt_daemons.js";

export default ({
    commander: `spawn [DAEMONS...]`,
    help: `spawn [DAEMONS] files`,
    hidden: true,
    async handler({ DAEMONS }) {
        const daemons = await prompt_daemons({
            cmd: this,
            DAEMONS
        });

        daemons.forEach((DAEMON) => {
            const {
                output,
                config: {
                    NODE
                }
            } = toml_to_js(`./DAEMONS/${DAEMON}.toml`);

            if(!NODE) {
                return;
            }
            
            // HACK: could name the file of the TOML something gnarly
            pm2.start({
                name: DAEMON,
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

        console.log(`Spawned ${daemons.join(` - `)}`);
    }
});
