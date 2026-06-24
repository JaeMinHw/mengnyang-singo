"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import api from "@/lib/api";
import { removeAccessToken } from "@/lib/auth";
import Image from "next/image";
interface CurrentUser {
  id: number;
  email: string;
  nickname: string;
  phone: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface HeaderProps {
  currentUser: CurrentUser | null;
  authLoading: boolean;
}

export default function Header({ currentUser, authLoading }: HeaderProps) {
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnreadCount = async () => {
    if (!currentUser) {
      setUnreadCount(0);
      return;
    }

    try {
      const response = await api.get<{ count: number }>("/notifications/unread-count");
      setUnreadCount(response.data.count);
    } catch (err) {
      console.error("안읽은 알림 개수 조회 실패:", err);
    }
  };

  useEffect(() => {
    if (!currentUser) {
      setUnreadCount(0);
      return;
    }

    fetchUnreadCount();

    const interval = window.setInterval(() => {
      fetchUnreadCount();
    }, 30000);

    const handleFocus = () => {
      fetchUnreadCount();
    };

    window.addEventListener("focus", handleFocus);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, [currentUser]);

  const handleLogout = () => {
    removeAccessToken();
    setUnreadCount(0);
    router.push("/");
    window.location.reload();
  };

  return (
    <header className="w-full bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between z-50">
      <Link href="/" className="text-lg font-bold text-gray-900">
        🐾 멍냥신고
      </Link>

      <div className="flex items-center gap-3">
        {authLoading ? (
          <p className="text-sm text-gray-400">확인 중...</p>
        ) : currentUser ? (
          <>
            <Link
              href="/sightings/new"
              className="inline-flex items-center justify-center rounded-lg bg-orange-500 px-3 py-2 text-white hover:bg-orange-600 transition-colors"
            >
              <span className="text-center leading-tight text-xs sm:text-sm">
                <span className="sm:hidden">
                  목격 및 실종
                  <br />
                  등록하기
                </span>
                <span className="hidden sm:inline">목격 및 실종 등록하기</span>
              </span>
            </Link>

            <Link
              href="/notifications"
              className="relative inline-flex items-center justify-center w-10 h-10 rounded-full hover:bg-gray-100 transition-colors"
              aria-label="알림"
              title="알림"
            >
              <div className="relative">
              <img
                src="/bell.png"
                alt="알림"
                className="w-8 h-8"
              />

              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[20px] h-5 px-1 rounded-full bg-red-500 text-white text-[11px] font-semibold flex items-center justify-center">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </div>
            </Link>

            <Link
              href="/mypage"
              className="text-sm text-gray-700 font-medium hover:text-blue-600 transition-colors underline underline-offset-2"
            >
              {currentUser.nickname}님
            </Link>

            <button
              onClick={handleLogout}
              className="text-sm text-gray-500 hover:text-red-500 transition-colors"
            >
              로그아웃
            </button>
          </>
        ) : (
          <>
            <Link
              href="/login"
              className="text-sm text-gray-700 hover:text-blue-600 transition-colors"
            >
              로그인
            </Link>
            <Link
              href="/signup"
              className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors"
            >
              회원가입
            </Link>
          </>
        )}
      </div>
    </header>
  );
}