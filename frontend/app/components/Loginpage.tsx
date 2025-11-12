"use client";
import React, { useState } from "react";
import { X, Eye, EyeClosed } from "lucide-react";

function Loginpage() {
  const [email,setEmail] = useState<string>("")
  const [password,setPassword] = useState<string>("")
  let [showpassword, setShowpassword] = useState<boolean>(false);
  const handleLogin  = async  (e:React.FormEvent)=>{
    console.log({email,password})
    try{
      const res = await fetch('http://localhost:2007/login',{
        method:"POST",
        headers:{"content-type":"application/json"},
        credentials: "include",
        body:JSON.stringify({email,password})
      })
      const data = res.json()
      console.log(data)
    }
    catch(err){
      console.log(err)
    }
  }
  return (
    <>
      <div className="min-w-screen flex justify-center items-center px-5 py-5">
        <div className="border-amber-50 border p-6 rounded-lg shadow-lg flex flex-col justify-center">
          <div className="justify-center items-center flex flex-col">
            <h4 className="">Welcome Back</h4>
            <p className="">Connect your account</p>
          </div>
          <form className="flex flex-col mt-4 gap-4 ">

            <label htmlFor="email">Email</label>
            <input
              type="text"
              placeholder="Email"
              id="email"
              value={email}
              onChange={(e)=>setEmail(e.target.value)}
              className="border border-gray-300 rounded-md p-2 mt-4 w-80"
            />

            <label htmlFor="password">Password</label>
            <div className="flex relative">
              <input
                type={showpassword ? "text" : "password"}
                placeholder="Password"
                id="password"
                value={password}
                onChange={(e)=>setPassword(e.target.value)}
                className=" border border-gray-300 rounded-md  py-1 w-80 text-center"
              />
              <button
                onClick={(e) => {
                  e.preventDefault();
                  setShowpassword(!showpassword);
                }}
                className="absolute left-72 top-2"
              >
                {showpassword ? <Eye /> : <EyeClosed />}
              </button>
            </div>
          <button type="submit" onClick={handleLogin}className="border border-gray-300 rounded-md p-2 mt-4 w-80">Login</button>
          </form>
        </div>
      </div>
    </>
  );
}

export default Loginpage;
