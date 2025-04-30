import React, { useState, useRef, useEffect } from "react";
import { Send, User, Bot, MessageCircleQuestion } from "lucide-react";
import { MarkdownRenderer } from "../../components";

interface Message {
  id: string;
  content: string;
  sender: "user" | "bot";
  timestamp: Date;
  isStreaming?: boolean;
}

interface Turn {
  role: "user" | "model";
  parts: { text: string }[];
}

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

// const weatherFunction = {
//   name: "getCurrentWeather",
//   description: "Gets the current temperature for a given location.",
//   parameters: {
//     type: "object",
//     properties: {
//       location: {
//         type: "string",
//         description: "The city name, e.g. San Francisco",
//       },
//     },
//     required: ["location"],
//   },
// };

// const getCurrentWeather = (location: string) => {
//   return JSON.stringify({
//     location,
//     main: "Clear",
//     description: "clear sky",
//     icon: "01d",
//     temp: 289.92,
//     feels_like: 288.79,
//     temp_min: 288.71,
//     temp_max: 291.48,
//     pressure: 1016,
//     humidity: 56,
//   });
// };

// const FUNCTION_MAPPING = {
//   getCurrentWeather,
// };

const TextConversation = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [showWelcomeCard, setShowWelcomeCard] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to the bottom when new messages are added or updated
  useEffect(() => {
    scrollToBottom();

    // Auto-focus input after bot's message is complete
    if (!isTyping && inputRef.current) {
      inputRef.current.focus();
    }
  }, [messages, isTyping]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Initialize WebSocket connection
  useEffect(() => {
    const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${GEMINI_API_KEY}`;

    const ws = new WebSocket(url);
    setSocket(ws);

    ws.onopen = () => {
      console.log("Connection Open");
      setIsConnected(true);
      const payload = {
        model: "models/gemini-2.0-flash-live-001",
        generationConfig: {
          candidateCount: 1,
          maxOutputTokens: 4096,
          temperature: 0.2,
          responseModalities: ["TEXT"],
        },
        systemInstruction: {
          parts: [
            {
              text: "You are a helpful AI assistant having access of `weatherFunction` tool to give the information about weather for a given location. Please respond as usual if question is not related to weather.",
            },
          ],
        },

        // tools: [
        //   {
        //     functionDeclarations: [weatherFunction],
        //   },
        // ],
      };
      ws.send(JSON.stringify({ setup: payload }));
    };

    ws.onmessage = (event) => {
      const blob = event.data as Blob;

      const reader = new FileReader();
      reader.onload = function () {
        const arrayBuffer = reader.result as ArrayBuffer;
        const decoder = new TextDecoder("utf-8");

        try {
          const parsed = JSON.parse(decoder.decode(arrayBuffer));
          console.log("PARSED: ", parsed);

          //   if (parsed?.toolCall?.functionCalls?.length) {
          //     const func = parsed.toolCall?.functionCalls[0];

          //     if (func.name in FUNCTION_MAPPING) {
          //       const functionName = func.name as keyof typeof FUNCTION_MAPPING;
          //       const functionArgs = func.args;
          //       const functionId = func.id;

          //       const functionToCall = FUNCTION_MAPPING[functionName];

          //       const response = functionToCall(functionArgs.location);
          //       console.log("Function Response", response);

          //       const functionResponsePayload = {
          //         clientContent: {
          //           role: "user",
          //           parts: [
          //             {
          //               functionResponse: {
          //                 // Changed 'tool_outputs' to 'functionResponse'
          //                 id: functionId, // Renamed 'tool_call_id' to 'id'
          //                 name: functionName, // Added the function name
          //                 response: { result: response }, // Kept the response structure
          //               },
          //             },
          //           ],
          //         },
          //       };

          //       console.log(
          //         "User Payload to Gemini (LiveAPI):",
          //         JSON.stringify(functionResponsePayload, null, 2)
          //       );
          //       ws.send(JSON.stringify(functionResponsePayload));
          //     }
          //   }
          const serverContent = parsed.serverContent;

          if (serverContent?.modelTurn?.parts) {
            const newText = serverContent.modelTurn.parts
              .map((part: { text: string }) => part.text)
              .join("");

            setMessages((prev) => {
              const newMessages = [...prev];
              const lastBotMessageIndex = newMessages.findIndex(
                (msg) => msg.isStreaming
              );

              if (lastBotMessageIndex !== -1) {
                const currentContent = newMessages[lastBotMessageIndex].content;

                // Prevent duplicate appends
                if (!currentContent.endsWith(newText)) {
                  newMessages[lastBotMessageIndex].content += newText;
                }
              }

              return newMessages;
            });
          }

          if (serverContent?.generationComplete) {
            console.log("Generation Complete");
            setMessages((prev) => {
              const newMessages = [...prev];
              const lastBotMessageIndex = newMessages.findIndex(
                (msg) => msg.isStreaming
              );

              if (lastBotMessageIndex !== -1) {
                newMessages[lastBotMessageIndex].isStreaming = false;
              }

              return newMessages;
            });

            setIsTyping(false);
          }
        } catch (error) {
          console.error("Failed to parse WebSocket message:", error);
        }
      };

      reader.readAsArrayBuffer(blob);
    };

    ws.onerror = (error) => {
      console.log("SOCKET ERROR: ", error);
      setIsConnected(false);
    };

    ws.onclose = (error) => {
      console.log("SOCKET CLOSED", error);
      setIsConnected(false);
    };

    return () => {
      ws.close();
    };
  }, []);

  const handleSendMessage = () => {
    if (inputValue.trim() === "" || !isConnected) return;

    // Hide welcome card on first message
    if (showWelcomeCard) {
      setShowWelcomeCard(false);
    }

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputValue,
      sender: "user",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);

    // Create placeholder for bot response with streaming flag
    const botMessagePlaceholder: Message = {
      id: (Date.now() + 1).toString(),
      content: "",
      sender: "bot",
      timestamp: new Date(),
      isStreaming: true,
    };

    setMessages((prev) => [...prev, botMessagePlaceholder]);
    setIsTyping(true);

    // Construct conversation history for Gemini
    const conversationTurns: Turn[] = [];

    // Add all previous messages as turns
    messages.forEach((msg) => {
      conversationTurns.push({
        role: msg.sender === "user" ? "user" : "model",
        parts: [{ text: msg.content }],
      });
    });

    // Add the current user message
    conversationTurns.push({
      role: "user",
      parts: [{ text: inputValue }],
    });

    // Send to Gemini API
    const userPayload = {
      clientContent: {
        turns: conversationTurns,
        turnComplete: true,
      },
    };

    socket?.send(JSON.stringify(userPayload));
    setInputValue("");
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Format timestamp to display only the time
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="flex flex-col h-screen bg-white text-black">
      {/* Top Header */}
      <header className="flex items-center justify-between p-4 border-b border-gray-200">
        <h1 className="text-xl font-bold">Gemini Chat (LIVE API)</h1>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">
            {isConnected ? "Connected" : "Disconnected"}
          </span>
          <div
            className={`h-3 w-3 rounded-full ${
              isConnected ? "bg-green-500" : "bg-red-500"
            } animate-pulse`}
          ></div>
        </div>
      </header>

      {/* Messages Area */}
      <div className="flex-grow overflow-y-auto p-4 relative">
        {/* Welcome Card */}
        {showWelcomeCard && messages.length === 0 && (
          <div className="absolute inset-0 z-10 flex items-center justify-center">
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 max-w-md shadow-sm text-center">
              <div className="flex justify-center mb-4">
                <MessageCircleQuestion size={48} className="text-blue-500" />
              </div>
              <h2 className="text-xl font-bold mb-3">Welcome to Gemini Chat</h2>
              <p className="text-gray-600 mb-4">
                I'm an AI assistant ready to help you with any questions or
                tasks. Feel free to start a conversation about anything!
              </p>
              <p className="text-sm text-gray-500 italic">
                Type your first message to begin
              </p>
            </div>
          </div>
        )}

        {/* Messages List */}
        {messages.length > 0 && (
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.sender === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`flex max-w-xl ${
                    message.sender === "user" ? "flex-row-reverse" : ""
                  }`}
                >
                  <div
                    className={`flex-shrink-0 flex items-start pt-1 ${
                      message.sender === "user" ? "pl-2" : "pr-2"
                    }`}
                  >
                    {message.sender === "user" ? (
                      <div className="rounded-full p-2 bg-black">
                        <User size={16} className="text-white" />
                      </div>
                    ) : (
                      <div className="rounded-full p-2 bg-gray-200">
                        <Bot size={16} className="text-gray-800" />
                      </div>
                    )}
                  </div>
                  <div
                    className={`p-3 rounded-lg shadow-sm ${
                      message.sender === "user"
                        ? "bg-black text-white"
                        : "bg-gray-100 text-black border border-gray-200"
                    }`}
                  >
                    <MarkdownRenderer content={message.content} />

                    {message.isStreaming && (
                      <span className="inline-block w-1 h-4 ml-1 bg-gray-500 animate-pulse"></span>
                    )}

                    <div
                      className={`text-xs mt-1 ${
                        message.sender === "user"
                          ? "text-gray-300"
                          : "text-gray-500"
                      }`}
                    >
                      {formatTime(message.timestamp)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex gap-2 items-end">
          {/* Textarea */}
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) =>
              setInputValue((e.target as HTMLTextAreaElement).value)
            }
            onKeyDown={handleKeyPress}
            placeholder="Type a message..."
            className="flex-grow py-3 px-4 outline-none resize-none bg-white text-black border border-gray-300 rounded-2xl h-12 max-h-32"
            disabled={!isConnected || isTyping}
            autoFocus
          />

          {/* Send Button */}
          <button
            onClick={handleSendMessage}
            disabled={inputValue.trim() === "" || !isConnected || isTyping}
            className={`h-12 px-5 rounded-2xl font-semibold transition ${
              inputValue.trim() === "" || !isConnected || isTyping
                ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                : "bg-black text-white hover:bg-gray-800"
            }`}
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default TextConversation;
