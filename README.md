Flowsim

Kör lokalt

1. Installera beroenden:

```powershell
cd C:\flowsim
npm install
```

2. Starta servern:

```powershell
npm start
```

3. Öppna appen:

```text
http://localhost:3000
```

Projektstruktur

- Backend: `server.js`
- Frontend: `frontend/` (React + Vite)
- Servern bygger och serverar frontend från `frontend/dist`

Publik deployment

Öppna den publika appen på https://flowsim.onrender.com.

Välj **Instruktör** och logga in med användarnamn `admin` och lösenord `admin`.
Välj **Deltagare** för att ansluta med instruktörens sessionskod.

Projektet deployas på Render.

Render använder:

- Build command: `npm install`
- Start command: `npm start`

Detta fungerar eftersom root-projektet nu automatiskt installerar och bygger frontend under `postinstall`.

Filer för deployment

- `render.yaml` för Render
- `package.json` i roten hanterar build/start för hela appen

