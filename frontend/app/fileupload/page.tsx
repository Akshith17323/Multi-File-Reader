"use client"
import React from 'react'


function FileUpload() {
  const UploadFile = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    console.log("Submit")
    const form = e.currentTarget
    const input = form.querySelector('input[type="file"]') as HTMLInputElement | null
    if (input && input.files && input.files.length > 0) {
      console.log('Selected file:', input.files[0])
    }
  }
  return (

    <div className='min-h-screen w-screen items-center justify-center flex flex-col '>
      <form action='/fileUpload' method='POST' encType="multipart/form-data" onSubmit={UploadFile}>
        <div className='bg-white text-black'>
          <div>Upload your files here</div>
          <p>only one file</p>
          <input id="file" type='file' accept='.pdf,.epub,.txt' name='UploadingFile' />
        </div>
        <button type='submit'>Submit</button>
      </form>

    </div>

  )
}

export default FileUpload