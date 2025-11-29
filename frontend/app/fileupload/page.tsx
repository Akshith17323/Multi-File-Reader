"use client"
import React, { useRef, useState } from "react"

function FileUpload() {
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [progress, setProgress] = useState(0)
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const uploadEndpoint =
    (process.env.NEXT_PUBLIC_UPLOAD_URL as string) || "http://localhost:2007/fileUpload"

  const UploadFile = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setResultUrl(null)
    setProgress(0)

    const input = fileRef.current
    if (!input?.files || input.files.length === 0) {
      setError("No file selected")
      return
    }

    const file = input.files[0]
    const fd = new FormData()
    fd.append("UploadingFile", file)

    const xhr = new XMLHttpRequest()
    xhr.open("POST", uploadEndpoint)

    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) setProgress(Math.round((ev.loaded / ev.total) * 100))
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const body = JSON.parse(xhr.responseText)
          setResultUrl(body.url || null)
        } catch {
          setError("Upload succeeded but response parsing failed")
        }
      } else {
        setError(`Upload failed: ${xhr.status} ${xhr.statusText}`)
      }
    }

    xhr.onerror = () => setError("Network/error during upload")
    xhr.send(fd)
  }

  return (
    <div className="min-h-screen w-screen flex items-center justify-center flex-col">
      <form onSubmit={UploadFile} encType="multipart/form-data" className="bg-white text-black p-4">
        <div>Upload your files here</div>
        <p>only one file</p>
        <input ref={fileRef} id="file" type="file" accept=".pdf,.epub,.txt" name="UploadingFile" />
        <div className="mt-2">
          <button type="submit">Submit</button>
        </div>
      </form>

      {progress > 0 && <div className="mt-2">Progress: {progress}%</div>}
      {resultUrl && (
        <div className="mt-2">
          Uploaded: <a href={resultUrl} target="_blank" rel="noreferrer">{resultUrl}</a>
        </div>
      )}
      {error && <div className="mt-2 text-red-600">Error: {error}</div>}
    </div>
  )
}

export default FileUpload
