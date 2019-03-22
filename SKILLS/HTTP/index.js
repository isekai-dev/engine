import express from "express";
import greenlock from "greenlock-express";
import http from "http";

export default ({
    HTTP: {
        ssl = false,
        port = 8080
    },
    SET
}) => {
    const app = express();

    if(ssl) {
        const {
            agreeTos,
            email,
            approvedDomains,
            configDir = `~/.config/ssl`,
            communityMember = false,
            telemetry = false,
            ssl_port = 443,
            redirect = 80
        } = ssl;

        if(!agreeTos || !email || !approvedDomains) {
            const not_filled = Object.entries({ 
                agreeTos,
                email,
                approvedDomains 
            }).
                filter(([ , value ]) => 
                    value).
                map((key) => 
                    key).
                join(` - `);

            throw new Error(`You've enabled SSL but not configured SSL: ${not_filled}`);
        }
    
        greenlock.create({
            telemetry,
            agreeTos,
            email,
            configDir,
            communityMember,
            approvedDomains,
            app,
        }).
            listen(ssl_port, () => {
                console.log(`[HTTPS]`);
                console.log(`BIFROST SECURED`);
            });

        
        if(redirect) {
            const redirectApp = express();
    
            console.log(`Redirecting to HTTP to HTTPS`);

            redirectApp.all(`*`, (req, res) => {  
                res.redirect(`https://${req.headers.host}${req.url}`);
                res.end();
            });

            http.createServer(redirectApp).
                listen(redirect);

        }

    } else {
        app.listen(port, () => {
            console.log(`⚠️[HTTP]⚠️`);
            console.log(`BIFROST INSECURE`);
            console.log(`Listening on http://localhost:8080`);
        });
    }
    
    SET({
        HTTP: app
    });
};