import niceware from "niceware";

export default ({
    HTTP_ADMIN: {
        pass_strength = 16,
        pass_phrase
    }
}) => {
    if(!pass_phrase) {
        pass_phrase = niceware.generatePassphrase(16);
        console.log(`GENERATED PASS PHRASE: ${pass_phrase}`);
    }

};
