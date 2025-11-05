"use client";
import React, { useState } from "react";
import { X, Eye, EyeClosed } from "lucide-react";

function Loginpage() {
  let [showpassword, setShowpassword] = useState(false);
  return (
    <>
      <div className="min-w-screen flex justify-center items-center px-5 py-5">
        <div className="border-amber-50 border p-6 rounded-lg shadow-lg">
          <div className="justify-center items-center flex flex-col">
            <h4 className="">Welcome Back</h4>
            <p className="">Connect your account</p>
          </div>
          <div className="flex flex-col mt-4 gap-4">
            <label htmlFor="name">Name</label>
            <input
              type="text"
              placeholder="Name"
              id="name"
              className="border border-gray-300 rounded-md p-2 mt-4 w-80"
            />

            <label htmlFor="email">Email</label>
            <input
              type="text"
              placeholder="Email"
              id="email"
              className="border border-gray-300 rounded-md p-2 mt-4 w-80"
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
          </div>
        </div>
      </div>
    </>
  );
}

export default Loginpage;
