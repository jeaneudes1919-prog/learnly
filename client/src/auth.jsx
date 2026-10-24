import {createContext,useContext,useEffect,useState} from "react";import {api,refresh,setToken} from "./api.js";
const Ctx=createContext();export const useAuth=()=>useContext(Ctx);
export function AuthProvider({children}){const [user,setUser]=useState(null);const [loading,setLoading]=useState(true);
useEffect(()=>{refresh().then(d=>setUser(d.user)).catch(()=>{}).finally(()=>setLoading(false));const h=()=>{setToken(null);setUser(null)};window.addEventListener("pulse:logout",h);return()=>window.removeEventListener("pulse:logout",h)},[]);
const done=d=>{setToken(d.accessToken);setUser(d.user);return d.user};
const login=async(email,password)=>done(await api.post("/auth/login",{email,password}));
const register=async f=>done(await api.post("/auth/register",f));
const logout=async()=>{try{await api.post("/auth/logout")}catch{}setToken(null);setUser(null)};
return <Ctx.Provider value={{user,setUser,loading,login,register,logout}}>{children}</Ctx.Provider>}
