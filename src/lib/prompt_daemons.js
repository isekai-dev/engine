import get_list from "../lib/get_list.js";
import filter_list from "../lib/filter_list.js";

export default ({
    cmd,
    DAEMONS
}) => {
    if(!DAEMONS) {
        return cmd.prompt({
            type: `list`,
            name: `DAEMON`,
            message: `Which [DAEMON]?`,
            choices: [ `all`, ...get_list() ]
        }).
            then(({ DAEMON }) => {
                console.log(DAEMON, `DAEMON`);
                
                return DAEMON === `all` 
                    ? get_list() 
                    : filter_list([ DAEMON ]);
            });
    }
    
    if(DAEMONS[0] === `all`) {
        return get_list();
    }

    return filter_list(DAEMONS);
};