import express from "express";
import fs from "fs";

import https from "https";
import http from "http";

export default ({
    HTTP: {
        ssl = false
    },
    SET
}) => {
    const app = express();

    if(ssl) {
        https.createServer({
            key: fs.readFileSync(`${ssl}/privkey.pem`),
            cert: fs.readFileSync(`${ssl}/cert.pem`),
            ca: fs.readFileSync(`${ssl}/fullchain.pem`)
        }, app).
            listen(443, () => {
                console.log(`[HTTPS]`);
                console.log(`BIFROST SECURED`);
            });

        const redirectApp = express();
    
        console.log(`Redirecting to HTTP to HTTPS`);

        redirectApp.all(`*`, (req, res) => {  
            res.redirect(`https://${req.headers.host}${req.url}`);
            res.end();
        });

        http.createServer(redirectApp).
            listen(80);

    } else {
        app.listen(8080, () => {
            console.log(`⚠️[HTTP]⚠️`);
            console.log(`BIFROST INSECURE`);
            console.log(`Listening on http://localhost:8080`);
        });
    }
    
    SET({
        HTTP: app
    });
};