
import express from "express";

export default ({ 
    HTTP,
    SET
}) => {
    SET({
        HTTP_API: HTTP.use(express.json())
    });
};
