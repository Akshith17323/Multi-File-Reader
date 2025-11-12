import React, { useRef, useState } from "react";
import { X, Eye, EyeClosed } from "lucide-react";

function Signuppage() {
    let [showpassword, setShowpassword] = useState<boolean>(false);
    let [checkshowpassword, setCheckhowpassword] = useState<boolean>(false);
    let [name, setName] = useState<string>("")
    let [email, setemail] = useState<string>("")
    let [password, setpassword] = useState<string>("")

    const handleSignup = async  (e:React.FormEvent)=>{
        console.log({name,email,password})
        try{
          const res = await fetch('http://localhost:2007/login',{
            method:"POST",
            headers:{"content-type":"application/json"},
            credentials: "include",
            body:JSON.stringify({name,email,password})
          })
          const data =await  res.json()
          console.log(data)
        }
        catch(err){
          console.log(err)
        }
      }

    return (
        <>
            <div className="min-w-screen flex justify-center items-center min-h-screen">
                <div className="border-amber-50 border p-6 rounded-2xl flex flex-col items-center justify-center">
                    <div className="justify-center items-center flex flex-col ">
                        <h4 className="">Welcome Back</h4>
                        <p className="">Connect your account</p>
                    </div>
                    <form className="flex flex-col  gap-4">
                        <label htmlFor="name">Name</label>
                        <input
                            type="text"
                            placeholder="Name"
                            id="name"
                            className="border border-gray-300 rounded-md p-2 mt-1 w-80"
                            value={name}
                            onChange={(e)=>setName(e.target.value)}
                        />

                        <label htmlFor="email">Email</label>
                        <input
                            type="text"
                            placeholder="Email"
                            id="email"
                            className="border border-gray-300 rounded-md p-2 mt-1 w-80"
                            value={email}
                            onChange={(e)=>setemail(e.target.value)}
                        />

                        <label htmlFor="password">Password</label>
                        <div className="flex relative">
                            <input
                                type={showpassword ? "text" : "password"}
                                placeholder="Password"
                                id="password"
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

                        <label htmlFor="confirm-password">Confirm Password</label>
                        <div className="flex relative">
                            <input
                                type={checkshowpassword ? "text" : "password"}
                                placeholder="Password"
                                id="password"
                                className=" border border-gray-300 rounded-md  py-1 w-80 text-center"
                                value={password}
                                onChange={(e)=>setpassword(e.target.value)}
                            />
                            <button
                                onClick={(e) => {
                                    e.preventDefault();
                                    setCheckhowpassword(!checkshowpassword);
                                }}
                                className="absolute left-72 top-2"
                            >
                                {checkshowpassword ? <Eye /> : <EyeClosed />}
                            </button>
                        </div>
                        <button type="submit" className="border border-gray-300 rounded-md p-2 mt-4 w-80" onClick={handleSignup}>SignUp</button>
                    </form>
                </div>
            </div>
        </>
    );
}

export default Signuppage;

