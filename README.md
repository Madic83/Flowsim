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

Projektet är förberett för deployment på Render.

Render använder:

- Build command: `npm install`
- Start command: `npm start`

Detta fungerar eftersom root-projektet nu automatiskt installerar och bygger frontend under `postinstall`.

Filer för deployment

- `render.yaml` för Render
- `package.json` i roten hanterar build/start för hela appen

