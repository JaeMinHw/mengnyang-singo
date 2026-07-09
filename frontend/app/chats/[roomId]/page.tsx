"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import api from "@/lib/api";
import Header from "@/components/Header";
import type { CurrentUser, ChatRoom, ChatMessage } from "@/types/sighting";
import { animalConfig, formatDate, postTypeConfig } from "@/lib/sightingUtils";

const POLL_INTERVAL = 4000;

export default function ChatRoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [room, setRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastMessageIdRef = useRef<number>(0);

  useEffect(() => {
    api
      .get<CurrentUser>("/me")
      .then((res) => setCurrentUser(res.data))
      .catch(() => setCurrentUser(null))
      .finally(() => setAuthLoading(false));
  }, []);

  const fetchMessages = useCallback(
    async (isInitial = false) => {
      try {
        const res = await api.get<ChatMessage[]>(
          `/chat/rooms/${roomId}/messages`
        );
        const fetched = res.data;

        if (fetched.length === 0) return;

        const latestId = fetched[fetched.length - 1].id;

        if (isInitial) {
          setMessages(fetched);
          lastMessageIdRef.current = latestId;
          return;
        }

        if (latestId > lastMessageIdRef.current) {
          setMessages(fetched);
          lastMessageIdRef.current = latestId;
        }
      } catch (err) {
        console.error("메시지 조회 실패:", err);
      }
    },
    [roomId]
  );

  useEffect(() => {
    if (authLoading) return;
    if (!currentUser) {
      router.replace("/");
      return;
    }

    const init = async () => {
      try {
        const res = await api.get<ChatRoom[]>("/chat/rooms");
        const found = res.data.find((r) => r.id === Number(roomId));
        if (!found) {
          router.replace("/chats");
          return;
        }
        setRoom(found);
        await fetchMessages(true);
      } catch (err) {
        console.error("채팅방 초기 로딩 실패:", err);
        router.replace("/chats");
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [authLoading, currentUser, roomId, router, fetchMessages]);

  // 스크롤 아래로
  useEffect(() => {
    if (messages.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // 폴링 시작
  useEffect(() => {
    if (!currentUser || loading) return;

    pollingRef.current = setInterval(() => {
      fetchMessages(false);
    }, POLL_INTERVAL);

    const handleFocus = () => fetchMessages(false);
    window.addEventListener("focus", handleFocus);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      window.removeEventListener("focus", handleFocus);
    };
  }, [currentUser, loading, fetchMessages]);

  const handleSend = async () => {
    if (!input.trim() || sending) return;

    setSending(true);
    const content = input.trim();
    setInput("");

    try {
      const res = await api.post<ChatMessage>(
        `/chat/rooms/${roomId}/messages`,
        { content }
      );
      setMessages((prev) => [...prev, res.data]);
      lastMessageIdRef.current = res.data.id;
    } catch (err: any) {
      console.error("메시지 전송 실패:", err);
      setInput(content);

      if (err?.response?.status === 403) {
        alert(
          err?.response?.data?.detail ||
            "메시지를 보낼 수 없습니다."
        );
      } else {
        alert("메시지 전송에 실패했습니다.");
      }
    } finally {
      setSending(false);
    }
  };

  const isLocked = room?.sighting_is_deleted ?? false;

  const getRoomTitle = () => {
    if (!room) return "채팅";
    const animal = animalConfig[room.sighting_animal_type || ""];
    const postType = postTypeConfig[room.sighting_post_type || ""];
    return `${animal?.emoji || "🐾"} ${animal?.label || "동물"} ${postType?.label || ""} #${room.sighting_id}`;
  };

  const getPartnerNickname = () => {
    if (!room || !currentUser) return "상대방";
    if (room.owner_user_id === currentUser.id) {
      return room.participant_nickname || "상대방";
    }
    return room.owner_nickname || "상대방";
  };

  if (!authLoading && !currentUser) return null;

  return (
    <div className="flex flex-col min-h-[100dvh] bg-gray-50">
      <Header currentUser={currentUser} authLoading={authLoading} />

      {/* 채팅방 헤더 */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <Link
          href="/chats"
          className="text-gray-500 hover:text-gray-700 transition-colors"
        >
          ←
        </Link>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900 truncate">
            {getRoomTitle()}
          </p>
          <p className="text-xs text-gray-500">
            {getPartnerNickname()}님과의 대화
          </p>
        </div>

        {isLocked && (
          <span className="text-[11px] px-2 py-1 rounded-full bg-red-50 text-red-500 border border-red-200 flex-shrink-0">
            읽기 전용
          </span>
        )}
      </div>

      {/* 메시지 목록 */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {loading ? (
          <p className="text-center text-gray-400 text-sm py-8">
            불러오는 중...
          </p>
        ) : messages.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-8">
            아직 메시지가 없습니다. 먼저 인사를 건네보세요!
          </p>
        ) : (
          messages.map((msg) => {
            const isMine = msg.sender_user_id === currentUser?.id;

            return (
              <div
                key={msg.id}
                className={`flex ${isMine ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[75%] space-y-1 ${
                    isMine ? "items-end" : "items-start"
                  } flex flex-col`}
                >
                  {!isMine && (
                    <p className="text-xs text-gray-500 px-1">
                      {msg.sender_nickname || "상대방"}
                    </p>
                  )}

                  <div
                    className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                      isMine
                        ? "bg-blue-500 text-white rounded-tr-sm"
                        : "bg-white text-gray-800 border border-gray-200 rounded-tl-sm"
                    }`}
                  >
                    {msg.content}
                  </div>

                  <p className="text-[11px] text-gray-400 px-1">
                    {formatDate(msg.created_at)}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* 입력창 */}
      <div className="bg-white border-t border-gray-200 px-4 py-3">
        {isLocked ? (
          <div className="text-center text-sm text-gray-400 py-2">
            삭제된 글의 채팅방이라 메시지를 보낼 수 없습니다.
          </div>
        ) : (
          <div className="flex gap-2 items-end">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="메시지를 입력하세요"
              rows={1}
              className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-black outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 resize-none"
            />
            <button
              onClick={handleSend}
              disabled={sending || !input.trim()}
              className="px-4 py-2.5 rounded-xl bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 disabled:bg-gray-300 disabled:text-gray-500 transition-colors flex-shrink-0"
            >
              {sending ? "..." : "전송"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}