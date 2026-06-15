// 녹음 모듈 — MediaRecorder로 오디오를 캡처한다(백업용, 가볍게).
// 결과 Blob은 IndexedDB(audio 스토어)에 저장하고 record.audioBlobId로 연결한다.
// 오디오 원본은 사용자가 명시적으로 동의한 경우(클라우드 STT)에만 외부로 나간다.

// 브라우저별 지원 mime 선택 (iOS Safari는 audio/mp4, Chrome/Android는 audio/webm)
function pickMimeType() {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
  if (typeof MediaRecorder === "undefined" || !MediaRecorder.isTypeSupported) return "";
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return "";
}

export function isRecordingSupported() {
  return (
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices &&
    !!navigator.mediaDevices.getUserMedia &&
    typeof MediaRecorder !== "undefined"
  );
}

export function createRecorder() {
  let mediaRecorder = null;
  let stream = null;
  let chunks = [];

  return {
    async start() {
      if (!isRecordingSupported()) {
        throw new Error("이 브라우저는 녹음을 지원하지 않습니다.");
      }
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunks = [];
      const mimeType = pickMimeType();
      mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size) chunks.push(e.data);
      };
      mediaRecorder.start();
    },

    // 정지 → 녹음 Blob 반환
    async stop() {
      return new Promise((resolve, reject) => {
        if (!mediaRecorder) {
          reject(new Error("진행 중인 녹음이 없습니다."));
          return;
        }
        mediaRecorder.onstop = () => {
          const type = mediaRecorder.mimeType || (chunks[0] && chunks[0].type) || "audio/webm";
          const blob = new Blob(chunks, { type });
          if (stream) stream.getTracks().forEach((t) => t.stop());
          stream = null;
          mediaRecorder = null;
          resolve(blob);
        };
        try {
          mediaRecorder.stop();
        } catch (err) {
          reject(err);
        }
      });
    },

    // 정리(저장 안 하고 버릴 때)
    cancel() {
      try {
        if (mediaRecorder && mediaRecorder.state !== "inactive") mediaRecorder.stop();
      } catch {}
      if (stream) stream.getTracks().forEach((t) => t.stop());
      stream = null;
      mediaRecorder = null;
      chunks = [];
    },

    state() {
      return mediaRecorder ? mediaRecorder.state : "inactive";
    },
  };
}

function uid() {
  return "aud_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
}

// 녹음 Blob을 audio 스토어에 저장하고 id 반환
export async function storeAudioBlob(putAudio, blob) {
  const id = uid();
  await putAudio({ id, blob, mime: blob.type || "", createdAt: new Date().toISOString() });
  return id;
}
