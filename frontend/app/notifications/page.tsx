"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import api from "@/lib/api";
import Header from "@/components/Header";
import type { CurrentUser, Notification } from "@/types/sighting";
import { formatDate } from "@/lib/sightingUtils";

const TYPE_CONFIG: Record<string, { emoji: string; label: string }> = {
  NEW_COMMENT: { emoji: "💬", label: "새 댓글" },
  STATUS_CHANGED: { emoji: "🔄", label: "상태 변경" },
  KEYWORD_MATCH: { emoji: "🔍", label: "키워드 매칭" },
};

export default function NotificationsPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);
  const TYPE_CONFIG: Record<string, { emoji: string; label: string }> = {
    NEW_COMMENT: { emoji: "💬", label: "새 댓글" },
    STATUS_CHANGED: { emoji: "🔄", label: "상태 변경" },
    KEYWORD_MATCH: { emoji: "🔍", label: "키워드 매칭" },
    SIMILAR_MATCH: { emoji: "🧩", label: "유사 글 매칭" },
  };
  useEffect(() => {
    api
      .get<CurrentUser>("/me")
      .then((res) => setCurrentUser(res.data))
      .catch(() => {
        setCurrentUser(null);
        router.push("/login");
      })
      .finally(() => setAuthLoading(false));
  }, []);

  useEffect(() => {
    api
      .get<Notification[]>("/notifications")
      .then((res) => setNotifications(res.data))
      .catch((err) => console.error("알림 목록 조회 실패:", err))
      .finally(() => setLoading(false));
  }, []);

  const handleMarkAsRead = async (notificationId: number) => {
    try {
      await api.patch(`/notifications/${notificationId}/read`);
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId ? { ...n, is_read: true } : n
        )
      );
    } catch (err) {
      console.error("읽음 처리 실패:", err);
    }
  };

  const handleMarkAllAsRead = async () => {
    setMarkingAll(true);
    try {
      await api.patch("/notifications/read-all");
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch (err) {
      console.error("전체 읽음 처리 실패:", err);
    } finally {
      setMarkingAll(false);
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    // 읽음 처리
    if (!notification.is_read) {
      await handleMarkAsRead(notification.id);
    }

    // 해당 글로 이동
    if (notification.sighting_id) {
      router.push(`/?sighting_id=${notification.sighting_id}`);
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <main className="min-h-[100dvh] bg-gray-50">
      <Header currentUser={currentUser} authLoading={authLoading} />

      <div className="max-w-2xl mx-auto px-4 py-6 sm:px-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">알림</h1>
            <p className="text-sm text-gray-500 mt-1">
              {unreadCount > 0
                ? `읽지 않은 알림이 ${unreadCount}개 있습니다.`
                : "모든 알림을 확인했습니다."}
            </p>
          </div>

          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              disabled={markingAll}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium disabled:text-gray-400 transition-colors"
            >
              {markingAll ? "처리 중..." : "모두 읽음"}
            </button>
          )}
        </div>

        <section className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
          {loading ? (
            <div className="px-4 py-12 text-center text-gray-500">
              알림을 불러오는 중입니다...
            </div>
          ) : notifications.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <p className="text-4xl mb-3">🔔</p>
              <p className="text-gray-700 font-medium">아직 알림이 없습니다.</p>
              <p className="text-sm text-gray-500 mt-2">
                내 글에 댓글이 달리거나 상태가 변경되거나 유사한 글이 등록되면 알림이 옵니다.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {notifications.map((notification) => {
                const typeConf =
                  TYPE_CONFIG[notification.type] || {
                    emoji: "🔔",
                    label: notification.type,
                  };

                return (
                  <li
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`px-4 py-4 cursor-pointer transition hover:bg-gray-50 ${
                      !notification.is_read ? "bg-blue-50" : ""
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* 타입 아이콘 */}
                      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-xl flex-shrink-0">
                        {typeConf.emoji}
                      </div>

                      <div className="flex-1 min-w-0">
                        {/* 타입 뱃지 + 읽음 여부 */}
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-gray-500">
                            {typeConf.label}
                          </span>
                          {!notification.is_read && (
                            <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                          )}
                        </div>

                        {/* 메시지 */}
                        <p className={`text-sm leading-relaxed ${
                          !notification.is_read
                            ? "text-gray-900 font-medium"
                            : "text-gray-600"
                        }`}>
                          {notification.message}
                        </p>

                        {/* 시간 */}
                        <p className="text-xs text-gray-400 mt-1">
                          {formatDate(notification.created_at)}
                        </p>
                      </div>

                      {/* 안읽음 표시 우측 */}
                      {!notification.is_read && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkAsRead(notification.id);
                          }}
                          className="text-xs text-blue-500 hover:text-blue-700 flex-shrink-0 transition-colors"
                        >
                          읽음
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}