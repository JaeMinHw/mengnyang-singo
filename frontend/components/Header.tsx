"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { removeAccessToken } from "@/lib/auth";

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

  const handleLogout = () => {
    removeAccessToken();
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

            <span className="text-sm text-gray-700 font-medium">
              {currentUser.nickname}님
            </span>

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