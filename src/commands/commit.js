import Git from "simple-git/promise";

const git = Git();

export default ({
    command: `commit [message...]`,
    help: `commit current files to source control`,
    handler: ({
        message = [ `Update, no commit message` ]
    }) => git.add([ `.` ]).
        then(() => git.commit(message.join(` `))).
        then(() => console.log(`Commited with message ${message}`))
});