"use client"
import React from 'react'


function FileUpload() {
  return (

        <div className='min-h-screen w-screen items-center justify-center flex flex-col  '>
          <div className='bg-white text-black'>
            <div>Upload your files here</div>
            <p>only one file</p>
            <input id="file" type='file' accept='.pdf,.epub'/>
          </div>

        </div>

  )
}

export default FileUpload