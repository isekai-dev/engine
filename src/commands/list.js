import get_list from "../lib/get_list.js";

export default ({
    help: `list available classes`,
    handler: (args, cb) => {
        console.log(get_list().
            join(` - `), `\r\n`);    
            
        cb();
    }
});