import { useRef, useState, useEffect, useCallback } from "react";
import { Base64 } from "js-base64";
import {
  Mic,
  MicOff,
  Square,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Activity,
} from "lucide-react";
import { convertBase64ToFloat32 } from "../../lib/utils";
import { VOICE_OPTIONS } from "../../lib/constants";

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const URL = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${GEMINI_API_KEY}`;

type Part = {
  inlineData: {
    mimeType: string;
    data: string;
  };
};

const AudioConversation = () => {
  const socketRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const audioWorkletNodeRef = useRef<AudioWorkletNode | null>(null);

  // Use an array buffer to store PCM data for smooth playback
  const audioBufferRef = useRef<Float32Array[]>([]);
  const isPlayingRef = useRef<boolean>(false);
  const scheduledEndTimeRef = useRef<number>(0);

  // Track if we need to schedule more audio
  const needsSchedulingRef = useRef<boolean>(false);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [queueLength, setQueueLength] = useState<number>(0);

  // Permission states
  const [micPermissionState, setMicPermissionState] = useState<
    "granted" | "denied" | "prompt" | "unknown"
  >("unknown");
  const [permissionError, setPermissionError] = useState<string | null>(null);

  // New states for UI controls
  const [selectedVoice, setSelectedVoice] = useState<string>("Kore");
  const [isConversationActive, setIsConversationActive] =
    useState<boolean>(false);
  const [isMicMuted, setIsMicMuted] = useState<boolean>(false);

  // Check microphone permissions with better browser compatibility
  const checkMicrophonePermission = useCallback(async () => {
    try {
      // First attempt using the Permissions API (Chrome, Edge, Firefox)
      if (navigator.permissions && navigator.permissions.query) {
        try {
          const permissionStatus = await navigator.permissions.query({
            name: "microphone" as PermissionName,
          });

          setMicPermissionState(
            permissionStatus.state as "granted" | "denied" | "prompt"
          );

          // Listen for permission changes
          permissionStatus.onchange = () => {
            setMicPermissionState(
              permissionStatus.state as "granted" | "denied" | "prompt"
            );

            if (permissionStatus.state === "denied") {
              setPermissionError(
                "Microphone access denied. Please enable microphone access in your browser settings."
              );
            } else if (permissionStatus.state === "granted") {
              setPermissionError(null);
            }
          };

          return; // Successfully checked permission
        } catch (err) {
          console.log("Permissions API available but failed:", err);
          // Fall through to the fallback method
        }
      }

      // Fallback for Safari and other browsers: try to access the microphone directly
      // This will trigger a permission prompt if not already decided
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        // If we get here, permission was granted
        setMicPermissionState("granted");
        setPermissionError(null);

        // Clean up the test stream
        stream.getTracks().forEach((track) => track.stop());
      } catch (err) {
        // Check error type to determine if permission was denied
        if (err instanceof DOMException) {
          if (
            err.name === "NotAllowedError" ||
            err.name === "PermissionDeniedError"
          ) {
            setMicPermissionState("denied");
            setPermissionError(
              "Microphone access denied. Please enable microphone access in your browser settings."
            );
          } else if (err.name === "NotFoundError") {
            setMicPermissionState("denied");
            setPermissionError(
              "No microphone found. Please check your device and try again."
            );
          } else {
            setMicPermissionState("unknown");
          }
        } else {
          // Unknown error
          setMicPermissionState("unknown");
        }
      }
    } catch (error) {
      console.error("Error checking microphone permission:", error);
      setMicPermissionState("unknown");
    }
  }, []);

  // Request microphone permission directly
  const requestMicrophonePermission = useCallback(async () => {
    setPermissionError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicPermissionState("granted");

      // Clean up the test stream
      stream.getTracks().forEach((track) => track.stop());

      // Re-check permissions to update UI
      checkMicrophonePermission();
    } catch (error) {
      console.error("Failed to get microphone permission:", error);
      setMicPermissionState("denied");
      setPermissionError(
        "Microphone access is required. Please allow microphone access and try again."
      );
    }
  }, [checkMicrophonePermission]);

  // Check permissions on component mount
  useEffect(() => {
    checkMicrophonePermission();
  }, [checkMicrophonePermission]);

  // Periodically recheck microphone permissions when not in a conversation
  useEffect(() => {
    let permissionCheckInterval: number | null = null;

    // Only set up the interval if we're not in a conversation and permission isn't granted
    if (!isConversationActive && micPermissionState !== "granted") {
      permissionCheckInterval = window.setInterval(() => {
        checkMicrophonePermission();
      }, 5000); // Check every 5 seconds
    }

    return () => {
      if (permissionCheckInterval !== null) {
        window.clearInterval(permissionCheckInterval);
      }
    };
  }, [isConversationActive, micPermissionState, checkMicrophonePermission]);

  // Process incoming audio chunks
  const processAudioChunk = (base64Data: string) => {
    if (!audioContextRef.current) return;

    try {
      // Convert to Float32Array
      const float32Data = convertBase64ToFloat32(base64Data);

      // Add to our buffer queue
      audioBufferRef.current.push(float32Data);
      const newLength = audioBufferRef.current.length;
      console.log(`Added audio chunk. Queue length: ${newLength}`);

      // Update UI
      setQueueLength(newLength);

      // If not already playing or scheduling, start playback process
      if (!isPlayingRef.current) {
        scheduleAudioPlayback();
      } else if (needsSchedulingRef.current) {
        // Schedule more audio if needed
        scheduleAudioPlayback();
      }
    } catch (error) {
      console.error("Error processing audio chunk:", error);
    }
  };

  // Main scheduling function for continuous playback
  const scheduleAudioPlayback = useCallback(() => {
    if (!audioContextRef.current || audioBufferRef.current.length === 0) {
      console.log("No audio context or empty buffer - skipping scheduling");
      return;
    }

    try {
      // Set flag to prevent multiple scheduling calls
      isPlayingRef.current = true;
      setIsPlaying(true);
      needsSchedulingRef.current = false;

      // Get current time in the audio context
      const currentTime = audioContextRef.current.currentTime;

      // Determine start time (either now or after the previous scheduled audio)
      const startTime = Math.max(currentTime, scheduledEndTimeRef.current);
      let currentScheduleTime = startTime;

      // How many chunks to schedule at once (balance between responsiveness and smoothness)
      const maxChunksToSchedule = Math.min(audioBufferRef.current.length, 3);
      console.log(
        `Scheduling ${maxChunksToSchedule} audio chunks starting at time ${currentScheduleTime}`
      );

      // Schedule multiple chunks with precise timing
      for (let i = 0; i < maxChunksToSchedule; i++) {
        const audioData = audioBufferRef.current[i];

        // Create buffer and fill with data
        const audioBuffer = audioContextRef.current.createBuffer(
          1,
          audioData.length,
          24000
        );
        audioBuffer.getChannelData(0).set(audioData);

        // Create source node
        const source = audioContextRef.current.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContextRef.current.destination);

        // Store the first source for reference
        if (i === 0) {
          currentSourceRef.current = source;
        }

        // Calculate accurate duration
        const duration = audioBuffer.duration;

        // Schedule this chunk to play at the exact time
        source.start(currentScheduleTime);
        console.log(
          `Scheduled chunk ${i} to play at ${currentScheduleTime.toFixed(
            3
          )}s for ${duration.toFixed(3)}s`
        );

        // Update the next start time
        currentScheduleTime += duration;

        // For all but the last chunk, just let it play
        if (i < maxChunksToSchedule - 1) {
          // No special handling needed
        } else {
          // For the last scheduled chunk, set up the callback
          // to remove played chunks and schedule more
          source.onended = () => {
            // Remove the chunks we've scheduled
            audioBufferRef.current.splice(0, maxChunksToSchedule);
            setQueueLength(audioBufferRef.current.length);

            // Check if we need to schedule more audio
            if (audioBufferRef.current.length > 0) {
              // Flag that we need more audio scheduled
              needsSchedulingRef.current = true;
              // Schedule more audio (will pick up from the last end time)
              scheduleAudioPlayback();
            } else {
              // No more audio to play
              console.log("No more audio in queue, playback complete");
              isPlayingRef.current = false;
              setIsPlaying(false);
              scheduledEndTimeRef.current = 0;
            }
          };
        }
      }

      // Update the scheduled end time for the next scheduling call
      scheduledEndTimeRef.current = currentScheduleTime;
    } catch (error) {
      console.error("Error in audio scheduling:", error);
      // Reset state in case of error
      isPlayingRef.current = false;
      setIsPlaying(false);

      // Remove potentially problematic chunks
      if (audioBufferRef.current.length > 0) {
        audioBufferRef.current.splice(0, 1);
        setQueueLength(audioBufferRef.current.length);
      }

      // Try again if there's still audio
      if (audioBufferRef.current.length > 0) {
        setTimeout(scheduleAudioPlayback, 100);
      }
    }
  }, []);

  // Handle incoming WebSocket messages with audio data
  const handleAudioMessage = (message: string) => {
    const messageData = JSON.parse(message);
    if (messageData.setupComplete) {
      return;
    }

    if (messageData.serverContent?.modelTurn?.parts.length) {
      const parts = messageData.serverContent.modelTurn.parts;
      parts.forEach((part: Part) => {
        if (part.inlineData.mimeType === "audio/pcm;rate=24000") {
          processAudioChunk(part.inlineData.data);
        }
      });
    }
  };

  // Initialize WebSocket connection with selected voice
  const initializeWebSocket = useCallback(() => {
    const ws = new WebSocket(URL);
    socketRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      const payload = {
        model: "models/gemini-2.0-flash-live-001",
        generationConfig: {
          candidateCount: 1,
          temperature: 0.2,
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: selectedVoice, // Using the selected voice
              },
            },
          },
        },
        systemInstruction: {
          parts: [{ text: "You are a helpful AI assistant." }],
        },
      };
      ws.send(JSON.stringify({ setup: payload }));
      console.log(`WebSocket initialized with voice: ${selectedVoice}`);
    };

    ws.onmessage = async (event) => {
      if (event.data instanceof Blob) {
        const arrayBuffer = await event.data.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        const messageText = new TextDecoder("utf-8").decode(bytes);
        console.log(JSON.parse(messageText));
        handleAudioMessage(messageText);
      }
    };

    ws.onclose = (error) => {
      setIsConnected(false);
      console.log("SOCKET CLOSED: ", error);
    };

    ws.onerror = (error) => {
      console.log("SOCKET ERROR: ", error);
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [selectedVoice]);

  // Initialize AudioContext with the correct sample rate
  useEffect(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext ||
        (window as any).webkitAudioContext)({
        sampleRate: 24000, // Match the sample rate of received audio
      });
    }

    // Ensure AudioContext is running
    const ensureAudioContextRunning = async () => {
      if (
        audioContextRef.current &&
        audioContextRef.current.state === "suspended"
      ) {
        try {
          await audioContextRef.current.resume();
          console.log("AudioContext resumed successfully");
        } catch (error) {
          console.error("Failed to resume AudioContext:", error);
        }
      }
    };

    ensureAudioContextRunning();

    // Cleanup on unmount
    return () => {
      // Stop any playing audio
      if (currentSourceRef.current) {
        try {
          currentSourceRef.current.stop();
          currentSourceRef.current.disconnect();
        } catch (error) {
          console.error("Error stopping audio source:", error);
        }
      }

      // Close audio context
      if (
        audioContextRef.current &&
        audioContextRef.current.state !== "closed"
      ) {
        audioContextRef.current.close().catch((error) => {
          console.error("Error closing AudioContext:", error);
        });
      }
    };
  }, []);

  // Function to send audio chunks to the API
  const sendMediaChunks = useCallback(
    (base64Data: string, mimeType: string) => {
      // Don't process if muted or conversation is not active
      if (isMicMuted || !isConversationActive) {
        return;
      }

      const message = {
        realtimeInput: {
          mediaChunks: [
            {
              mimeType: mimeType || "audio/pcm",
              data: base64Data,
            },
          ],
        },
      };

      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify(message));
      } else {
        console.warn("WebSocket not connected, cannot send audio data");
      }
    },
    [isMicMuted, isConversationActive]
  );

  // Start conversation - initialize WebSocket and start recording
  const startConversation = useCallback(async () => {
    try {
      // Show permission dialog if needed
      if (micPermissionState !== "granted") {
        setPermissionError(null); // Reset any previous errors
        console.log("Requesting microphone permission...");

        try {
          // This will trigger the permission prompt if not granted
          await navigator.mediaDevices.getUserMedia({ audio: true });
          setMicPermissionState("granted");
        } catch (error) {
          console.error("Microphone permission denied:", error);
          setMicPermissionState("denied");
          setPermissionError(
            "Microphone access is required. Please allow microphone access and try again."
          );
          return;
        }
      }

      // First initialize the WebSocket with the selected voice
      initializeWebSocket();

      // Request audio with specific constraints
      const audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          autoGainControl: true,
          noiseSuppression: true,
        },
      });

      // Reset audio context if needed
      if (
        audioContextRef.current &&
        audioContextRef.current.state !== "closed"
      ) {
        await audioContextRef.current.close().catch((e) => console.error(e));
      }

      // Create new audio context
      audioContextRef.current = new AudioContext({
        sampleRate: 16000, // For microphone
      });

      // Set stream and reset state
      const mediaStream = new MediaStream(audioStream);
      setStream(mediaStream);

      // Clear any existing audio queue and state
      audioBufferRef.current = [];
      isPlayingRef.current = false;
      scheduledEndTimeRef.current = 0;
      needsSchedulingRef.current = false;
      setQueueLength(0);
      setIsPlaying(false);

      // Set conversation as active
      setIsConversationActive(true);
      setIsMicMuted(false);

      console.log("Conversation started with fresh AudioContext");
    } catch (error) {
      console.error("Error starting conversation:", error);
      setPermissionError(
        "Failed to start conversation. Please check your microphone and try again."
      );
    }
  }, [micPermissionState, initializeWebSocket]);

  // Re-check permissions before starting conversation
  const ensurePermissionsAndStart = useCallback(async () => {
    // First check the current permission state
    await checkMicrophonePermission();

    // Now start the conversation if permissions look good
    if (micPermissionState === "granted") {
      startConversation();
    } else {
      // This will trigger the permission prompt
      requestMicrophonePermission();
    }
  }, [
    startConversation,
    micPermissionState,
    checkMicrophonePermission,
    requestMicrophonePermission,
  ]);

  // Toggle microphone mute/unmute
  const toggleMicMute = useCallback(() => {
    if (!isConversationActive) return;

    const newMuteState = !isMicMuted;
    setIsMicMuted(newMuteState);
    console.log(`Microphone ${newMuteState ? "muted" : "unmuted"}`);

    // Optionally pause/resume the audio tracks
    if (stream) {
      stream.getAudioTracks().forEach((track) => {
        track.enabled = !newMuteState;
      });
    }
  }, [isConversationActive, isMicMuted, stream]);

  // Stop conversation
  const stopConversation = useCallback(() => {
    console.log("Stopping conversation and cleaning up resources");

    // First update state to prevent any further processing
    setIsConversationActive(false);
    setIsConnected(false);

    // Stop all audio tracks in the stream
    if (stream) {
      stream.getTracks().forEach((track) => {
        track.stop();
      });
      setStream(null);
    }

    // Clean up audio processing
    if (audioWorkletNodeRef.current) {
      try {
        audioWorkletNodeRef.current.disconnect();
        audioWorkletNodeRef.current.port.onmessage = null;
        audioWorkletNodeRef.current = null;
      } catch (error) {
        console.error("Error cleaning up audio worklet:", error);
      }
    }

    // Close audio context
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      try {
        audioContextRef.current.close().catch((e) => console.error(e));
        audioContextRef.current = null;
      } catch (error) {
        console.error("Error closing audio context:", error);
      }
    }

    // Close WebSocket if open
    if (socketRef.current) {
      if (
        socketRef.current.readyState === WebSocket.OPEN ||
        socketRef.current.readyState === WebSocket.CONNECTING
      ) {
        try {
          socketRef.current.close();
        } catch (error) {
          console.error("Error closing WebSocket:", error);
        }
      }
      socketRef.current = null;
    }

    // Reset all other state
    audioBufferRef.current = [];
    isPlayingRef.current = false;
    scheduledEndTimeRef.current = 0;
    needsSchedulingRef.current = false;
    setQueueLength(0);
    setIsPlaying(false);
    setAudioLevel(0);

    console.log("Conversation stopped and resources cleaned up");
  }, [stream]);

  // Set up audio processing when stream is available
  useEffect(() => {
    if (!stream || !isConversationActive) {
      return;
    }

    let cleanup: (() => void) | undefined;
    const isActive = isConversationActive; // Capture current state for closure

    const setupAudioProcessing = async () => {
      try {
        const ctx = audioContextRef.current;
        if (!ctx || ctx.state === "closed") {
          return;
        }

        if (ctx.state === "suspended") {
          await ctx.resume();
        }

        await ctx.audioWorklet.addModule("/worklets/audio-processor.js");

        audioWorkletNodeRef.current = new AudioWorkletNode(
          ctx,
          "audio-processor",
          {
            numberOfInputs: 1,
            numberOfOutputs: 1,
            processorOptions: {
              sampleRate: 16000,
              bufferSize: 4096,
            },
            channelCount: 1,
            channelCountMode: "explicit",
            channelInterpretation: "speakers",
          }
        );

        const source = ctx.createMediaStreamSource(stream);
        audioWorkletNodeRef.current.port.onmessage = (event) => {
          // Skip processing if conversation has been stopped
          if (!isActive || !isConversationActive) {
            return;
          }

          const { pcmData, level } = event.data;
          setAudioLevel(level);

          const pcmArray = new Uint8Array(pcmData);
          const base64Data = Base64.fromUint8Array(pcmArray);
          sendMediaChunks(base64Data, "audio/pcm");
        };

        source.connect(audioWorkletNodeRef.current);

        cleanup = () => {
          try {
            source.disconnect();
            if (audioWorkletNodeRef.current) {
              audioWorkletNodeRef.current.disconnect();
              audioWorkletNodeRef.current = null;
            }
          } catch (error) {
            console.error("Error during audio cleanup:", error);
          }
        };
      } catch (error) {
        console.error("Error setting up audio processing:", error);
      }
    };

    console.log("Starting Audio Processing Setup");
    setupAudioProcessing();

    // Return cleanup function
    return () => {
      console.log("Cleaning up audio processing");
      if (cleanup) {
        cleanup();
      }

      if (audioWorkletNodeRef.current) {
        try {
          audioWorkletNodeRef.current.disconnect();
          audioWorkletNodeRef.current = null;
        } catch (error) {
          console.error("Error disconnecting audioWorkletNode:", error);
        }
      }
    };
  }, [stream, isConversationActive, sendMediaChunks]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg overflow-hidden">
        {/* Header */}
        <div className="bg-blue-600 px-6 py-4 text-white">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold">Gemini Voice Assistant</h1>
            {isConnected && (
              <div className="flex items-center">
                <Activity className="w-3 h-3 text-green-400 mr-2 animate-pulse" />
                <span className="text-sm">Connected</span>
              </div>
            )}
          </div>
        </div>

        {/* Main content */}
        <div className="p-6 space-y-6">
          {/* Permission error alert with help options */}
          {permissionError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              <div className="flex items-start">
                <XCircle className="h-5 w-5 mr-2 mt-0.5 text-red-500" />
                <div className="flex-1">{permissionError}</div>
              </div>
              {/* <div className="mt-2 flex space-x-2">
                <button
                  onClick={requestMicrophonePermission}
                  className="text-xs bg-red-100 hover:bg-red-200 text-red-800 px-2 py-1 rounded"
                >
                  Request Permission
                </button>
                <button
                  onClick={openBrowserSettings}
                  className="text-xs bg-red-100 hover:bg-red-200 text-red-800 px-2 py-1 rounded"
                >
                  Open Settings
                </button>
              </div> */}
            </div>
          )}

          {/* Microphone permission status */}
          <div className="text-sm text-gray-600 flex items-center">
            <span className="mr-2">Microphone:</span>
            {micPermissionState === "granted" && (
              <span className="text-green-600 flex items-center">
                <CheckCircle2 className="h-4 w-4 mr-1" />
                Access granted
              </span>
            )}
            {micPermissionState === "denied" && (
              <span className="text-red-600 flex items-center">
                <XCircle className="h-4 w-4 mr-1" />
                Access denied
              </span>
            )}
            {(micPermissionState === "prompt" ||
              micPermissionState === "unknown") && (
              <span className="text-yellow-600 flex items-center">
                <AlertCircle className="h-4 w-4 mr-1" />
                {micPermissionState === "prompt"
                  ? "Permission needed"
                  : "Status unknown"}
              </span>
            )}
          </div>

          {/* Voice selection dropdown */}
          <div className="space-y-2">
            <label
              htmlFor="voice"
              className="block text-sm font-medium text-gray-700"
            >
              Assistant Voice
            </label>
            <select
              id="voice"
              value={selectedVoice}
              onChange={(e) => setSelectedVoice(e.target.value)}
              disabled={isConversationActive}
              className={`block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
                isConversationActive ? "bg-gray-100" : ""
              }`}
            >
              {VOICE_OPTIONS.map((voice) => (
                <option key={voice.value} value={voice.value}>
                  {voice.label}
                </option>
              ))}
            </select>
          </div>

          {/* Audio level visualization */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-gray-600">
              <span>Audio Level</span>
              <span>{isPlaying ? "AI Speaking" : "Listening"}</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  isPlaying
                    ? "bg-blue-500"
                    : isMicMuted
                    ? "bg-gray-400"
                    : "bg-green-500"
                }`}
                style={{ width: `${Math.min(audioLevel * 2, 100)}%` }}
              ></div>
            </div>
          </div>

          {/* Status indicators */}
          <div className="flex justify-between text-sm text-gray-600">
            <div>Status: {isConversationActive ? "Active" : "Idle"}</div>
            <div>Queue: {queueLength} items</div>
          </div>

          {/* Control buttons */}
          <div className="flex gap-3 pt-4">
            {!isConversationActive ? (
              <button
                onClick={ensurePermissionsAndStart}
                className="flex-1 bg-blue-600 text-white rounded-lg py-3 font-medium hover:bg-blue-700 transition-colors flex items-center justify-center"
              >
                <Mic className="w-5 h-5 mr-2" />
                Start Conversation
              </button>
            ) : (
              <>
                <button
                  onClick={toggleMicMute}
                  className={`flex-1 ${
                    isMicMuted
                      ? "bg-yellow-500 hover:bg-yellow-600"
                      : "bg-gray-600 hover:bg-gray-700"
                  } text-white rounded-lg py-3 font-medium transition-colors flex items-center justify-center`}
                >
                  {isMicMuted ? (
                    <>
                      <MicOff className="w-5 h-5 mr-2" />
                      Unmute
                    </>
                  ) : (
                    <>
                      <Mic className="w-5 h-5 mr-2" />
                      Mute
                    </>
                  )}
                </button>

                <button
                  onClick={stopConversation}
                  className="flex-1 bg-red-600 text-white rounded-lg py-3 font-medium hover:bg-red-700 transition-colors flex items-center justify-center"
                >
                  <Square className="w-5 h-5 mr-2" />
                  Stop
                </button>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-gray-50 text-xs text-gray-500 text-center">
          Using voice: {selectedVoice} • Powered by Gemini
        </div>
      </div>
    </div>
  );
};

export default AudioConversation;
