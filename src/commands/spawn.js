import pm2 from "pm2";

import toml_to_js from "../transforms/toml_to_js.js";

import prompt_daemons from "../lib/prompt_daemons.js";

export default ({
    commander: `spawn [DAEMONS...]`,
    help: `spawn [DAEMONS] files`,
    hidden: true,
    async handler({ DAEMONS }) {
        const DAEMONs = await prompt_daemons({
            cmd: this,
            DAEMONS
        });

        DAEMONs.forEach((DAEMON) => {
            const {
                output,
            } = toml_to_js(`./DAEMONS/${DAEMON}.toml`);

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
    }
});
