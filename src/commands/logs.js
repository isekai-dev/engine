import pm2 from "./pm2.js";

export default ({
    command: `logs [AVATARS...]`,
    help: `follow the active [AVATAR] logs`,
    handler: ({ AVATARS = [] }) => 
        new Promise(() => 
            pm2.handler({
                commands: [ `logs`, ...AVATARS ]
            }))
});