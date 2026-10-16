HAYAT IN-APP CALLS - FREE RELAY (optional, ~10 minutes)

Calls work without this on most networks. Some mobile networks block direct
phone-to-phone audio; this free relay fixes those calls.

Cost: Cloudflare TURN gives the first 1,000 GB a month free. One minute of a
call is about 0.75 MB, so ~1 million minutes a month before any charge.
(Check the Cloudflare page if it asks for a payment card - if it does and you
do not want that, skip this; calls still work on most networks.)

1. dash.cloudflare.com -> Realtime (Calls) -> TURN -> Create a TURN key.
   Copy the Key ID and the API token it shows (once).
2. Workers & Pages -> Create -> Worker -> name it  hayat-turn  -> Deploy.
3. Edit code -> delete everything -> paste worker.js from this folder -> Deploy.
4. Settings -> Variables and Secrets:
     TURN_KEY_ID          = the Key ID            (Text)
     TURN_KEY_API_TOKEN   = the API token         (Secret)
     ALLOW_ORIGIN         = https://personal-majid.github.io   (Text)
5. Copy the worker address (https://hayat-turn.<you>.workers.dev).
6. Open setup.html (Staff & tables) -> Settings -> "In-app calls" ->
   paste the address -> Save.

Check: open the address in a browser - it should say {"error":"POST only"}.
