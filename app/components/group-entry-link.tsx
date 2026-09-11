import { useRef, useState } from "react";
import { IconCheck, IconCopy } from "@tabler/icons-react";
import { ParticipantLinkQr } from "./participant-link-qr";

export function GroupEntryLink({ url }: { url: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setMessage("リンクをコピーしました。");
    } catch {
      inputRef.current?.focus();
      inputRef.current?.select();
      setMessage("リンクを選択しました。長押ししてコピーしてください。");
    }
  }
  return (
    <section className="participant-panel" aria-labelledby="group-entry-link-heading">
      <h2 id="group-entry-link-heading">グループ参加リンク</h2>
      <p>開催がないときも使える、メンバー登録・ログイン用のリンクです。</p>
      <div className="share-link-control">
        <input ref={inputRef} aria-label="グループ参加URL" readOnly value={url} onFocus={(event) => event.currentTarget.select()} />
        <button type="button" className="copy-icon-button" aria-label="グループ参加リンクをコピー" onClick={copyLink}>
          {message === "リンクをコピーしました。" ? <IconCheck aria-hidden="true" /> : <IconCopy aria-hidden="true" />}
        </button>
      </div>
      <p className="field-hint" role="status">{message}</p>
      <ParticipantLinkQr
        url={url}
        panelId="group-entry-qr"
        panelTitle="自分のスマホで読み取ってください"
        qrTitle="グループ参加リンクのQRコード"
        description="メンバー登録・ログイン画面が開きます。"
      />
    </section>
  );
}
