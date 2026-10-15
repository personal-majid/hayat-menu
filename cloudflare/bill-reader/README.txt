HAYAT BILL READER - FREE (Cloudflare Workers AI)
================================================

The Stock page reads bill photos FREE on the phone first. Only when that
read is unsure (handwriting, blur, totals that do not add up) does it ask
this Cloudflare Worker, which uses Cloudflare's OWN free AI
(Meta Llama 4 Scout - better at messy handwriting; if your account does not
have it, the worker falls back to Meta Llama 3.2 11B Vision by itself).
Already have the worker? Paste the NEW worker.js over the old one -> Deploy.

Cost: Rs 0. No API key, no card.
- Workers Free plan: 100,000 requests a day.
- Workers AI: 10,000 free "neurons" a day = roughly 100-200 bill photos
  (the bigger model uses more per photo; only unreadable bills are sent).
  Past that the reader just says "free daily limit reached" until the next
  day - the FREE plan never charges you. (Do NOT switch to Workers Paid.)

ONE-TIME SETUP (about 5 minutes, all in the browser)
1. dash.cloudflare.com -> sign up / log in (free).
2. Workers & Pages -> Create -> Worker -> name it  hayat-bill-reader
   -> Deploy -> Edit code
3. Delete the sample code, paste ALL of worker.js from this folder -> Deploy.
4. Worker -> Settings -> Bindings -> Add -> Workers AI
   Variable name:  AI   -> Save / Deploy.
5. Worker -> Settings -> Variables and Secrets -> Add:
     ALLOW_ORIGIN   (Text)   https://personal-majid.github.io
6. Copy the worker URL (https://hayat-bill-reader.<you>.workers.dev).
7. Open the Stock page as office -> Items tab -> "AI reader" -> paste
   the URL -> Save. Leave it empty to use only the on-phone reader.

Meta's licence for the model is accepted automatically by the worker on
its first call.

Test: Stock -> New bill -> upload a handwritten bill. The review panel
says "read by AI" when the worker was used.
