HAYAT ROAD-TRAFFIC COLLECTOR — free Cloudflare Worker, every 15 minutes, even when nobody has the app open
==========================================================================================================

What it saves (the owner app reads it by itself):
  - Drive time now vs with no traffic for the routes in the app (Perinthalmanna <-> Malappuram)
      -> same place as the app's own readings, so Traffic history and "usual for this hour" fill in all day.
  - Road speed on NH 966 at the shop (current km/h vs free-flow km/h, confidence, closures)
      -> traffic_flow/{day}. This is SPEED, not the number of vehicles.
  - A health line (settings/trf_health): the owner app warns when the collector has not written for an hour.

Cost: free. Cloudflare Workers free plan (100,000 requests a day; this uses 96 cron runs).
TomTom: ~3 requests a run = ~288 a day; TomTom's free tier is 2,500 a day. The app's own readings come on top
(at most a few dozen a day). No card is needed for either.

DEPLOYED 25 Nov 2026 with wrangler:  cd cloudflare/traffic  &&  npx wrangler deploy
   (worker hayat-traffic, https://hayat-traffic.majidkhn.workers.dev, cron */15; keys are read from the site's
   public config.js, so no secrets are set. Opening the URL shows the last run; it only runs again after 10 min.)

SET UP BY HAND INSTEAD (only if wrangler is not available)
1. dash.cloudflare.com -> sign in (the same account as the Instagram / bill-reader workers is fine).
2. Workers & Pages -> Create -> Create Worker -> name it  hayat-traffic  -> Deploy.
3. Edit code -> delete everything -> paste the whole of worker.js from this folder -> Deploy.
4. Settings -> Variables and Secrets -> Add:
     FIREBASE_API_KEY   (Text)    the apiKey from config.js (starts AIza...; it is already public on the site)
     TOMTOM_KEY         (Secret)  your TomTom key — the one in config.js (traffic.tomtomKey) works
   Save and deploy.
5. Settings -> Triggers -> Cron Triggers -> Add ->  */15 * * * *  -> Add.
6. Test: open the worker's URL (https://hayat-traffic.<you>.workers.dev). It runs once and shows what it wrote:
     "routes": 2, "points": 1, "err": []   = all good.
   In the owner app: Live -> More on Live -> Road traffic shows "collector: ok · last run hh:mm".

MORE ROAD POINTS (optional)
   The default point is the highway at the shop. To add more (e.g. 3 km each side), the office can add to
   settings/traffic a list  flow: [{id:'east', n:'NH 966 east', p:[lat,lng]}, ...]  — the worker reads it each run.

IF IT STOPS
   - err "no TomTom key": add the TOMTOM_KEY secret (step 4).
   - err "HTTP 403/429" from TomTom: the key's daily limit was hit; it recovers the next day.
   - err "PERMISSION_DENIED": the Firestore rules were made strict; the worker then needs a service-account
     token instead of the web key (ask Claude to switch it).
   Turning it off: Settings -> Triggers -> delete the cron. Nothing in the app breaks; history just stops growing.

PRIVACY / TERMS
   Only TomTom's public traffic API is used, with your own key, inside its free terms. No Google Maps data is
   copied and nothing about customers is read or sent.
