import isekai from "isekai";
isekai.SET({"NODE":{},"HTTP":{"port":8080},"HTTP_API":{},"HTTP_PUBLIC":{}});

import HTTP from "../SHOP/HTTP/index.js";
import HTTP_API from "../SHOP/HTTP_API/index.js";
import HTTP_PUBLIC from "../SHOP/HTTP_PUBLIC/index.js";

isekai.EQUIP({
    HTTP,
    HTTP_API,
    HTTP_PUBLIC,
});
