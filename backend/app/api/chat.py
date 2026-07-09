from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.sighting import Sighting
from app.models.comment import Comment
from app.models.chat_room import ChatRoom
from app.models.chat_message import ChatMessage
from app.schemas.chat import (
    ChatRoomOpenRequest,
    ChatRoomResponse,
    ChatMessageCreate,
    ChatMessageResponse,
)
from datetime import datetime

router = APIRouter()


def room_to_response(room: ChatRoom, last_message: ChatMessage | None = None) -> dict:
    sighting = room.sighting

    return {
        "id": room.id,
        "sighting_id": room.sighting_id,
        "sighting_description": sighting.description if sighting else None,
        "sighting_animal_type": sighting.animal_type if sighting else None,
        "sighting_address": sighting.address if sighting else None,
        "sighting_post_type": sighting.post_type if sighting else None,
        "sighting_is_deleted": sighting.is_deleted if sighting else False,
        "owner_user_id": room.owner_user_id,
        "owner_nickname": room.owner.nickname if room.owner else None,
        "participant_user_id": room.participant_user_id,
        "participant_nickname": room.participant.nickname if room.participant else None,
        "last_message_at": room.last_message_at,
        "last_message_content": last_message.content if last_message else None,
        "created_at": room.created_at,
    }


def get_room_last_message(db: Session, room_id: int) -> ChatMessage | None:
    return (
        db.query(ChatMessage)
        .filter(ChatMessage.room_id == room_id)
        .order_by(ChatMessage.id.desc())
        .first()
    )


@router.post("/chat/rooms/open", response_model=ChatRoomResponse)
def open_chat_room(
    data: ChatRoomOpenRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sighting = db.query(Sighting).filter(
        Sighting.id == data.sighting_id,
    ).first()

    if not sighting:
        raise HTTPException(status_code=404, detail="글을 찾을 수 없습니다")

    target_user = db.query(User).filter(User.id == data.target_user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="상대방을 찾을 수 없습니다")

    if current_user.id == data.target_user_id:
        raise HTTPException(status_code=400, detail="자기 자신에게 채팅을 시작할 수 없습니다")

    # 글 작성자가 채팅을 거는 경우 → 상대방이 내 글에 댓글을 단 사람이어야 함
    if current_user.id == sighting.user_id:
        has_comment = db.query(Comment).filter(
            Comment.sighting_id == data.sighting_id,
            Comment.user_id == data.target_user_id,
            Comment.is_deleted == False,
        ).first()

        if not has_comment:
            raise HTTPException(
                status_code=403,
                detail="해당 글에 댓글을 단 사용자에게만 채팅을 시작할 수 있습니다",
            )

        owner_user_id = current_user.id
        participant_user_id = data.target_user_id

    # 글 작성자가 아닌 경우 → 글 작성자에게 채팅 시작
    else:
        if data.target_user_id != sighting.user_id:
            raise HTTPException(
                status_code=403,
                detail="글 작성자에게만 채팅을 시작할 수 있습니다",
            )

        owner_user_id = sighting.user_id
        participant_user_id = current_user.id

        # 삭제된 글은 새 채팅방 생성 불가, 기존 방만 재사용 가능
    if sighting.is_deleted:
        existing_room = db.query(ChatRoom).filter(
            ChatRoom.sighting_id == data.sighting_id,
            ChatRoom.owner_user_id == owner_user_id,
            ChatRoom.participant_user_id == participant_user_id,
        ).first()

        if existing_room:
            last_message = get_room_last_message(db, existing_room.id)
            return room_to_response(existing_room, last_message)

        raise HTTPException(
            status_code=403,
            detail="삭제된 글에는 새 채팅을 시작할 수 없습니다",
        )

    # 기존 방 조회
    room = db.query(ChatRoom).filter(
        ChatRoom.sighting_id == data.sighting_id,
        ChatRoom.owner_user_id == owner_user_id,
        ChatRoom.participant_user_id == participant_user_id,
    ).first()

    # 없으면 생성
    if not room:
        room = ChatRoom(
            sighting_id=data.sighting_id,
            owner_user_id=owner_user_id,
            participant_user_id=participant_user_id,
        )
        db.add(room)
        db.commit()
        db.refresh(room)

    last_message = get_room_last_message(db, room.id)

    return room_to_response(room, last_message)

@router.get("/chat/rooms", response_model=List[ChatRoomResponse])
def get_my_chat_rooms(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rooms = (
        db.query(ChatRoom)
        .filter(
            or_(
                ChatRoom.owner_user_id == current_user.id,
                ChatRoom.participant_user_id == current_user.id,
            )
        )
        .order_by(
            ChatRoom.last_message_at.is_(None),
            ChatRoom.last_message_at.desc(),
            ChatRoom.created_at.desc(),
        )
        .all()
    )

    result = []
    for room in rooms:
        last_message = get_room_last_message(db, room.id)
        result.append(room_to_response(room, last_message))

    return result


@router.get("/chat/rooms/{room_id}/messages", response_model=List[ChatMessageResponse])
def get_chat_messages(
    room_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    room = db.query(ChatRoom).filter(ChatRoom.id == room_id).first()

    if not room:
        raise HTTPException(status_code=404, detail="채팅방을 찾을 수 없습니다")

    if current_user.id not in (room.owner_user_id, room.participant_user_id):
        raise HTTPException(status_code=403, detail="채팅방에 접근할 수 없습니다")

    messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.room_id == room_id)
        .order_by(ChatMessage.id.asc())
        .all()
    )

    return [
        {
            "id": m.id,
            "room_id": m.room_id,
            "sender_user_id": m.sender_user_id,
            "sender_nickname": m.sender.nickname if m.sender else None,
            "content": m.content,
            "created_at": m.created_at,
        }
        for m in messages
    ]


@router.post(
    "/chat/rooms/{room_id}/messages",
    response_model=ChatMessageResponse,
    status_code=status.HTTP_201_CREATED,
)
def send_chat_message(
    room_id: int,
    data: ChatMessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    room = db.query(ChatRoom).filter(ChatRoom.id == room_id).first()

    if not room:
        raise HTTPException(status_code=404, detail="채팅방을 찾을 수 없습니다")

    if current_user.id not in (room.owner_user_id, room.participant_user_id):
        raise HTTPException(status_code=403, detail="채팅방에 접근할 수 없습니다")

    # 삭제된 글이면 전송 불가
    if room.sighting and room.sighting.is_deleted:
        raise HTTPException(
            status_code=403,
            detail="삭제된 글의 채팅방에는 메시지를 보낼 수 없습니다",
        )

    if not data.content.strip():
        raise HTTPException(status_code=400, detail="메시지 내용을 입력해주세요")

    message = ChatMessage(
        room_id=room_id,
        sender_user_id=current_user.id,
        content=data.content.strip(),
    )
    db.add(message)

    room.last_message_at = datetime.utcnow()

    db.commit()
    db.refresh(message)

    return {
        "id": message.id,
        "room_id": message.room_id,
        "sender_user_id": message.sender_user_id,
        "sender_nickname": message.sender.nickname if message.sender else None,
        "content": message.content,
        "created_at": message.created_at,
    }