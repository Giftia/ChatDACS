# ChatDACS Context

ChatDACS is evolving into a Xiaoye-centered chatbot framework. The project keeps the existing plugin protocol and platform behavior stable while gradually deepening runtime modules behind small internal interfaces.

## Domain Terms

- **小夜**: The chatbot persona and product identity exposed to Web users, QQ groups, QQ Guild, Bilibili live rooms, Telegram, and future agent runtimes.
- **平台 Adapter**: A module that translates one external chat platform event into ChatDACS runtime calls, then formats the response back to that platform.
- **插件运行时**: The runtime that loads legacy plugins, matches commands, handles plugin toggles, protects execution with soft timeout, and normalizes plugin responses.
- **Web Session**: The Web socket connection module responsible for cookie-based user identity, user profile initialization, online-user count, location display, nickname fallback, and basic socket events.
- **Web Message**: The Web socket message module responsible for sanitizing user text, persisting Web messages, broadcasting user messages, executing plugins, and falling through to chat replies.

## Current Architecture Direction

- Keep public behavior compatible first; deepen one module at a time.
- Prefer injected dependencies at seams so platform and Web flows can be tested without real OneBot, external APIs, native graphics, or live sockets.
- Keep the legacy plugin interface compatible: `插件名`, `指令`, `init`, and `execute` remain the author-facing contract.
- Do not treat Web-only local configuration as product default; use tests and smoke scripts for local verification.
