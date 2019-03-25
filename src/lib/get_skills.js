import path from "path";
import glob from "glob";

// don't really support overrides
const glob_obj = (glob_path, obj = {}) => glob.sync(glob_path).
    reduce((obj, equip_path) => {
        const project_name = path.basename(path.resolve(equip_path, `..`, `..`));
        const skill_name = path.basename(equip_path);

        if(obj[skill_name]) {
        // prevents hijacking
            throw new Error(`${skill_name} from ${project_name} overlaps ${obj[skill_name]}`);
        }
    
        return { 
            [skill_name]: path.relative(process.cwd(), path.resolve(equip_path, `..`, `..`)),
            ...obj 
        };
    }, obj);


export default () => ({
    SKILLS: glob_obj(`./SKILLS/*/`),
    SHOP: glob_obj(`./node_modules/*/SKILLS/*/`, glob_obj(`./node_modules/@*/*/SKILLS/*/`)),
});
