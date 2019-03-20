```js
export default ({
    HTTP,
    HTTP_REPLY
}) => {
    Object.entries(HTTP_REPLY).
        forEach(([ path, response ]) => 
            HTTP.get(path, (res) => res.send(response))
        );
};
```