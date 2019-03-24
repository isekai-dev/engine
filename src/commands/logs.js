import pm2 from "../lib/pm2.js";

export default ({
    command: `logs [AVATARS...]`,
    help: `follow the active [AVATAR] logs`,
    handler: ({ AVATARS = [] }) => pm2({
        commands: [ `logs`, ...AVATARS ]
    }).done
    
});