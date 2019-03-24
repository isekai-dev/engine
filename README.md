<p align="center" class="center">
    <a href="http://isekai.dev">
        <img src="./logo.gif" alt="logo" />
    </a>
</p>
<p align="center" class="center">
    <a href="https://travis-ci.org/isekai-dev/engine">
        <img src="https://img.shields.io/travis/isekai-dev/engine.svg?style=for-the-badge" alt="build status"/>
    </a>
    <a href="https://isekai.dev">
        <img src="https://img.shields.io/website/https/isekai.dev.svg?style=for-the-badge" alt="website">
    </a>
    <a href="https://isekai.dev/log">
        <img src="https://img.shields.io/badge/DEV%20LOG-ONLINE-green.svg?style=for-the-badge" alt="dev log"/>
    </a>
    <a href="http://github.com/isekai-dev/engine">
        <img src="https://img.shields.io/badge/GITHUB-SOURCECODE-blue.svg?style=for-the-badge" alt="source code"/>
    </a>
    <a href="./LICENSE">
        <img src="https://img.shields.io/badge/License-AGPL%20v3-blue.svg?style=for-the-badge" alt="license"/>
    </a>
    <a href="https://discord.gg/kc2nsTc">
        <img src="https://img.shields.io/discord/558071350304964640.svg?style=for-the-badge" alt="discord chat">
    </a>
</p>

# WHAT IS THIS?
[ISEKAI*ENGINE] is the glue that sticks a bunch of opinionated useful software together and then exposes it as TOML configuration to the end user. Let [AVATAR]s handle the heavy work through [SKILL]s. The end goal is for anyone to be able to easily run their own servers for websites, games, social, chat, email and etc. This lets the end user own their own data and be able to do anything they want with it.

# QUICK START
Requires node.js to be installed.

```sh
npm install -g isekai

isekai create <NAME OF YOUR WORLD>
isekai run <NAME OF YOUR WORLD>
```

Your world awaits at [http://localhost:8080]().

# TIPS AND TRICKS
##

Navigate to [http://localhost:8080/admin]() to play God with your world.

Your DATA directory can override anything in BIN/DATA. Use this to mod graphics and stuff.


# BUT WHAT DOES IT DO?
##

Isekai turns configuration TOML files into executable javascript bundles for either node or the browser.



ex:

```toml
[NODE]
[LOG]
[HTTP]
port = 8080

[HTTP_API]
[HTTP_PUBLIC]

# [[HTTP_MD]]
# path = "/"
# file = "README.md"
# template = "default.html
```
into

```js
import isekai from "isekai";
isekai.SET({"NODE":{},"LOG":{},"HTTP":{"port":8080},"HTTP_API":{},"HTTP_PUBLIC":{}});

import LOG from "../SKILLS/LOG/index.js";
import HTTP from "../SKILLS/HTTP/index.js";
import HTTP_API from "../SKILLS/HTTP_API/index.js";
import HTTP_PUBLIC from "../SKILLS/HTTP_PUBLIC/index.js";

isekai.EQUIP({
    LOG,
    HTTP,
    HTTP_API,
    HTTP_PUBLIC,
});
```

HTTP adds an express server APP onto the shared object as HTTP. HTTP_PUBLIC then serves a static HTTP website from the bag contents of HTTP_PUBLIC.

HTTP_PUBLIC.js
```js
import express from "express";

export default ({
    HTTP
}) => {
    HTTP.use(express.static(`../DATA/HTTP_PUBLIC`));
};
```

# BUT WHAT DOES IT REALLY DO?
##

isekai.js
```js
// Stare into the Abyss
const Isekai = ({
    SET: (obj) => 
        Object.entries(obj).
            forEach(([ key, value ]) => {
                Isekai[key] = Isekai[key] || {};
                
                if(typeof value === `function`) {
                    Isekai[key] = Object.assign(value, {
                        ...Isekai[key], 
                        ...value
                    });
                } else {
                    Isekai[key] = Object.assign(Isekai[key], value);
                }
            }),

    EQUIP: (obj) => 
        Object.entries(obj).
            forEach(([ key, fn ]) => {
                Isekai[key] = Isekai[key] || {};
                
                fn(Isekai); 
            })
});

export default Isekai;
```
