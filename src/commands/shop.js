import get_list from "../lib/get_list.js";

export default ({
    help: `Show available [CLASS] files from the [SHOP].`,
    alias: [ `ls` ],
    handler: (args, cb) => {
        console.log(get_list().
            map((i) => 
                `[${i}]`).
            join(` - `), `\r\n`);    
            
        cb();
    }
});