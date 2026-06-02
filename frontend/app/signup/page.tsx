"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import api from "@/lib/api";

// 1. 휴대폰 번호 포맷팅 함수 (컴포넌트 외부나 내부에 독립적으로 선언)
const formatPhoneNumber = (value: string) => {
  if (!value) return value;

  // 숫자만 남기기
  const phoneNumber = value.replace(/[^\d]/g, "");

  // 문자열 길이에 따라 하이픈 추가
  if (phoneNumber.length < 4) return phoneNumber;
  if (phoneNumber.length < 7) {
    return `${phoneNumber.slice(0, 3)}-${phoneNumber.slice(3)}`;
  }
  if (phoneNumber.length < 11) {
    return `${phoneNumber.slice(0, 3)}-${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6)}`;
  }
  return `${phoneNumber.slice(0, 3)}-${phoneNumber.slice(3, 7)}-${phoneNumber.slice(7, 11)}`;
};

export default function SignupPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [phone, setPhone] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSignup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage("");

    try {
      await api.post("/signup", {
        email,
        password,
        nickname,
        // 2. 서버로 전송할 때는 하이픈을 제거한 숫자만 전송 (선택 사항)
        phone: phone.replace(/-/g, ""), 
      });

      alert("회원가입이 완료되었습니다. 로그인 페이지로 이동합니다.");
      router.push("/login");
    } catch (error: any) {
      console.error("회원가입 실패:", error);

      const detail = error?.response?.data?.detail;

      if (typeof detail === "string") {
        setErrorMessage(detail);
      } else {
        setErrorMessage("회원가입에 실패했습니다. 입력값을 확인해주세요.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">회원가입</h1>
        <p className="text-sm text-gray-500 mb-6">
          멍냥신고 서비스를 이용하려면 회원가입해주세요.
        </p>

        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              이메일
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@email.com"
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-black outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              비밀번호
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호를 입력하세요"
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-black outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              닉네임
            </label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="닉네임을 입력하세요"
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-black outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              전화번호
            </label>
            <input
              type="text"
              value={phone}
              onChange={(e) => {
                const formattedValue = formatPhoneNumber(e.target.value);
                setPhone(formattedValue);
              }}
              placeholder="010-1234-5678"
              maxLength={13} 
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-black outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              required
            />
          </div>

          {errorMessage && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
              {errorMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold py-3 transition-colors"
          >
            {loading ? "회원가입 중..." : "회원가입"}
          </button>
        </form>

        <div className="mt-6 text-sm text-center text-gray-500">
          이미 계정이 있나요?{" "}
          <Link href="/login" className="text-blue-600 hover:underline">
            로그인
          </Link>
        </div>
      </div>
    </main>
  );
}