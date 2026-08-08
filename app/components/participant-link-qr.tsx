import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";

export function ParticipantLinkQr({ url }: { url: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const hostname = new URL(url).hostname;
  const isLoopback = hostname === "localhost" || hostname === "127.0.0.1";

  return (
    <div className="participant-qr">
      <button
        aria-controls="participant-link-qr"
        aria-expanded={isOpen}
        className="button button-secondary participant-qr-toggle"
        onClick={() => setIsOpen((current) => !current)}
        type="button"
      >
        <QrIcon />
        {isOpen ? "QRコードを閉じる" : "QRコードを表示"}
      </button>

      {isOpen ? (
        <div className="participant-qr-panel" id="participant-link-qr">
          <div className="participant-qr-code">
            <QRCodeSVG
              bgColor="#ffffff"
              fgColor="#07120e"
              level="M"
              marginSize={4}
              size={240}
              title="参加者用リンクのQRコード"
              value={url}
            />
          </div>
          <div className="participant-qr-copy">
            <strong>参加する端末で読み取ってください</strong>
            <p>読み取ると、この会の参加者画面が直接開きます。</p>
            {isLoopback ? (
              <p className="participant-qr-warning" role="note">
                localhostは別端末から開けません。スマホで試す場合は、PCのLAN
                IPでこの管理画面を開き直してからQRを表示してください。
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function QrIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <rect height="7" rx="1" width="7" x="3" y="3" />
      <rect height="7" rx="1" width="7" x="14" y="3" />
      <rect height="7" rx="1" width="7" x="3" y="14" />
      <path d="M14 14h3v3h-3zM19 14h2v5h-2M14 19h3v2h-3M19 21h2" />
    </svg>
  );
}
