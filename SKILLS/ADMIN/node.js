import niceware from "niceware";

export default ({
    HTTP,
    HTTP_ADMIN: {
        pass_strength = 8,
        pass_phrase,
        path = `/isekai`
    }
}) => {
    if(!pass_phrase) {
        pass_phrase = niceware.generatePassphrase(pass_strength);
        console.log(`ADMIN ZALGO: ${pass_phrase.
            join(` `)}`);
    }
};
