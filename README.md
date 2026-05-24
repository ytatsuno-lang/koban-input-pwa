# KobanInput PWA

ANDPADの「AP003 維持管理作業（工事）事前申請」入力補助のPWA版。
SwiftUI版 (`~/Desktop/クロード/iphone/KobanInput`) と同じ機能を Web で実装し、
GitHub Pages から URL 配布できる構成。

## 構成

```
KobanInput-PWA/
├── index.html              # 単一ページ UI
├── app.js                  # アプリロジック
├── styles.css              # スタイル
├── sw.js                   # Service Worker（オフラインキャッシュ）
├── manifest.webmanifest    # PWA マニフェスト
├── koban_master.json       # 工番マスタ（約344項目）
├── icons/
│   ├── icon-192.png
│   ├── icon-512.png
│   └── apple-touch-icon.png
├── _make_icons.py          # アイコン再生成スクリプト（任意）
└── README.md
```

## ローカル動作確認

Service Worker は HTTPS または `localhost` でのみ動くので、`file://` 直接は不可。
プロジェクト直下で簡易HTTPサーバを起動：

```bash
cd ~/Desktop/クロード/KobanInput-PWA
python3 -m http.server 8000
```

→ ブラウザで `http://localhost:8000` を開く。

## iPhone でテスト（ローカル）

iPhone と Mac が同じ Wi-Fi にいれば、Mac の IP を使ってアクセス可能：

```bash
ipconfig getifaddr en0   # Mac の IP を確認
# 例: 192.168.1.20
```

iPhone Safari で `http://192.168.1.20:8000` を開く。
ただし Service Worker は **localhost 以外の http:// では動かない**ので、
オフライン動作確認は GitHub Pages デプロイ後に行う。

## GitHub Pages デプロイ

```bash
cd ~/Desktop/クロード/KobanInput-PWA
git init
git add .
git commit -m "Initial KobanInput PWA"

# GitHub で新規リポジトリを作成（例: koban-input-pwa）
git branch -M main
git remote add origin git@github.com:<USER>/koban-input-pwa.git
git push -u origin main
```

GitHub の Settings → Pages → Source を `main` / `/ (root)` に設定 → 数十秒で公開。

公開 URL: `https://<USER>.github.io/koban-input-pwa/`

iPhone Safari で URL を開く → 共有ボタン → 「ホーム画面に追加」
→ アイコンタップで全画面起動・オフラインでも動作。

## マスタ更新時

`koban_master.json` を上書きして commit & push するだけ。
PWA は次回起動時に新しいキャッシュを取りに行く。

ただし Service Worker のキャッシュバスティング上、`sw.js` 内の `CACHE_VERSION`
を `koban-v1` → `koban-v2` のようにインクリメントすると確実に更新される。

## 機能

- 作業日・工番・数量を入力 → 自動で小計・総額算出
- 工番一覧モーダル（カテゴリタブ・曖昧検索・検索履歴）
  - `a1` で `A01` がヒット（先頭ゼロ除去マッチ）
  - 検索欄が空のまま Enter で全件表示
- テキストプレビュー（等幅、簡易/詳細切替、ワンタップコピー）
- 貼り付け項目モード（タップで各値コピー＋自動次行）
- 状態は `localStorage` に自動保存（行・日付・検索履歴・詳細表示トグル）

## 制約

- **ANDPAD への自動入力は不可** — iOS のサンドボックス上、PWA・ネイティブとも同じ。
  「タップしてコピー → ANDPAD に戻って貼り付け」運用。
- **Haptic Feedback 非対応** — iOS PWA では触覚フィードバックが使えないため、
  視覚フィードバックでカバー。
- Clipboard API は `<button>` の `click` ハンドラ内でのみ動作（user-gesture 要件）。
