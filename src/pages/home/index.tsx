import { useNavigate } from "react-router-dom";
import { MessageSquare, Mic } from "lucide-react";

const Home = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col items-center justify-center p-4">
      <div className="text-center mb-16">
        <h1 className="text-4xl font-bold text-gray-800 mb-3">
          Gemini Conversation Assistant{" "}
          <span className="text-blue-600">(LIVE API)</span>
        </h1>
        <p className="text-lg text-gray-600 max-w-lg mx-auto">
          Choose your preferred way to interact with Gemini AI
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
        {/* Text Conversation Box */}
        <div
          onClick={() => navigate("/text-conversation")}
          className="bg-white rounded-xl shadow-lg overflow-hidden transition-all duration-300 hover:shadow-xl hover:scale-105 cursor-pointer"
        >
          <div className="p-8 flex flex-col items-center">
            <div className="h-16 w-16 bg-blue-100 rounded-full flex items-center justify-center mb-6">
              <MessageSquare size={32} className="text-blue-600" />
            </div>
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">
              Text Conversation
            </h2>
            <p className="text-gray-600 text-center">
              Interact with Gemini AI through text-based chat for detailed
              responses and information.
            </p>
          </div>
          <div className="bg-blue-600 py-4 px-6 text-white font-medium text-center">
            Start Text Chat
          </div>
        </div>

        {/* Audio Conversation Box */}
        <div
          onClick={() => navigate("/audio-conversation")}
          className="bg-white rounded-xl shadow-lg overflow-hidden transition-all duration-300 hover:shadow-xl hover:scale-105 cursor-pointer"
        >
          <div className="p-8 flex flex-col items-center">
            <div className="h-16 w-16 bg-purple-100 rounded-full flex items-center justify-center mb-6">
              <Mic size={32} className="text-purple-600" />
            </div>
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">
              Audio Conversation
            </h2>
            <p className="text-gray-600 text-center">
              Talk to Gemini AI using voice for a natural, hands-free
              conversation experience.
            </p>
          </div>
          <div className="bg-purple-600 py-4 px-6 text-white font-medium text-center">
            Start Voice Chat
          </div>
        </div>
      </div>

      {/* <footer className="mt-16 text-center text-gray-500">
        <p>© 2025 Conversation Assistant. All rights reserved.</p>
      </footer> */}
    </div>
  );
};

export default Home;
