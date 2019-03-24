import exec from "../lib/exec.js";

export default({
    command: `status [AVATAR]`,
    help: `status of active [AVATAR]s.`,
    alias: [ `ps`, `active`, `stats` ],
    handler: () => 
        exec({
            commands: [ `ps` ]
        }).done
});