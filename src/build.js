import Class from "./class.js";
import rollup from "rollup";

export default async (target) => {
    const { build_info } = await Class(target);
    const bundle = await rollup.rollup(build_info);

    /*
     * console.log(`Generating output...`);
     * const { output } = await bundle.generate(build_info.output);
     */

    // console.log(output);
    await bundle.write(build_info.output);
};
