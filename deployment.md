# Verso - Instrukcja Wdrożenia (Produkcja)

Ten dokument opisuje kroki potrzebne do wdrożenia aplikacji na produkcję za pomocą darmowych narzędzi: GitHub, Convex (baza) oraz Cloudflare Pages (hosting frontendu).

## 1. Wdrożenie Bazy Danych (Convex)
Convex posiada wbudowaną obsługę środowiska produkcyjnego. Zamiast `npx convex dev`, do środowiska produkcyjnego używamy polecenia deploy.

1. W terminalu uruchom polecenie:
   ```bash
   npx convex deploy
   ```
2. Convex automatycznie zapyta Cię, czy chcesz utworzyć środowisko produkcyjne dla Twojego projektu. Potwierdź.
3. Skrypt wygeneruje produkcyjny URL i przypisze klucze do Twojego konta Convex. Po zakończeniu, baza danych jest gotowa!

## 2. Zapisanie kodu na GitHub
Aby Cloudflare mogło automatycznie budować i publikować projekt po każdej zmianie, musisz umieścić go na GitHubie.

1. Upewnij się, że jesteś zalogowany do GitHuba i masz puste repozytorium (np. `verso-app`).
2. W terminalu wykonaj polecenia:
   ```bash
   git add .
   git commit -m "Gotowe MVP pod produkcję"
   git push -u origin master
   ```

## 3. Publikacja na Cloudflare Pages
Cloudflare Pages to darmowa platforma od Cloudflare, idealna dla aplikacji Next.js i React.

1. Zaloguj się na [dash.cloudflare.com](https://dash.cloudflare.com/).
2. Przejdź do zakładki **Workers & Pages**.
3. Kliknij **Create Application** -> zakładka **Pages** -> **Connect to Git**.
4. Wybierz swoje konto GitHub i wskaż repozytorium `verso-app`.
5. W ustawieniach buildu (Build settings):
   - **Framework preset**: `Next.js`
   - **Build command**: `npx @cloudflare/next-on-pages` (lub domyślne `npm run build` jeśli używasz standardowego buildera Vercel/Node na CF).
   - **Build output directory**: `.vercel/output/static` (Cloudflare Pages automatycznie to wykryje dla Next.js)
6. **Bardzo ważne: Zmienne Środowiskowe (Environment Variables)**
   - W sekcji *Environment variables* musisz dodać swój produkcyjny klucz Convex. 
   - Nazwa: `NEXT_PUBLIC_CONVEX_URL`
   - Wartość: `[TWÓJ PRODUKCYJNY URL CONVEXA]` (znajdziesz go w panelu Convex na dashboard.convex.dev).
7. Kliknij **Save and Deploy**. 

Za około 2 minuty Twoja nowa aplikacja sportowa Verso będzie działać pod adresem np. `verso-app.pages.dev`!
