
import express from "express";
import Isekai from "@isekai/engine";

const { 
    HTTP,
    EQUIP,
} = Isekai;

EQUIP({
    HTTP_API: HTTP.use(express.json())
});
