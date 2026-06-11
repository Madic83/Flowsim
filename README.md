Flowsim (Node.js)

Kör lokalt:

1) Installera beroenden:

```powershell
cd C:\flowsim
npm run install
```

2) Starta utvecklingsserver:

```powershell
npm run dev
```

Öppna sedan i webbläsaren:

http://localhost:3000/

Obs: `npm run install` kör scriptet `install` i `package.json` (detta kör i sin tur `npm install`).

Filer skapade:
- package.json
- server.js
- frontend/index.html
- frontend/app.js
- start-flowsim.bat
- .gitignore

Ny info — React + Vite frontend

- Frontend finns i `frontend/` och är ett minimal React-app (Vite).

Kör lokalt i utveckling (två terminaler):

```powershell
cd C:\flowsim
npm run install
npm start
```

I en separat terminal (frontend):

```powershell
cd C:\flowsim\frontend
npm install
npm run dev
```

Alternativt, starta endast backend med `npm start` och öppna http://localhost:3000

Detta README uppdaterar nu hur du kör frontend och backend under utveckling.

