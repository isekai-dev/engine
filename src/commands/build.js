import toml_to_js from "../transforms/toml_to_js.js";
import rollup from "rollup";

import prompt_avatars from "../lib/prompt_avatars.js";

export default ({
    command: `build [AVATARS...]`,
    help: `build all [AVATAR] save(s).`,
    hidden: true,
    async handler({ AVATARS }) {
        const avatars = await prompt_avatars({ 
            cmd: this,
            AVATARS 
        });

        const built = await Promise.all(avatars.map(async (target) => {
            const { build_info, name } = await toml_to_js(`./AVATARS/${target}.toml`);
            const bundle = await rollup.rollup(build_info);

            await bundle.write(build_info.output);
            console.log(`[${name}] Build Complete.\r\n`);
        }));

        console.log(`Built ${built.length} [AVATAR](s).`);
    }
});