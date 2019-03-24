import { exec } from "child_process";


export default ({
    ZALGO,
    ADMIN: {
        zalgo,
    }
}) => {
    const admin_zalgo = ZALGO({
        zalgo,
        strength: 18,
        handler: () => {
            exec(`npx isekai pull`);
            
            return {
                restart: true
            };
        }
    });

    if(!zalgo) {
        console.log(`ADMIN ZALGO: ${admin_zalgo}`);
    }
};
