export interface Sighting {
  id: number;
  user_id: number;
  user_nickname: string | null;
  animal_type: string;
  description: string | null;
  image_url: string | null;
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