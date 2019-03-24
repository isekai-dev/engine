import exec from "../lib/exec.js";

export default ({
    command: `logs [AVATARS...]`,
    help: `follow the active [AVATAR] logs`,
    handler: ({ AVATARS = [] }) => 
        exec({
            commands: [ `logs`, ...AVATARS ]
        }).done
    
});