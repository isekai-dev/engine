export default ({
    HTTP
}) => {
    const {
        REPLY = {}
    } = HTTP;

    Object.entries(REPLY).
        forEach(([ path, response ]) => 
            HTTP.get(path, (res) => 
                res.send(response))
        );
};