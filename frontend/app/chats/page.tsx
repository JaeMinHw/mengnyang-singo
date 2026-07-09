"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import api from "@/lib/api";
import Header from "@/components/Header";
import type { CurrentUser, ChatRoom } from "@/types/sighting";
import {
  animalConfig,
  formatDate,
  parseAddress,
  postTypeConfig,
} from "@/lib/sightingUtils";

export default function ChatsPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<CurrentUser>("/me")
      .then((res) => setCurrentUser(res.data))
      .catch(() => setCurrentUser(null))
      .finally(() => setAuthLoading(false));
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!currentUser) {
      router.replace("/");
      return;
    }

    api
      .get<ChatRoom[]>("/chat/rooms")
      .then((res) => setRooms(res.data))
      .catch((err) => console.error("채팅방 목록 조회 실패:", err))
      .finally(() => setLoading(false));
  }, [authLoading, currentUser, router]);

  if (!authLoading && !currentUser) return null;

  const getRoomTitle = (room: ChatRoom) => {
    const animal = animalConfig[room.sighting_animal_type || ""];
    const postType = postTypeConfig[room.sighting_post_type || ""];
    const emoji = animal?.emoji || "🐾";
    const animalLabel = animal?.label || "동물";
    const postTypeLabel = postType?.label || "";
    return `${emoji} ${animalLabel} ${postTypeLabel} #${room.sighting_id}`;
  };

  const getPartnerNickname = (room: ChatRoom) => {
    if (!currentUser) return "상대방";
    if (room.owner_user_id === currentUser.id) {
      return room.participant_nickname || "상대방";
    }
    return room.owner_nickname || "상대방";
  };

  return (
    <main className="min-h-[100dvh] bg-gray-50">
      <Header currentUser={currentUser} authLoading={authLoading} />

      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">채팅</h1>
          <p className="text-sm text-gray-500 mt-1">
            글을 통해 시작된 대화 목록입니다.
          </p>
        </div>

        <section className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
          {loading ? (
            <div className="px-4 py-12 text-center text-gray-500">
              채팅방 목록을 불러오는 중입니다...
            </div>
          ) : rooms.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <p className="text-gray-700 font-medium">아직 채팅방이 없습니다.</p>
              <p className="text-sm text-gray-500 mt-2">
                글 상세에서 작성자와 채팅을 시작해보세요.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {rooms.map((room) => {
                const { main } = parseAddress(room.sighting_address);
                const partnerNickname = getPartnerNickname(room);
                const isDeleted = room.sighting_is_deleted;

                return (
                  <Link
                    key={room.id}
                    href={`/chats/${room.id}`}
                    className="flex items-start gap-3 px-4 py-4 hover:bg-gray-50 transition-colors"
                  >
                    {/* 아이콘 */}
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center text-white text-xl flex-shrink-0 ${
                        animalConfig[room.sighting_animal_type || ""]?.color ||
                        "bg-gray-400"
                      }`}
                    >
                      {animalConfig[room.sighting_animal_type || ""]?.emoji ||
                        "🐾"}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          {getRoomTitle(room)}
                        </p>
                        {room.last_message_at && (
                          <p className="text-xs text-gray-400 flex-shrink-0">
                            {formatDate(room.last_message_at)}
                          </p>
                        )}
                      </div>

                      <p className="text-xs text-gray-500 mt-0.5">
                        {partnerNickname}님과의 대화
                        {main && ` · 📍 ${main}`}
                      </p>

                      {isDeleted && (
                        <span className="inline-block mt-1 text-[11px] px-2 py-0.5 rounded-full bg-red-50 text-red-500 border border-red-200">
                          삭제된 글
                        </span>
                      )}

                      {room.last_message_content ? (
                        <p className="text-sm text-gray-500 mt-1 truncate">
                          {room.last_message_content}
                        </p>
                      ) : (
                        <p className="text-sm text-gray-400 mt-1 italic">
                          아직 메시지가 없습니다
                        </p>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}