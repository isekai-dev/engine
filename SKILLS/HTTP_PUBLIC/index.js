import express from "express";

export default ({
    HTTP
}) => {
    HTTP.use(express.static(`../ITEMS/HTTP_PUBLIC`));
};

