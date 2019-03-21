import get_list from "../lib/get_list.js";

export default ({
    help: `Show available [CHARACTER] saves.`,
    alias: [ `ls`, `saves`, `character` ],
    handler: (args, cb) => {
        console.log(get_list().
            map((i) => 
                `[${i}]`).
            join(` - `), `\r\n`);    
            
        cb();
    }
});