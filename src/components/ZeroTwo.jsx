
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AudioLines,
  Heart,
  Mic,
  MicOff,
  PhoneOff,
  Sparkles,
  X,
} from "lucide-react";

const WS_URL =
  import.meta.env.VITE_ZERO_TWO_WS_URL ||
  "ws://localhost:8000/ws/zero-two";

const STICKER_URL = "/zero2.png";

function resampleTo16k(input, inputRate) {
  const outputRate = 16000;

  if (inputRate === outputRate) return input;

  const outputLength = Math.floor(
    (input.length * outputRate) / inputRate
  );

  const output = new Float32Array(outputLength);
  const ratio = inputRate / outputRate;

  for (let i = 0; i < outputLength; i++) {
    const position = i * ratio;
    const left = Math.floor(position);
    const right = Math.min(left + 1, input.length - 1);
    const fraction = position - left;

    output[i] =
      input[left] * (1 - fraction) +
      input[right] * fraction;
  }

  return output;
}

function floatToBase64(samples) {
  const pcm = new Int16Array(samples.length);

  for (let i = 0; i < samples.length; i++) {
    const sample = Math.max(-1, Math.min(1, samples[i]));

    pcm[i] =
      sample < 0
        ? Math.round(sample * 32768)
        : Math.round(sample * 32767);
  }

  const bytes = new Uint8Array(
    pcm.buffer,
    pcm.byteOffset,
    pcm.byteLength
  );

  let binary = "";
  const chunkSize = 0x8000;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(
      ...bytes.subarray(i, i + chunkSize)
    );
  }

  return btoa(binary);
}

function base64ToPcm16(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return new Int16Array(
    bytes.buffer,
    bytes.byteOffset,
    Math.floor(bytes.byteLength / 2)
  );
}

