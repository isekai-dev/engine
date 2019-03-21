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
