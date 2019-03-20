import express from "express";

export default ({
    HTTP
}) => {
    HTTP.use(express.static(`../BAG/HTTP_PUBLIC`));
};

