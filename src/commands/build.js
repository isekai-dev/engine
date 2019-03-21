import toml_to_js from "../transforms/toml_to_js.js";
import rollup from "rollup";

import get_list from "../lib/get_list.js";
import filter_list from "../lib/filter_list.js";

export default ({
    command: `build [CLASS...]`,
    help: `build all [CLASS] files.`,
    autocomplete: get_list(),
    hidden: true,
    handler: ({ CLASS = get_list() }) => 
        filter_list(CLASS)(async (target) => {
            const { build_info, name } = await toml_to_js(`./CLASS/${target}.toml`);
            const bundle = await rollup.rollup(build_info);

            /*
             * console.log(`Generating output...`);
             * const { output } = await bundle.generate(build_info.output);
             */

            // console.log(output);
            await bundle.write(build_info.output);
            console.log(`[${name}] Build Complete.\r\n`);
        }).
            then((promises) => {
                console.log(`Built ${promises.length} [CLASS] file(s).`);
            })
});