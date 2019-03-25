import get_list from "../lib/get_list.js";
import filter_list from "../lib/filter_list.js";

export default ({
    cmd,
    AVATARS
}) => {
    if(!AVATARS) {
        return cmd.prompt({
            type: `list`,
            name: `AVATAR`,
            message: `Which [AVATAR]?`,
            choices: [ `all`, ...get_list() ]
        }).
            then(({ AVATAR }) => {
                console.log(AVATAR, `AVATAR`);
                
                return AVATAR === `all` 
                    ? get_list() 
                    : filter_list([ AVATAR ]);
            });
    }
    
    if(AVATARS[0] === `all`) {
        return get_list();
    }

    return filter_list(AVATARS);
};