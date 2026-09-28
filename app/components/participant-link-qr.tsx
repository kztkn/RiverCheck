import { useEffect, useState } from "react";
import { IconQrcode, IconX } from "@tabler/icons-react";
import { QRCodeSVG } from "qrcode.react";

export function ParticipantLinkQr({
  description = "読み取ると、参加者画面が直接開きます。",
  panelId = "participant-link-qr",
  panelTitle = "参加する端末で読み取ってください",
  qrTitle = "参加者用リンクのQRコード",
  url,
}: {
  description?: string;
  panelId?: string;
  panelTitle?: string;
  qrTitle?: string;
  url: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const hostname = new URL(url).hostname;
  const isLoopback = hostname === "localhost" || hostname === "127.0.0.1";

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className="participant-qr">
      <button
        aria-controls={panelId}
        aria-expanded={isOpen}
        className="button button-secondary participant-qr-toggle"
        onClick={() => setIsOpen(true)}
        type="button"
      >
        <IconQrcode aria-hidden="true" />
        QRコードを表示
      </button>

      {isOpen ? (
        <div className="participant-qr-overlay">
          <button
            aria-label="QRコードを閉じる"
            className="participant-qr-backdrop"
            onClick={() => setIsOpen(false)}
            type="button"
          />
          <section
            aria-labelledby={`${panelId}-heading`}
            aria-modal="true"
            className="participant-qr-panel"
            id={panelId}
            role="dialog"
          >
            <header className="participant-qr-header">
              <div>
                <p className="eyebrow">JOIN THE TABLE</p>
                <h2 id={`${panelId}-heading`}>参加用QRコード</h2>
              </div>
              <button
                aria-label="QRコードを閉じる"
                className="participant-qr-close"
                onClick={() => setIsOpen(false)}
                type="button"
              >
                <IconX aria-hidden="true" />
              </button>
            </header>
            <div className="participant-qr-content">
              <div className="participant-qr-code">
                <QRCodeSVG
                  bgColor="#ffffff"
                  fgColor="#07120e"
                  level="M"
                  marginSize={4}
                  size={240}
                  title={qrTitle}
                  value={url}
                />
              </div>
              <div className="participant-qr-copy">
                <strong>{panelTitle}</strong>
                <p>{description}</p>
                {isLoopback ? (
                  <p className="participant-qr-warning" role="note">
                    localhostは別端末から開けません。スマホで試す場合は、PCのLAN
                    IPでこの管理画面を開き直してからQRを表示してください。
                  </p>
                ) : null}
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
