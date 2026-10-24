import express from "express";import cors from "cors";import helmet from "helmet";import cookieParser from "cookie-parser";
import authRoutes from "./auth.js";import api from "./api.js";import {errorHandler} from "./util.js";
export const CLIENT_URL=process.env.CLIENT_URL||"http://localhost:5173";
const app=express();app.use(helmet());app.use(cors({origin:CLIENT_URL,credentials:true}));app.use(express.json({limit:"100kb"}));app.use(cookieParser());
app.get("/api/health",(q,s)=>s.json({data:{ok:true}}));app.use("/api/auth",authRoutes);app.use("/api",api);
app.use("/api",(q,s)=>s.status(404).json({error:{code:"NOT_FOUND",message:"Route introuvable"}}));app.use(errorHandler);
export default app;
