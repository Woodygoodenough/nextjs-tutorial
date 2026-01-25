"use client";

import { useState, useRef, useEffect } from "react";
import { submitConversationTurnAction } from "@/lib/actions/conversation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AudioRecorder } from "@/components/ui/audio-recorder";
import { Loader2, Send, Mic, Volume2, User, Bot, MessageSquarePlus } from "lucide-react";
import { cn } from "@/lib/utils";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  audio?: string | null;
  feedback?: string;
};

type Props = {
  initialAiMessage: string;
  initialAiAudio: string | null;
  wordsToPractice: string[];
};

export function ConversationClient({ initialAiMessage, initialAiAudio, wordsToPractice }: Props) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "init",
      role: "assistant",
      content: initialAiMessage,
      audio: initialAiAudio
    }
  ]);

  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [inputType, setInputType] = useState<"text" | "audio">("audio");

  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Play audio when new assistant message arrives (optional, maybe just for the very last one?)
  useEffect(() => {
    const lastMsg = messages[messages.length - 1];
    if (lastMsg?.role === "assistant" && lastMsg.audio) {
      // Auto-play could be annoying or blocked by browser.
      // Let's rely on user clicking play for now, or use a silent play attempt.
      // const audio = new Audio(`data:audio/mp3;base64,${lastMsg.audio}`);
      // audio.play().catch(() => {}); // Catch autoplay block errors
    }
  }, [messages]);

  const handleSendMessage = async (input: string | Blob) => {
    setIsLoading(true);

    // 1. Add User Message Optimistically (if text)
    const tempId = Date.now().toString();
    if (typeof input === 'string') {
        setMessages(prev => [...prev, { id: tempId, role: "user", content: input }]);
        setInputText("");
    } else {
        // Blob (Audio) - Placeholder
        setMessages(prev => [...prev, { id: tempId, role: "user", content: "🎤 Sending audio..." }]);
    }

    try {
        // Prepare Payload
        let payload: string | FormData;
        if (typeof input === 'string') {
            payload = input;
        } else {
            const fd = new FormData();
            fd.append("audio", input, "voice.webm");
            payload = fd;
        }

        // Prepare History (exclude the one we just added optimistically)
        // We only send role/content pairs to the server
        const historyForServer = messages.map(m => ({ role: m.role, content: m.content }));

        // Call Server Action
        const result = await submitConversationTurnAction(historyForServer, wordsToPractice, payload);

        // Update Messages
        setMessages(prev => {
            const next = [...prev];
            // Find the optimistic user message and update it
            const userMsgIdx = next.findIndex(m => m.id === tempId);
            if (userMsgIdx !== -1) {
                next[userMsgIdx] = {
                    ...next[userMsgIdx],
                    content: result.userText || "(Audio Message)"
                };
            }

            // Add AI Response
            next.push({
                id: Date.now().toString() + "_ai",
                role: "assistant",
                content: result.aiReply,
                audio: result.aiAudio,
                feedback: result.feedback
            });

            return next;
        });

    } catch (e) {
        console.error("Conversation failed", e);
        // Error handling (remove optimistic message or show error)
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <Card className="flex flex-col h-full shadow-lg border-muted">
      {/* Chat Area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-6 bg-muted/10"
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
                "flex gap-3 max-w-[85%]",
                msg.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
            )}
          >
            <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-emerald-600 text-white"
            )}>
                {msg.role === "user" ? <User size={16} /> : <Bot size={16} />}
            </div>

            <div className="space-y-1">
                <div className={cn(
                    "p-4 rounded-2xl shadow-sm",
                    msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-tr-none"
                        : "bg-white dark:bg-zinc-800 border rounded-tl-none"
                )}>
                    <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>

                    {msg.role === "assistant" && msg.audio && (
                        <div className="mt-3 pt-2 border-t border-black/10 dark:border-white/10 flex items-center gap-2">
                             <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-xs hover:bg-black/5 dark:hover:bg-white/5"
                                onClick={() => {
                                    const a = new Audio(`data:audio/mp3;base64,${msg.audio}`);
                                    a.play();
                                }}
                             >
                                <Volume2 className="h-3 w-3 mr-1" />
                                Play Audio
                             </Button>
                        </div>
                    )}
                </div>

                {/* Feedback Bubble */}
                {msg.feedback && (
                    <div className="text-xs bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300 p-2 rounded-lg mt-1 max-w-[90%] ml-2">
                        <span className="font-bold mr-1">💡 Feedback:</span>
                        {msg.feedback}
                    </div>
                )}
            </div>
          </div>
        ))}

        {isLoading && (
            <div className="flex gap-3 mr-auto max-w-[80%]">
                 <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center flex-shrink-0">
                    <Bot size={16} />
                </div>
                <div className="bg-muted p-4 rounded-2xl rounded-tl-none flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Thinking...</span>
                </div>
            </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 bg-background border-t">
        <Tabs value={inputType} onValueChange={(v) => setInputType(v as "text" | "audio")} className="w-full">
            <div className="flex justify-between items-center mb-2">
                 <TabsList>
                    <TabsTrigger value="audio" className="flex gap-2">
                        <Mic size={14} /> Voice
                    </TabsTrigger>
                    <TabsTrigger value="text" className="flex gap-2">
                        <MessageSquarePlus size={14} /> Text
                    </TabsTrigger>
                </TabsList>
            </div>

            <TabsContent value="audio" className="mt-0">
                <div className="flex items-center gap-4 p-4 border-2 border-dashed rounded-xl bg-muted/20 justify-center">
                    <AudioRecorder
                        onRecordingComplete={(blob) => handleSendMessage(blob)}
                        disabled={isLoading}
                    />
                    <p className="text-sm text-muted-foreground">Record your response</p>
                </div>
            </TabsContent>

            <TabsContent value="text" className="mt-0 relative">
                <Textarea
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Type a message..."
                    className="pr-12 resize-none"
                    rows={2}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            if(inputText.trim()) handleSendMessage(inputText);
                        }
                    }}
                />
                <Button
                    size="icon"
                    className="absolute bottom-2 right-2 h-8 w-8"
                    disabled={!inputText.trim() || isLoading}
                    onClick={() => handleSendMessage(inputText)}
                >
                    <Send className="h-4 w-4" />
                </Button>
            </TabsContent>
        </Tabs>
      </div>
    </Card>
  );
}
