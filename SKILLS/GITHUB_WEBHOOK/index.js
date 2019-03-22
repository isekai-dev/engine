import { exec } from "child_process";
import github_hook from "@octokit/webhooks";

export default ({
    HTTP,
    GITHUB_WEBHOOK: {
        secret,
        path = `/github`
    }
}) => {
    const reset = () => {
        const child_proc = exec(`npx isekai update`);
    
        child_proc.stdin.pipe(process.stdin);
        child_proc.stdout.pipe(process.stdout);
        child_proc.stderr.pipe(process.stderr);
    };

    const hook = github_hook({
        path,
        secret,
    });
    
    hook.on(`push`, ({ 
        payload: {
            ref
        }
    }) => {
        const branch = ref.split(`/`).
            pop();
    
        if(branch !== `master`) {
            return;
        }
    
        console.info(`NEW VERSION AVAILABLE`);
        reset();
    });
    
    HTTP.use(hook.middleware);
};

