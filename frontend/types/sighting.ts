export interface Sighting {
  id: number;
  user_id: number;
  user_nickname: string | null;
  animal_type: string;
  description: string | null;
  image_url: string | null;
  image_urls: string[];         // ← 추가
  latitude: number;
  longitude: number;
  address: string | null;
  status: string;
  post_type: string;
  resolved_at: string | null;
  reopen_reason: string | null;
  reopen_detail: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClusterInfo {
  center: { lat: number; lng: number };
  markers: Sighting[];
}

export interface CurrentUser {
  id: number;
  email: string;
  nickname: string;
  phone: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Comment {
  id: number;
  sighting_id: number;
  user_id: number;
  user_nickname: string | null;
  content: string | null;
  image_url: string | null;
  created_at: string;
  updated_at: string;
}


export interface MyComment extends Comment {
  sighting_animal_type: string | null;
  sighting_address: string | null;
  sighting_status: string | null;
  sighting_post_type: string | null;
  sighting_image_url: string | null;
  sighting_description: string | null;
}

export interface MyCommentListResponse {
  items: MyComment[];
  total: number;
}

export interface Notification {
  id: number;
  user_id: number;
  type: string;
  sighting_id: number | null;
  comment_id: number | null;
  actor_id: number | null;
  actor_nickname: string | null;
  message: string;
  is_read: boolean;
  created_at: string;
}

export interface KeywordSubscription {
  id: number;
  user_id: number;
  keyword: string;
  is_active: boolean;
  created_at: string;
}

export interface ChatRoom {
  id: number;
  sighting_id: number;
  sighting_description: string | null;
  sighting_animal_type: string | null;
  sighting_address: string | null;
  sighting_post_type: string | null;
  sighting_is_deleted: boolean;
  owner_user_id: number;
  owner_nickname: string | null;
  participant_user_id: number;
  participant_nickname: string | null;
  last_message_at: string | null;
  last_message_content: string | null;
  created_at: string;
}

export interface ChatMessage {
  id: number;
  room_id: number;
  sender_user_id: number;
  sender_nickname: string | null;
  content: string;
  created_at: string;
}