export const animalConfig: Record<
  string,
  { emoji: string; color: string; label: string }
> = {
  CAT: { emoji: "🐱", color: "bg-orange-500", label: "고양이" },
  DOG: { emoji: "🐶", color: "bg-blue-500", label: "강아지" },
  OTHER: { emoji: "🐾", color: "bg-purple-500", label: "기타" },
};

export const statusConfig: Record<
  string,
  { label: string; color: string; bgColor: string }
> = {
  SPOTTED: { label: "목격", color: "bg-yellow-100 text-yellow-700", bgColor: "bg-yellow-500" },
  PROTECTING: { label: "보호 중", color: "bg-blue-100 text-blue-700", bgColor: "bg-blue-500" },
  FOUND: { label: "찾음", color: "bg-green-100 text-green-700", bgColor: "bg-green-500" },
};

export const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const formatDateShort = (dateString: string) => {
  const date = new Date(dateString);
  return `${date.getFullYear().toString().slice(2)}.${String(
    date.getMonth() + 1
  ).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
};

export const parseAddress = (address: string | null) => {
  if (!address) return { main: null, detail: null };

  const parts = address.split("|||");
  return {
    main: parts[0] || null,
    detail: parts[1] || null,
  };
};