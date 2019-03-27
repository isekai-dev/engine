import toml_to_js from "../transforms/toml_to_js.js";
import rollup from "rollup";

import prompt_daemons from "../lib/prompt_daemons.js";

export default ({
    command: `build [DAEMONS...]`,
    help: `build all [DAEMON] save(s).`,
    hidden: true,
    async handler({ DAEMONS }) {
        const DAEMONs = await prompt_daemons({ 
            cmd: this,
            DAEMONS 
        });

        const built = await Promise.all(DAEMONs.map(async (target) => {
            const { build_info, name } = await toml_to_js(`./DAEMONS/${target}.toml`);
            const bundle = await rollup.rollup(build_info);

            await bundle.write(build_info.output);
            console.log(`[${name}] Build Complete.\r\n`);
        }));

        console.log(`Built ${built.length} [DAEMON](s).`);
    }
});