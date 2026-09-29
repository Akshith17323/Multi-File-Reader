"use client";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function Home() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex flex-col lg:flex-row items-center justify-center bg-background px-6 lg:px-20 overflow-hidden">
      {/* Left Content Section */}
      <div className="flex-1 flex flex-col justify-center items-start space-y-8 max-w-2xl z-10">
        <h1 className="text-5xl lg:text-7xl font-extrabold tracking-tight text-foreground leading-tight">
          Welcome to <br />
          <span className="text-primary font-black drop-shadow-[0_0_10px_rgba(52,211,153,0.8)]">
            Multi File Reader
          </span>
        </h1>

        <div className="space-y-4">
          <p className="text-xl lg:text-2xl text-foreground font-medium leading-relaxed max-w-lg">
            Ever use multiple apps for reading different types of files and documents?
          </p>

          <p className="text-base lg:text-lg text-foreground-muted leading-relaxed max-w-lg">
            With us, you can read multiple file types in a single platform — clean, simple, and efficient.
          </p>

          <p className="text-base lg:text-lg text-foreground-muted leading-relaxed max-w-lg">
            Come, join us by creating your account today.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 mt-8 w-full sm:w-auto">
          <button
            onClick={() => router.push("/auth/login")}
            className="px-6 py-3 bg-surface text-foreground border-2 border-primary rounded-full font-bold text-lg shadow-[0_0_15px_rgba(52,211,153,0.4)] hover:bg-primary hover:text-white hover:shadow-[0_0_25px_rgba(52,211,153,0.8)] hover:scale-105 transition-all duration-300 w-full sm:w-auto"
          >
            Login
          </button>
          <button
            onClick={() => router.push("/auth/signup")}
            className="px-6 py-3 border-2 border-border-subtle text-foreground rounded-full font-bold text-lg hover:border-primary hover:bg-primary/10 hover:scale-105 transition-all duration-300 w-full sm:w-auto"
          >
            Sign Up
          </button>
        </div>
      </div>

      {/* Right Image Section */}
      <div className="flex-1 flex justify-center items-center mt-12 lg:mt-0 relative w-full h-[500px]">
        {/* Container to crop the bottom watermark */}
        <div className="relative overflow-hidden rounded-2xl w-full h-full max-w-lg lg:max-w-xl mx-auto" style={{ clipPath: 'inset(0 0 15% 0)' }}>
          <Image
            src={`https://res.cloudinary.com/dgyrjxh05/image/upload/v1762949634/Gemini_Generated_Image_gx7d60gx7d60gx7d_mzqjup.png`}
            alt="Multi File Reader Illustration"
            fill
            className="object-contain drop-shadow-2xl relative z-10"
            unoptimized
          />
        </div>
      </div>
    </div>
  );
}