export default function ZeroTwoWidget() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState("idle");
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [speech, setSpeech] = useState(
    "Click me, darling. Let's find your next anime. 💗"
  );
  const [error, setError] = useState("");

  const socketRef = useRef(null);
  const audioContextRef = useRef(null);
  const micStreamRef = useRef(null);
  const sourceRef = useRef(null);
  const processorRef = useRef(null);
  const muteGainRef = useRef(null);
  const playbackCursorRef = useRef(0);
  const playingSourcesRef = useRef(new Set());
  const manualCloseRef = useRef(false);

  const stopPlayback = useCallback(() => {
    for (const source of playingSourcesRef.current) {
      try {
        source.stop();
        source.disconnect();
      } catch {}
    }

    playingSourcesRef.current.clear();

    if (audioContextRef.current) {
      playbackCursorRef.current =
        audioContextRef.current.currentTime;
    }

    setSpeaking(false);
  }, []);

  const stopListening = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.onaudioprocess = null;

      try {
        processorRef.current.disconnect();
      } catch {}

      processorRef.current = null;
    }

    if (sourceRef.current) {
      try {
        sourceRef.current.disconnect();
      } catch {}

      sourceRef.current = null;
    }

    if (muteGainRef.current) {
      try {
        muteGainRef.current.disconnect();
      } catch {}

      muteGainRef.current = null;
    }

    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => {
        track.stop();
      });

      micStreamRef.current = null;
    }

    setListening(false);
  }, []);

  const connect = useCallback(async () => {
    setError("");

    if (
      socketRef.current &&
      [
        WebSocket.CONNECTING,
        WebSocket.OPEN,
      ].includes(socketRef.current.readyState)
    ) {
      return;
    }

    manualCloseRef.current = false;
    setStatus("connecting");
    setSpeech("Waking up, darling... 💗");

    try {
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      await audioContext.resume();

      const socket = new WebSocket(WS_URL);
      socketRef.current = socket;

      socket.onopen = () => {
        setStatus("connecting");
      };

      socket.onmessage = async (event) => {
        let message;

        try {
          message = JSON.parse(event.data);
        } catch {
          return;
        }

        if (message.type === "ready") {
          setStatus("connected");
          setSpeech(
            "Darling~ what kind of anime are we watching today? 💕"
          );
        }

        if (message.type === "status") {
          setSpeech(message.message || "Getting ready...");
        }

        if (message.type === "transcript") {
          const text = message.text?.trim();

          if (text) {
            setSpeech(text);
          }
        }

        if (message.type === "audio" && message.data) {
          try {
            const context = audioContextRef.current;
            if (!context) return;

            if (context.state === "suspended") {
              await context.resume();
            }

            const pcm = base64ToPcm16(message.data);
            const buffer = context.createBuffer(
              1,
              pcm.length,
              24000
            );

            const channel = buffer.getChannelData(0);

            for (let i = 0; i < pcm.length; i++) {
              channel[i] =
                pcm[i] / (pcm[i] < 0 ? 32768 : 32767);
            }

            const source = context.createBufferSource();
            source.buffer = buffer;
            source.connect(context.destination);

            const startAt = Math.max(
              context.currentTime + 0.02,
              playbackCursorRef.current
            );

            playbackCursorRef.current =
              startAt + buffer.duration;

            playingSourcesRef.current.add(source);
            setSpeaking(true);

            source.onended = () => {
              playingSourcesRef.current.delete(source);

              try {
                source.disconnect();
              } catch {}

              if (playingSourcesRef.current.size === 0) {
                setSpeaking(false);
              }
            };

            source.start(startAt);
          } catch (audioError) {
            console.error("Zero Two playback error:", audioError);
            setError("Couldn't play the voice. Try again, darling.");
          }
        }

        if (message.type === "turn_complete") {
          if (playingSourcesRef.current.size === 0) {
            setSpeaking(false);
          }
        }

        if (message.type === "interrupted") {
          stopPlayback();
        }

        if (message.type === "error") {
          setError(message.message || "Gemini connection failed.");
          setStatus("error");
        }
      };

      socket.onerror = () => {
        setError("Couldn't connect. Check that FastAPI is running.");
        setStatus("error");
      };

      socket.onclose = () => {
        stopListening();
        stopPlayback();

        if (!manualCloseRef.current) {
          setStatus("idle");
          setSpeech(
            "Our connection dropped, darling. Click me to try again. 💗"
          );
        }
      };
    } catch (connectionError) {
      console.error(connectionError);
      setStatus("error");
      setError("Couldn't initialize audio.");
    }
  }, [stopListening, stopPlayback]);

  const startListening = useCallback(async () => {
    setError("");

    const socket = socketRef.current;

    if (!socket || socket.readyState !== WebSocket.OPEN) {
      await connect();
      setError("Connecting now. Tap the microphone again when I'm ready.");
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Microphone access requires HTTPS or localhost.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const context = audioContextRef.current;
      if (!context) throw new Error("Audio context unavailable.");

      await context.resume();
      micStreamRef.current = stream;

      const source = context.createMediaStreamSource(stream);
      sourceRef.current = source;

      const processor = context.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      const muteGain = context.createGain();
      muteGain.gain.value = 0;
      muteGainRef.current = muteGain;

      processor.onaudioprocess = (event) => {
        const currentSocket = socketRef.current;

        if (
          !currentSocket ||
          currentSocket.readyState !== WebSocket.OPEN
        ) {
          return;
        }

        const input = event.inputBuffer.getChannelData(0);
        const resampled = resampleTo16k(input, context.sampleRate);

        if (resampled.length) {
          currentSocket.send(
            JSON.stringify({
              type: "audio",
              data: floatToBase64(resampled),
            })
          );
        }
      };

      source.connect(processor);
      processor.connect(muteGain);
      muteGain.connect(context.destination);

      setListening(true);
      setSpeech("I'm listening, darling. Tell me your anime mood. 🎧");
    } catch (micError) {
      console.error(micError);
      setError("Microphone permission denied. Allow access in your browser.");
    }
  }, [connect]);

  const disconnect = useCallback(() => {
    manualCloseRef.current = true;

    stopListening();
    stopPlayback();

    const socket = socketRef.current;

    if (socket) {
      try {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: "stop" }));
        }

        socket.close();
      } catch {}

      socketRef.current = null;
    }

    audioContextRef.current?.close().catch(() => {});
    audioContextRef.current = null;

    setStatus("idle");
    setSpeech("Talk later, darling. I'll be right here. 💗");
  }, [stopListening, stopPlayback]);

  useEffect(() => {
    return () => {
      manualCloseRef.current = true;
      stopListening();
      stopPlayback();

      try {
        socketRef.current?.close();
      } catch {}

      audioContextRef.current?.close().catch(() => {});
    };
  }, [stopListening, stopPlayback]);

  const handleStickerClick = () => {
    if (open) {
      setOpen(false);
      return;
    }

    setOpen(true);
    connect();
  };

  return (
    <div className="fixed bottom-5 right-5 z-[9999] flex flex-col items-end gap-4 font-sans text-white sm:bottom-6 sm:right-6">
      <AnimatePresence>
        {open && (
          <motion.section
            initial={{ opacity: 0, y: 24, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 280, damping: 24 }}
            className="w-[min(360px,calc(100vw-32px))] overflow-hidden rounded-[24px] border border-pink-300/20 bg-[#160f20]/95 shadow-2xl shadow-fuchsia-950/40 backdrop-blur-2xl"
          >
            <header className="flex items-center gap-3 border-b border-white/10 bg-white/[0.03] p-4">
              <motion.img
                src={STICKER_URL}
                alt="Zero Two"
                animate={speaking ? { scale: [1, 1.06, 1] } : {}}
                transition={{
                  repeat: speaking ? Infinity : 0,
                  duration: 0.8,
                }}
                className="h-12 w-12 shrink-0 rounded-2xl object-contain"
              />

              <div className="min-w-0 flex-1">
                <h2 className="font-bold tracking-wide">Zero Two</h2>

                <p className="mt-1 flex items-center gap-2 text-xs text-pink-100/65">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      status === "connected"
                        ? "bg-emerald-400 shadow-[0_0_10px_#34d399]"
                        : status === "connecting"
                          ? "animate-pulse bg-amber-300"
                          : status === "error"
                            ? "bg-rose-400"
                            : "bg-zinc-500"
                    }`}
                  />

                  {status === "connected"
                    ? listening
                      ? "Listening to you"
                      : speaking
                        ? "Speaking, darling..."
                        : "Online, darling"
                    : status === "connecting"
                      ? "Waking up..."
                      : status === "error"
                        ? "Connection issue"
                        : "Waiting for you"}
                </p>
              </div>

              <button
                onClick={() => setOpen(false)}
                aria-label="Minimize Zero Two"
                className="grid h-9 w-9 place-items-center rounded-xl text-white/60 transition hover:bg-white/10 hover:text-white"
              >
                <X size={18} />
              </button>
            </header>

            <div className="p-4">
              <motion.div
                key={speech}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className={`relative rounded-2xl rounded-bl-sm border p-4 pl-9 text-sm leading-6 text-pink-50 ${
                  speaking
                    ? "border-pink-300/50 bg-pink-500/10 shadow-lg shadow-pink-500/5"
                    : "border-pink-300/20 bg-gradient-to-br from-pink-500/10 to-fuchsia-500/5"
                }`}
                aria-live="polite"
              >
                <Heart
                  size={14}
                  fill="currentColor"
                  className="absolute left-3 top-4 text-pink-300"
                />

                {speech}

                <span className="absolute -bottom-1.5 left-4 h-3 w-3 rotate-45 border-b border-l border-pink-300/20 bg-[#281529]" />
              </motion.div>

              {error && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mt-3 rounded-xl border border-rose-300/20 bg-rose-500/10 p-3 text-xs leading-5 text-rose-200"
                  role="alert"
                >
                  {error}
                </motion.p>
              )}

              <div className="mt-5 flex gap-2">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={listening ? stopListening : startListening}
                  disabled={status === "connecting"}
                  className={`flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-bold transition disabled:cursor-wait disabled:opacity-50 ${
                    listening
                      ? "bg-gradient-to-r from-violet-600 to-fuchsia-600"
                      : "bg-gradient-to-r from-pink-500 to-rose-600 shadow-lg shadow-pink-950/30"
                  }`}
                >
                  {listening ? <MicOff size={17} /> : <Mic size={17} />}
                  {listening ? "Stop listening" : "Talk to me"}
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={disconnect}
                  title="End voice session"
                  aria-label="End voice session"
                  className="grid h-12 w-12 place-items-center rounded-2xl border border-rose-300/15 bg-rose-500/10 text-rose-200 transition hover:bg-rose-500/20"
                >
                  <PhoneOff size={17} />
                </motion.button>
              </div>

              <p className="mt-3 text-center text-[11px] leading-5 text-white/40">
                {listening
                  ? "Speak naturally, darling. Tap stop when you're done."
                  : "Tell me your mood and I'll find your next anime."}
              </p>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      <div className="relative">
        <AnimatePresence>
          {!open && (
            <motion.div
              initial={{ opacity: 0, x: 12, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 8, scale: 0.9 }}
              className="absolute bottom-9 right-[88px] w-max max-w-[190px] rounded-2xl rounded-br-sm border border-pink-200/20 bg-[#1b1024]/95 px-3 py-2.5 text-xs text-pink-50 shadow-xl backdrop-blur-xl"
            >
              <span className="flex items-center gap-1.5">
                <Sparkles size={13} className="text-pink-300" />
                Need an anime, darling?
              </span>

              <span className="absolute -bottom-1 right-3 h-2 w-2 rotate-45 border-b border-r border-pink-200/20 bg-[#1b1024]" />
            </motion.div>
          )}
        </AnimatePresence>

        <motion.button
          onClick={handleStickerClick}
          aria-label={open ? "Hide Zero Two" : "Talk to Zero Two"}
          title="Talk to Zero Two"
          whileHover={{ y: -5, rotate: -2, scale: 1.04 }}
          whileTap={{ scale: 0.94 }}
          animate={{ y: [0, -5, 0] }}
          transition={{
            y: { repeat: Infinity, duration: 3.2, ease: "easeInOut" },
          }}
          className="group relative grid h-[104px] w-[96px] place-items-center rounded-[28px] border border-pink-200/25 bg-gradient-to-br from-pink-400/20 via-fuchsia-700/20 to-violet-950/40 shadow-xl shadow-fuchsia-950/30 backdrop-blur-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-300"
        >
          <span className="absolute inset-2 rounded-[24px] bg-pink-400/10 blur-xl transition group-hover:bg-pink-400/25" />

          <motion.img
            src={STICKER_URL}
            alt="Zero Two anime companion"
            draggable={false}
            animate={
              speaking
                ? { scale: [1, 1.06, 1], rotate: [0, 1, 0, -1, 0] }
                : listening
                  ? { rotate: [0, -3, 3, 0] }
                  : { y: [0, -2, 0] }
            }
            transition={{
              repeat: Infinity,
              duration: speaking ? 0.65 : listening ? 1.3 : 3,
              ease: "easeInOut",
            }}
            className="relative z-10 h-[82px] w-[78px] select-none object-contain drop-shadow-[0_0_12px_rgba(244,114,182,0.45)]"
            onError={(event) => {
              event.currentTarget.style.opacity = "0.35";
            }}
          />

          <span className="absolute -bottom-1 inline-flex items-center gap-1 rounded-full border border-pink-200/30 bg-[#35132e] px-2 py-1 text-[8px] font-black tracking-[.13em] text-pink-100">
            <Heart size={9} fill="currentColor" />
            ZERO TWO
          </span>

          <AnimatePresence>
            {speaking && (
              <motion.span
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.6 }}
                className="absolute -inset-2 -z-10 rounded-full border border-pink-300/60"
              >
                <motion.span
                  animate={{
                    scale: [1, 1.16, 1],
                    opacity: [0.7, 0.2, 0.7],
                  }}
                  transition={{ repeat: Infinity, duration: 1.2 }}
                  className="absolute inset-0 rounded-full border border-fuchsia-300/60"
                />
              </motion.span>
            )}
          </AnimatePresence>

          {speaking && (
            <motion.span
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute -right-1 -top-2 grid h-7 w-7 place-items-center rounded-full border border-pink-200/30 bg-[#2a1531] text-pink-200 shadow-lg"
            >
              <AudioLines size={14} />
            </motion.span>
          )}

          <span className="sr-only">
            {speaking ? "Zero Two is speaking" : "Open Zero Two"}
          </span>
        </motion.button>
      </div>
    </div>
  );
}
