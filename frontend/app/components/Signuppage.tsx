import React, { useRef, useState } from "react";
import { X, Eye, EyeClosed } from "lucide-react";

function Signuppage() {
    let [showpassword, setShowpassword] = useState(false);
    let [checkshowpassword, setCheckhowpassword] = useState(false);
    let [name, setName] = useState<string>("")
    let [email, setemail] = useState<string>("")
    let [password, setpassword] = useState<string>("")

    const handleLogin = () => {

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
                        />

                        <label htmlFor="email">Email</label>
                        <input
                            type="text"
                            placeholder="Email"
                            id="email"
                            className="border border-gray-300 rounded-md p-2 mt-1 w-80"
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
                        <button type="submit" className="" onClick={handleLogin}>SignUp</button>
                    </form>
                </div>
            </div>
        </>
    );
}

export default Signuppage;

// import React ,{useRef, useState,useContext} from 'react'
// import './input.css'
// import RefreshContext from '../../context/refreshContext'

// function Input() {
//   let taskRef = useRef(null)
//   let importanceRef = useRef(null)
//   let urgencyRef = useRef(null)

//   let {refresher,setRefresher}= useContext(RefreshContext)

//   const add_input_to_tasks = async (e)=>{
//     e.preventDefault()
//     const task = taskRef.current.value
//     const importance = importanceRef.current.value
//     const urgency = urgencyRef.current.value
//     try{
//       const res = await fetch("http://localhost:1705/",{
//         method:"POST",
//         headers:{"content-type":"application/json"},
//         body: JSON.stringify({
//           task:task,
//           importance:importance ,
//           urgency:urgency
//         })
//       })
//       const data =await res.json()
//       console.log(data)
//       taskRef.current.value = ""
//       setRefresher(refresher+1)

//     }
//     catch(err){
//       console.log(err)
//     }
//   }

//   return (
//     <>
//     <form onSubmit={add_input_to_tasks} className='input_box'>
//       <input ref={taskRef} placeholder='Add your task here' className='add_task'></input>

//       <select ref={importanceRef}  name='priority' className='priority'>
//         {/* if no priotrity it will be added to no timport ant and not urgent  */}
//         <option disabled>Importance of the task</option>
//         <option value="Important" >Important</option>
//         <option value="Not Important">Not Important</option>
//       </select>

//       <select ref={urgencyRef} name='urgency' className='priority'>
//         <option disabled>Urgency of the task </option>
//         <option value="Urgent">Urgent</option>
//         <option value="Not Urgent">Not Urgent</option>
//       </select>

//       <button type='submit' className='submit'>Add Task</button>
//     </form>

//     </>
//   )
// }

// export default Input
