# 戀愛數學集點簿

手機優先的雙人數學集點網站。包含題型計分、男友確認入帳、章節進度、答對率、獎勵兌換與完整紀錄。

## 立即試用

用瀏覽器開啟 `index.html`，按「先用試玩模式看看」。資料會保存在目前瀏覽器。

## 開啟雙人登入與跨裝置同步

1. 到 [Supabase](https://supabase.com/) 建立免費專案。
2. 開啟 SQL Editor，貼上並執行 `supabase.sql`。
3. 到 Authentication → Users，建立你和女友的 Email/Password 帳號。
4. 回到 SQL Editor，修改 `supabase.sql` 最後兩段註解範例後執行，讓兩個帳號使用相同的 `couple_code`。
5. 到 Project Settings → API，複製 Project URL 與 anon public key。
6. 打開 `config.js`，填入：

```js
window.APP_CONFIG = {
  supabaseUrl: "https://你的專案.supabase.co",
  supabaseAnonKey: "你的 anon public key"
};
```

7. 將 `outputs` 資料夾部署至 Netlify、Vercel 或 GitHub Pages，即可讓手機與電腦共用。

## 計分規則

- 直接答對：題目原分數
- 訂正後答對：原分數的一半
- 看答案：該題 0 分
- 整章寫完：加 10 pt
- 歷屆試題直接答對率達 70%：加 5 pt
- 新紀錄必須由 `boyfriend` 角色確認後才會計入可用點數
