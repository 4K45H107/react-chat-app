import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import "./chat.css";
import { useChatStore } from "../../lib/chatStore";
import { useUserStore } from "../../lib/userStore";
import upload from "../../lib/upload";
import {
  deleteMessage,
  editMessage,
  sendMessage,
  syncSidebarPreview,
} from "../../lib/chatService";
import { rateLimitToastMessage } from "../../lib/rateLimit";
import { requestStartCall } from "../call/CallOverlay";
import { useCallStore } from "../../lib/callStore";
import CameraCaptureOverlay from "./CameraCaptureOverlay";
import ChatComposer from "./ChatComposer";
import ChatHeader from "./ChatHeader";
import MessageList from "./MessageList";
import ThreadSearchBar from "./ThreadSearchBar";
import { useCameraCapture } from "./hooks/useCameraCapture";
import { useChatThread } from "./hooks/useChatThread";
import { useOwnTyping } from "./hooks/useOwnTyping";
import { usePartnerStatus } from "./hooks/usePartnerStatus";
import { useThreadSearch } from "./hooks/useThreadSearch";
import { useVoiceRecording } from "./hooks/useVoiceRecording";

const Chat = () => {
  const [text, setText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editText, setEditText] = useState("");
  const [emojiDismissKey, setEmojiDismissKey] = useState(0);

  const {
    chatId,
    user,
    isGroup,
    groupName,
    groupAvatar,
    participantIds,
    members,
    isCurrentUserBlocked,
    isReceiverBlocked,
    closeChat,
    toggleDetails,
  } = useChatStore();
  const { currentUser } = useUserStore();

  const isChatBlocked =
    !isGroup && (isCurrentUserBlocked || isReceiverBlocked);

  const memberNameById = useMemo(() => {
    const map = new Map();
    for (const member of members ?? []) {
      if (member?.id) map.set(member.id, member.username || "Member");
    }
    if (currentUser?.id) {
      map.set(currentUser.id, currentUser.username || "You");
    }
    return map;
  }, [members, currentUser?.id, currentUser?.username]);

  const canSend = Boolean(chatId) && (isGroup || Boolean(user));
  const callPhase = useCallStore((s) => s.phase);
  const canCall =
    Boolean(chatId) &&
    !isGroup &&
    Boolean(user?.id) &&
    !isChatBlocked &&
    callPhase === "idle";

  const composerInputRef = useRef(null);
  const closeCameraRef = useRef(() => {});
  const cancelRecordingRef = useRef(() => {});
  const sendImageFileRef = useRef(async () => false);

  const {
    messages,
    isLoadingOlder,
    hasMore,
    endRef,
    centerRef,
    messageNodeRefs,
    shouldStickToBottomRef,
    handleCenterScroll,
  } = useChatThread({
    chatId,
    currentUserId: currentUser?.id,
  });

  const { partnerTyping, partnerOnline } = usePartnerStatus({
    chatId,
    userId: user?.id,
    currentUserId: currentUser?.id,
    isGroup,
  });

  const { clearOwnTyping, onComposerTextChange } = useOwnTyping({
    chatId,
    currentUserId: currentUser?.id,
    isChatBlocked,
  });

  const {
    isRecording,
    recordSeconds,
    startRecording,
    sendRecording,
    cancelRecording,
  } = useVoiceRecording({
    chatId,
    currentUserId: currentUser?.id,
    canSend,
    isChatBlocked,
    isSending,
    setIsSending,
    shouldStickToBottomRef,
    clearOwnTyping,
    onBeforeStart: () => closeCameraRef.current(),
  });
  cancelRecordingRef.current = cancelRecording;

  const {
    isCameraOpen,
    isCameraStarting,
    capturedPhotoUrl,
    videoRef,
    openCamera,
    closeCamera,
    capturePhoto,
    retakePhoto,
    sendCapturedPhoto,
  } = useCameraCapture({
    chatId,
    canSend,
    isChatBlocked,
    isSending,
    clearOwnTyping,
    onBeforeOpen: () => {
      cancelRecordingRef.current();
      setEmojiDismissKey((key) => key + 1);
    },
    sendImageFile: (file) => sendImageFileRef.current(file),
  });
  closeCameraRef.current = closeCamera;

  const {
    threadSearchOpen,
    threadSearch,
    setThreadSearch,
    activeMatchIndex,
    setActiveMatchIndex,
    searchQuery,
    matchIds,
    toggleSearch,
    goPrevMatch,
    goNextMatch,
  } = useThreadSearch(messages, chatId);

  useEffect(() => {
    setText("");
    setEditingMessageId(null);
    setEditText("");
  }, [chatId]);

  useEffect(() => {
    if (!matchIds.length) return;
    const safeIndex = Math.min(activeMatchIndex, matchIds.length - 1);
    if (safeIndex !== activeMatchIndex) {
      setActiveMatchIndex(safeIndex);
      return;
    }
    const node = messageNodeRefs.current.get(matchIds[safeIndex]);
    node?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeMatchIndex, matchIds, messageNodeRefs, setActiveMatchIndex]);

  const handleStartCall = (type) => {
    if (!canCall) {
      if (isGroup) toast.info("Calls are available in 1:1 chats only.");
      else if (isChatBlocked) toast.warn("Messaging is blocked with this user.");
      else if (callPhase !== "idle") toast.warn("You're already in a call.");
      return;
    }
    requestStartCall({ type, partner: user, activeChatId: chatId });
  };

  const handleTextChange = (value) => {
    onComposerTextChange(value, setText);
  };

  const sendImageFile = async (file) => {
    if (!file || !canSend || isChatBlocked || isSending) return false;

    if (!file.type.startsWith("image/")) {
      toast.warn("Please choose an image file.");
      return false;
    }

    setIsSending(true);
    shouldStickToBottomRef.current = true;
    try {
      await clearOwnTyping();
      const imgUrl = await upload(file, { uid: currentUser.id });
      if (!imgUrl) {
        toast.error("Failed to upload image. Please try again.");
        return false;
      }

      const caption = text.trim();
      await sendMessage({
        chatId,
        senderId: currentUser.id,
        text: caption,
        img: imgUrl,
      });
      await syncSidebarPreview({
        chatId,
        currentUserId: currentUser.id,
        preview: caption || "Photo",
      });
      setText("");
      return true;
    } catch (error) {
      const limited = rateLimitToastMessage(error);
      if (limited) {
        toast.warn(limited);
        return false;
      }
      console.error(
        "[Chat] Failed to send image:",
        error.code || error,
        error.message || error
      );
      toast.error("Failed to send image. Please try again.");
      return false;
    } finally {
      setIsSending(false);
    }
  };
  sendImageFileRef.current = sendImageFile;

  const handleSend = async () => {
    if (text === "" || !canSend || isChatBlocked || isSending) return;

    setIsSending(true);
    shouldStickToBottomRef.current = true;
    try {
      await clearOwnTyping();
      await sendMessage({
        chatId,
        senderId: currentUser.id,
        text,
      });
      await syncSidebarPreview({
        chatId,
        currentUserId: currentUser.id,
        preview: text,
      });
      setText("");
    } catch (error) {
      const limited = rateLimitToastMessage(error);
      if (limited) {
        toast.warn(limited);
        return;
      }
      console.error(
        "[Chat] Failed to send message:",
        error.code,
        error.message,
        error
      );
      toast.error("Failed to send message. Please try again.");
    } finally {
      setIsSending(false);
      requestAnimationFrame(() => {
        composerInputRef.current?.focus();
      });
    }
  };

  const handleImageSelect = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    await sendImageFile(file);
  };

  const handleComposerKeyDown = (e) => {
    if (e.key !== "Enter" || e.shiftKey) return;
    e.preventDefault();
    handleSend();
  };

  const handleDeleteMessage = async (message) => {
    if (!message?.id || message.senderId !== currentUser.id || message.deleted) {
      return;
    }

    try {
      if (editingMessageId === message.id) {
        setEditingMessageId(null);
        setEditText("");
      }
      await deleteMessage(chatId, message);
    } catch (error) {
      const limited = rateLimitToastMessage(error);
      if (limited) {
        toast.warn(limited);
        return;
      }
      console.error(
        "[Chat] Failed to delete message:",
        error.code,
        error.message,
        error
      );
      toast.error("Failed to delete message. Please try again.");
    }
  };

  const handleStartEdit = (message) => {
    if (!message?.id || message.senderId !== currentUser.id || message.deleted) {
      return;
    }
    if (message.call) return;
    setEditingMessageId(message.id);
    setEditText(message.text ?? "");
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditText("");
  };

  const handleSaveEdit = async (message) => {
    const nextText = editText.trim();
    if (!message?.id || !nextText) {
      toast.warn("Message cannot be empty.");
      return;
    }

    if (nextText === (message.text ?? "")) {
      handleCancelEdit();
      return;
    }

    try {
      await editMessage(chatId, message, nextText);
      handleCancelEdit();
    } catch (error) {
      const limited = rateLimitToastMessage(error);
      if (limited) {
        toast.warn(limited);
        return;
      }
      console.error(
        "[Chat] Failed to edit message:",
        error.code,
        error.message,
        error
      );
      toast.error("Failed to edit message. Please try again.");
    }
  };

  return (
    <div className="chat">
      {isCameraOpen && (
        <CameraCaptureOverlay
          capturedPhotoUrl={capturedPhotoUrl}
          isCameraStarting={isCameraStarting}
          isSending={isSending}
          videoRef={videoRef}
          onClose={closeCamera}
          onRetake={retakePhoto}
          onSend={sendCapturedPhoto}
          onCapture={capturePhoto}
        />
      )}

      <ChatHeader
        isGroup={isGroup}
        groupName={groupName}
        groupAvatar={groupAvatar}
        user={user}
        partnerTyping={partnerTyping}
        partnerOnline={partnerOnline}
        participantCount={participantIds?.length || members?.length || 0}
        threadSearchOpen={threadSearchOpen}
        canCall={canCall}
        onBack={closeChat}
        onToggleSearch={toggleSearch}
        onStartVoiceCall={() => handleStartCall("voice")}
        onStartVideoCall={() => handleStartCall("video")}
        onToggleDetails={toggleDetails}
      />

      {threadSearchOpen && (
        <ThreadSearchBar
          threadSearch={threadSearch}
          onThreadSearchChange={setThreadSearch}
          searchQuery={searchQuery}
          matchCount={matchIds.length}
          activeMatchIndex={activeMatchIndex}
          onPrev={goPrevMatch}
          onNext={goNextMatch}
        />
      )}

      <MessageList
        messages={messages}
        isLoadingOlder={isLoadingOlder}
        hasMore={hasMore}
        isChatBlocked={isChatBlocked}
        isCurrentUserBlocked={isCurrentUserBlocked}
        currentUserId={currentUser.id}
        isGroup={isGroup}
        memberNameById={memberNameById}
        editingMessageId={editingMessageId}
        editText={editText}
        onEditTextChange={setEditText}
        onSaveEdit={handleSaveEdit}
        onCancelEdit={handleCancelEdit}
        onStartEdit={handleStartEdit}
        onDelete={handleDeleteMessage}
        matchIds={matchIds}
        activeMatchIndex={activeMatchIndex}
        messageNodeRefs={messageNodeRefs}
        centerRef={centerRef}
        endRef={endRef}
        onScroll={handleCenterScroll}
      />

      <ChatComposer
        isChatBlocked={isChatBlocked}
        isSending={isSending}
        canSend={canSend}
        isRecording={isRecording}
        recordSeconds={recordSeconds}
        text={text}
        onTextChange={handleTextChange}
        onKeyDown={handleComposerKeyDown}
        onSend={handleSend}
        onImageSelect={handleImageSelect}
        onOpenCamera={openCamera}
        onStartRecording={startRecording}
        onCancelRecording={cancelRecording}
        onSendRecording={sendRecording}
        composerInputRef={composerInputRef}
        emojiDismissKey={emojiDismissKey}
      />
    </div>
  );
};

export default Chat;
