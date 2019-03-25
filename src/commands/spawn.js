import pm2 from "pm2";

import toml_to_js from "../transforms/toml_to_js.js";

import prompt_avatars from "../lib/prompt_avatars.js";

export default ({
    commander: `spawn [AVATARS...]`,
    help: `spawn [AVATARS] files`,
    hidden: true,
    async handler({ AVATARS }) {
        const avatars = await prompt_avatars({
            cmd: this,
            AVATARS
        });

        avatars.forEach((avatar) => {
            const {
                output,
            } = toml_to_js(`./AVATARS/${avatar}.toml`);

            // HACK: could name the file of the TOML something gnarly
            pm2.start({
                name: avatar,
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
