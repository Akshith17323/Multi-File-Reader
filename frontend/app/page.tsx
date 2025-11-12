"use client";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  return (
    <div className="min-w-screen min-h-screen flex items-center justify-start px-20">
      <div className="flex flex-col  justify-center text space-y-6">
        <h1 className="text-5xl font-bold">
          Welcome to Multi File Reader
        </h1>

        <p className="text-lg">
          Ever use multiple apps for reading different types of files and documents?
        </p>

        <p className="text-lg">
          With us, you can read multiple file types in a single platform — clean, simple, and efficient.
        </p>

        <p className="text-lg">
          Come, join us by creating your account today.
        </p>

        <div className="flex gap-6 mt-4">
          <button
            onClick={() => router.push("/login")}
            className="bg-white text-black px-6 py-3 border rounded-full font-semibold hover:bg-black hover:text-white hover:border-white transition"
          >
            Login
          </button>
          <button
            onClick={() => router.push("/signup")}
            className="border border-white px-6 py-3 rounded-full font-semibold hover:bg-white hover:text-black transition"
          >
            Sign Up
          </button>
        </div>
      </div>
      <img src={`https://res.cloudinary.com/dgyrjxh05/image/upload/v1762949634/Gemini_Generated_Image_gx7d60gx7d60gx7d_mzqjup.png`} 
      alt="fileIcons"
      className="w-100" 
      />
    </div>
  );
}