
import express from "express";

export default ({ 
    HTTP,
    SET
}) => {
    SET({
        HTTP: { 
            ...HTTP,
            API: HTTP.use(express.json())
        }
    });
};
