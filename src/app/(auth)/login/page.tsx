
import { LogIn } from "lucide-react";
import LoginForm from "@/components/forms/LoginForm"


export default function LoginPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4" style={{ backgroundColor: "#e4effe" }}>
      <div className="w-full max-w-md p-6 sm:p-8 bg-white rounded-xl shadow">
        <div className="flex items-center justify-center mb-6 ">
          <div className="bg-blue-600 rounded-full p-3">
            <LogIn className="h-12 w-12 text-white" />
          </div>
        </div>
        <div className="text-center text-blue-600"><p className="font-bold">DALYDA Stock Manager</p></div>
        <div className="text-center text-gray-500"><p>Sign in to your account</p></div>
        <LoginForm />
      </div>
      <footer>
        <p className="text-center text-gray-500 text-sm mt-6">
          © 2026 DALYDA Stock Manager. All rights reserved.
        </p>
      </footer>
    </main>
  );
}
