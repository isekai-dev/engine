import express from "express";

export default ({
    HTTP
}) => {
    HTTP.use(express.static(`./BIN/DATA/HTTP_PUBLIC`));
};

