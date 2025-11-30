"use client";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex flex-col lg:flex-row items-center justify-center bg-black px-6 lg:px-20 overflow-hidden">
      {/* Left Content Section */}
      <div className="flex-1 flex flex-col justify-center items-start space-y-8 max-w-2xl z-10">
        <h1 className="text-5xl lg:text-7xl font-extrabold tracking-tight text-white leading-tight">
          Welcome to <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-400">
            Multi File Reader
          </span>
        </h1>

        <div className="space-y-4">
          <p className="text-xl lg:text-2xl text-gray-200 font-medium leading-relaxed max-w-lg">
            Ever use multiple apps for reading different types of files and documents?
          </p>

          <p className="text-base lg:text-lg text-gray-400 leading-relaxed max-w-lg">
            With us, you can read multiple file types in a single platform — clean, simple, and efficient.
          </p>

          <p className="text-base lg:text-lg text-gray-400 leading-relaxed max-w-lg">
            Come, join us by creating your account today.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 mt-8 w-full sm:w-auto">
          <button
            onClick={() => router.push("/auth/login")}
            className="px-6 py-3 bg-white text-black rounded-full font-bold text-lg shadow-lg hover:bg-gradient-to-r hover:from-violet-500 hover:to-fuchsia-500 hover:text-white hover:shadow-2xl hover:scale-105 transition-all duration-300 w-full sm:w-auto"
          >
            Login
          </button>
          <button
            onClick={() => router.push("/auth/signup")}
            className="px-6 py-3 border-2 border-gray-600 text-white rounded-full font-bold text-lg hover:border-violet-400 hover:bg-violet-500/10 hover:scale-105 transition-all duration-300 w-full sm:w-auto"
          >
            Sign Up
          </button>
        </div>
      </div>

      {/* Right Image Section */}
      <div className="flex-1 flex justify-center items-center mt-12 lg:mt-0 relative">
        {/* Container to crop the bottom watermark */}
        <div className="relative overflow-hidden rounded-2xl" style={{ clipPath: 'inset(0 0 15% 0)' }}>
          <img
            src={`https://res.cloudinary.com/dgyrjxh05/image/upload/v1762949634/Gemini_Generated_Image_gx7d60gx7d60gx7d_mzqjup.png`}
            alt="Multi File Reader Illustration"
            className="w-full max-w-lg lg:max-w-xl object-contain drop-shadow-2xl relative z-10"
          />
        </div>
      </div>
    </div>
  );
}