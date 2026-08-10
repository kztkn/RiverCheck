interface ErrorPageContent {
  message: string;
  status: number;
}

export function AppErrorPage({ status }: { status: number }) {
  const content = getErrorPageContent(status);

  return (
    <main className="error-page">
      <p className="eyebrow">RIVER CHECK</p>
      <h1>{content.status}</h1>
      <p>{content.message}</p>
      <a className="button button-primary" href="/">
        トップへ戻る
      </a>
    </main>
  );
}

function getErrorPageContent(status: number): ErrorPageContent {
  if (status === 400) {
    return {
      status,
      message:
        "リクエストを処理できませんでした。時間をおいて、トップからもう一度お試しください。",
    };
  }
  if (status === 403) {
    return {
      status,
      message: "この操作を利用できません。トップからやり直してください。",
    };
  }
  if (status === 404) {
    return { status, message: "ページが見つかりません。" };
  }
  if (status === 409) {
    return {
      status,
      message: "画面の状態が変わりました。トップから最新の状態を確認してください。",
    };
  }
  if (status === 429) {
    return {
      status,
      message:
        "操作が集中しています。少し待って、トップからもう一度お試しください。",
    };
  }
  return {
    status: status >= 500 && status <= 599 ? status : 500,
    message:
      "画面を表示できませんでした。一時的な問題の可能性があります。時間をおいて、トップからもう一度お試しください。",
  };
}
